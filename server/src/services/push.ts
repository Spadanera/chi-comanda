import webpush from 'web-push'
import config, { isFeatureEnabled } from '../config'
import { Item, Order } from '../../../models/src'
import { VenueContext } from '../venue/context'
import { VenueDb } from '../venue/db'

export interface PushSubscriptionInput {
    endpoint: string
    keys: { p256dh: string, auth: string }
}

interface StoredSubscription {
    id: number
    endpoint: string
    p256dh: string
    auth: string
    /** Destination the bartender serves tonight; null = all (events created before destinations). */
    destination_id: number | null
}

export interface PushPayload {
    title: string
    body: string
    /** Notifications with the same tag replace each other. */
    tag: string
    /** Page opened when the notification is tapped. */
    url: string
    /** Venue the notification is about: the app switches to it when the notification is tapped. */
    venueId: number
}

const enabled = isFeatureEnabled('push') && !!(config.push.publicKey && config.push.privateKey)
if (enabled) {
    webpush.setVapidDetails(config.push.subject, config.push.publicKey, config.push.privateKey)
} else if (isFeatureEnabled('push')) {
    console.warn('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set: push notifications disabled')
}

/** "2× Spritz, 1× Nachos" */
function summarize(items: Item[]): string {
    const counts = new Map<string, number>()
    for (const item of items) counts.set(item.name || '', (counts.get(item.name || '') || 0) + 1)
    return [...counts].map(([name, count]) => `${count}× ${name}`).join(', ')
}

class PushService {
    /** Push works when the installation has the VAPID keys and the venue has the function. */
    getConfig(ctx: VenueContext) {
        const on = enabled && ctx.features.has('push')
        return { enabled: on, publicKey: on ? config.push.publicKey : null }
    }

    // Preference and devices belong to the user (global tables): the same in every venue

    /** `null` when the user has never been asked. */
    async getPreference(ctx: VenueContext): Promise<boolean | null> {
        const row = await ctx.db.queryOne<{ push_orders: number | null }>('SELECT push_orders FROM users WHERE id = ?', [ctx.userId])
        return row?.push_orders === null || row?.push_orders === undefined ? null : !!row.push_orders
    }

    /** Turning notifications off removes them from every device of the user. */
    async setPreference(ctx: VenueContext, wanted: boolean): Promise<void> {
        await ctx.db.transaction(async tx => {
            await tx.execute('UPDATE users SET push_orders = ? WHERE id = ?', [wanted ? 1 : 0, ctx.userId])
            if (!wanted) await tx.execute('DELETE FROM push_subscriptions WHERE user_id = ?', [ctx.userId])
        })
    }

    /** Registers this device and turns the preference on. */
    async subscribe(ctx: VenueContext, subscription: PushSubscriptionInput, userAgent?: string): Promise<void> {
        const userId = ctx.userId
        await ctx.db.transaction(async tx => {
            await tx.execute(`
                INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent) VALUES (?,?,?,?,?)
                ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth), user_agent = VALUES(user_agent)`,
                [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, userAgent?.slice(0, 255)])
            await tx.execute('UPDATE users SET push_orders = 1 WHERE id = ?', [userId])
        })
    }

    async unsubscribe(ctx: VenueContext, endpoint: string): Promise<void> {
        await ctx.db.execute('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?', [ctx.userId, endpoint])
    }

    /**
     * Notifies the bartenders of the venue staffed on the event who want notifications, each one only about
     * the items of the destination they serve, and never whoever placed the order.
     * Never throws: a failed notification must not affect the order.
     */
    async notifyNewOrder(ctx: VenueContext, order: Order, tableName: string): Promise<void> {
        if (!enabled || !ctx.features.has('push')) return
        try {
            const items = (order.items || []).filter(i => !i.done)
            if (!items.length) return

            const recipients = await ctx.db.query<StoredSubscription>(`
                SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth, ue.destination_id
                FROM push_subscriptions ps
                INNER JOIN users u ON u.id = ps.user_id
                INNER JOIN user_event ue ON ue.venue_id = :venue AND ue.user_id = u.id AND ue.event_id = ?
                WHERE u.push_orders = 1 AND u.status = 'ACTIVE' AND u.id <> ?
                AND EXISTS (
                    SELECT 1 FROM user_role ur INNER JOIN roles r ON r.id = ur.role_id
                    WHERE ur.venue_id = :venue AND ur.user_id = u.id AND r.name = 'bartender'
                )`, [order.event_id, ctx.userId])
            // One notification per destination (null = every destination), with only its items
            const byDestination = new Map<number | null, StoredSubscription[]>()
            for (const r of recipients) byDestination.set(r.destination_id, [...(byDestination.get(r.destination_id) || []), r])
            await Promise.all([...byDestination].map(async ([destinationId, subscriptions]) => {
                const own = destinationId === null ? items : items.filter(i => i.destination_id === destinationId)
                if (!own.length) return
                await this.send(ctx.db, subscriptions, {
                    title: `Nuovo ordine · ${tableName}`,
                    body: summarize(own),
                    tag: `order-${order.id}`,
                    url: await this.bartenderUrl(ctx, own),
                    venueId: ctx.venueId,
                })
            }))
        } catch (error) {
            console.error('Push notification for new order failed', error)
        }
    }

    /** Bar screen of the order's destination, or the home page when it goes to several. */
    private async bartenderUrl(ctx: VenueContext, items: Item[]): Promise<string> {
        const ids = [...new Set(items.map(i => i.destination_id))]
        if (ids.length !== 1) return '/'
        const destination = await ctx.db.queryOne<{ id: number, name: string, minute_to_alert: number }>(
            'SELECT id, name, minute_to_alert FROM destinations WHERE venue_id = :venue AND id = ?', [ids[0]])
        return destination
            ? `/bartender/${destination.id}/${encodeURIComponent(destination.name)}/${destination.minute_to_alert}`
            : '/'
    }

    private async send(q: VenueDb, subscriptions: StoredSubscription[], payload: PushPayload): Promise<void> {
        const body = JSON.stringify(payload)
        await Promise.all(subscriptions.map(async s => {
            try {
                await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 300, urgency: 'high' })
            } catch (error: any) {
                // 404/410: the browser dropped the subscription (app uninstalled, permission revoked)
                if (error?.statusCode === 404 || error?.statusCode === 410) {
                    await q.execute('DELETE FROM push_subscriptions WHERE id = ?', [s.id])
                } else {
                    console.error('Push notification failed', error?.statusCode, error?.body || error?.message)
                }
            }
        }))
    }
}

export default new PushService()
