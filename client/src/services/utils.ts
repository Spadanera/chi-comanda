import type { Item, AvailableTable, Order, Table, MasterItem } from "../../../models/src"

export function sortItem<T extends Item & MasterItem>(a: T, b: T): number {
    if (a.sub_type < b.sub_type) {
        return -1
    }
    if (a.sub_type > b.sub_type) {
        return 1
    }
    if (a.type < b.type) {
        return -1
    }
    if (a.type > b.type) {
        return 1
    }
    if (a.name < b.name) {
        return -1
    }
    if (a.name > b.name) {
        return 1
    }
    return 0
}

export function groupItems(orderItems: Item[]): Item[] {
    if (orderItems) {
        return orderItems.reduce((a: Item[], i: Item) => {
            let found = a.find((_i: Item) => (i.master_item_id === _i.master_item_id && i.note === _i.note && i.name === _i.name && i.price === _i.price))
            if (found) {
                found.quantity++
                found.grouped_ids.push(i.id)
            }
            else {
                i.quantity = 1
                i.grouped_ids = [i.id]
                a.push(i)
            }
            return a
        }, []).sort(sortItem)
    }
    else return []
}

export function copy<T>(input: T): T {
    return JSON.parse(JSON.stringify(input))
}

export function sortAvailableTable(a: AvailableTable, b: AvailableTable): number {
    const _a = a.table_name || a.master_table_name
    const _b = b.table_name || b.master_table_name
    const numRegex = /^\d+$/
    if (numRegex.test(_a)) {
        if (numRegex.test(_b)) {
            return parseInt(_a) - parseInt(_b)
        }
        else {
            return -1
        }
    }
    else {
        if (numRegex.test(_b)) {
            return 1
        }
        else {
            if (_a < _b) {
                return -1
            }
            else {
                return 1
            }
        }
    }
}

export function sortOrder(a: Order, b: Order): number {
    if (a.done) {
        if (b.done) {
            return b.id - a.id
        }
        else {
            return 1
        }
    }
    else if (b.done) {
        return -1
    }
    return a.id - b.id
}

export function sortTables(a: Table, b: Table): number {
    if (a.paid) {
        if (b.paid) {
            return a.id - b.id
        }
        else {
            return 1
        }
    }
    else if (b.paid) {
        return -1
    }
    return a.id - b.id
}

export const requiredRule = (value: any) => !!value || 'Inserire un valore'

export const requireRuleArray = (value: any) => {
    if (Array.isArray(value) && value.length === 0) {
        return 'Selezionare un elemento';
    }
    return true;
}

export const positiveIntegerRule = (value: any) => {
    if (isNaN(parseFloat(value)) || !Number.isInteger(Number(value)) || Number(value) <= 0) {
        return 'Inserire un numero intero positivo';
    }
    return true;
}

export const fileRequiredRule = (value: any) => {
    if (Array.isArray(value) && value.length === 0) {
        return 'Selezionare un file';
    }
    return true;
}

export const emailRule = (v: any) => /.+@.+\..+/.test(v) || 'Indirizzo email non valido'

export const passwordMatchRule = (comparison: any) => (v: any) => v === comparison || 'Le password devono essere uguali'

/** Current wall-clock time in Italy, as a UTC timestamp with the same digits (for differences only). */
function italianWallClockNow(): number {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date())
    const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(p => p.type === type)?.value)
    return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
}

/**
 * Minutes elapsed since `wallTime`, an Italian wall-clock time as stored by the server
 * (`YYYY-MM-DD HH:mm:ss`). Works whatever the device timezone is; returns -1 if unparsable.
 */
export function minutesSinceItalianTime(wallTime: string | undefined): number {
    const match = wallTime?.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/)
    if (!match) return -1
    const [year, month, day, hours, minutes, seconds] = match.slice(1).map(Number)
    const then = Date.UTC(year, month - 1, day, hours, minutes, seconds)
    return Math.max(0, Math.floor((italianWallClockNow() - then) / 60000))
}

export enum Roles {
    admin = 'admin',
    checkout = 'checkout',
    waiter = 'waiter',
    bartender = 'bartender',
    superuser = 'superuser',
    client = 'client'
}

/** Names of the roles shown to people (keep in sync with `ROLE_LABELS` in server/src/services/staff.ts). */
export const ROLE_LABELS: Record<string, string> = {
    [Roles.admin]: 'Amministratore',
    [Roles.checkout]: 'Cassiere',
    [Roles.waiter]: 'Cameriere',
    [Roles.bartender]: 'Barista',
    [Roles.client]: 'Cliente fedele',
    [Roles.superuser]: 'Amministratore della piattaforma',
}

/** The name of a role for people, never the system word. */
export function roleLabel(role: string): string {
    return ROLE_LABELS[role] || role
}

/** "Cameriere, Barista" */
export function roleLabels(roles: string[] | undefined): string {
    return (roles || []).map(roleLabel).join(', ')
}

/** True when the user has at least one of `allowed`. Superusers are always allowed. */
export function hasAnyRole(userRoles: string[] | undefined, allowed: Roles | Roles[]): boolean {
    const roles = userRoles || []
    const wanted = Array.isArray(allowed) ? allowed : [allowed]
    return roles.includes(Roles.superuser) || wanted.some(r => roles.includes(r))
}

/** Category icons: the Art Déco set drawn for food and drinks (see icons/deco.ts). */
export { CATEGORY_ICONS } from '@/icons/deco'