import { placeholders } from '../db'
import { Item } from '../../../models/src'
import { BadRequestError, NotFoundError } from '../http/errors'
import { Feature } from '../features'
import { VenueDb } from '../venue/db'

/** Price of the PREMIUM version of a cocktail. The client shows the same value (WaiterOrder.vue). */
export const PREMIUM_PRICE = 9

interface MenuEntry {
    id: number
    name: string
    price: number
    destination_id: number
    sub_type_id: number
    sub_type: string
    type: string
    icon: string
    menu_id: number
    available: number
    status: string
}

/**
 * Rebuilds the items of an order with prices and names decided by the server:
 * - menu item (`master_item_id`): name, price, destination and category from the menu
 * - minimum consumption (`setMinimum`): the event's minimum consumption price
 * - PREMIUM cocktail (`premium`): the premium price
 * - off-menu item (no `master_item_id`): free price set by the waiter, validated
 * Only the note and the done/paid flags come from the client.
 */
export async function priceOrderItems(tx: VenueDb, features: ReadonlySet<Feature>, eventId: number, items: Item[]): Promise<Item[]> {
    const event = await tx.find<{ menu_id: number, minimumConsumptionPrice: number | null }>(
        'events', eventId, 'menu_id, minimumConsumptionPrice')

    const ids = [...new Set(items.map(i => Number(i.master_item_id)).filter(id => id > 0))]
    const menu = new Map<number, MenuEntry>()
    if (ids.length) {
        const rows = await tx.query<MenuEntry>(`
            SELECT master_items.id, master_items.name, master_items.price, master_items.destination_id,
                master_items.sub_type_id, master_items.menu_id, master_items.available, master_items.status,
                sub_types.name sub_type, sub_types.icon, types.name type
            FROM master_items
            INNER JOIN sub_types ON sub_types.venue_id = :venue AND sub_types.id = master_items.sub_type_id
            INNER JOIN types ON types.venue_id = :venue AND types.id = sub_types.type_id
            WHERE master_items.venue_id = :venue AND master_items.id IN (${placeholders(ids)})`, ids)
        rows.forEach(r => menu.set(r.id, r))
        // A product of another venue doesn't exist here: 404, like any other venue's id
        if (rows.length !== ids.length) throw new NotFoundError()
    }

    const destinations = new Set((await tx.query<{ id: number }>('SELECT id FROM destinations WHERE venue_id = :venue')).map(d => d.id))

    return items.map(item => {
        const common = {
            note: typeof item.note === 'string' ? item.note.slice(0, 255) : '',
            done: !!item.done,
            paid: !!item.paid,
            setMinimum: !!item.setMinimum,
        }

        const masterId = Number(item.master_item_id)
        if (masterId > 0) {
            const entry = menu.get(masterId)
            if (!entry || entry.menu_id !== event.menu_id || entry.status !== 'ACTIVE') {
                throw new BadRequestError(`Prodotto non presente nel menu della serata (${item.name || masterId})`)
            }
            if (!entry.available) {
                throw new BadRequestError(`«${entry.name}» non è più disponibile`)
            }
            if (item.setMinimum && !features.has('minimum-consumption')) {
                throw new BadRequestError('Consumazione minima non attiva')
            }
            if (item.premium && !features.has('premium')) {
                throw new BadRequestError('Versione PREMIUM non attiva')
            }
            let price = Number(entry.price)
            if (item.setMinimum) {
                if (event.minimumConsumptionPrice === null || event.minimumConsumptionPrice === undefined) {
                    throw new BadRequestError('La serata non ha una consumazione minima')
                }
                price = Number(event.minimumConsumptionPrice)
            } else if (item.premium) {
                price = PREMIUM_PRICE
            }
            return {
                ...common,
                master_item_id: entry.id,
                name: item.premium ? `${entry.name} - PREMIUM` : entry.name,
                price,
                destination_id: entry.destination_id,
                sub_type_id: entry.sub_type_id,
                type: entry.type,
                sub_type: entry.sub_type,
                icon: entry.icon,
            } as Item
        }

        // Off-menu item: the waiter sets name and price
        const name = typeof item.name === 'string' ? item.name.trim() : ''
        const price = Number(item.price)
        if (!name || name.length > 255) {
            throw new BadRequestError('Nome del prodotto fuori menu non valido')
        }
        if (item.price === null || item.price === undefined || !Number.isFinite(price) || price < 0) {
            throw new BadRequestError(`Prezzo non valido per «${name}»`)
        }
        if (!item.destination_id) {
            throw new BadRequestError(`Destinazione non valida per «${name}»`)
        }
        if (!destinations.has(Number(item.destination_id))) {
            throw new NotFoundError()
        }
        return {
            ...common,
            setMinimum: false,
            master_item_id: undefined,
            name,
            price,
            destination_id: Number(item.destination_id),
            type: typeof item.type === 'string' ? item.type : undefined,
            sub_type: typeof item.sub_type === 'string' ? item.sub_type : 'Fuori Menu',
            icon: typeof item.icon === 'string' ? item.icon : 'mdi-help-circle-outline',
        } as Item
    })
}
