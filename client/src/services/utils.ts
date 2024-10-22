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
            let found = a.find((_i: Item) => (i.master_item_id === _i.master_item_id && i.note === _i.note && i.name === _i.name))
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

export function getIcon(key: string): string {
    switch (key) {
        case "Birra":
            return "mdi-beer"
        case "Cocktail":
            return "mdi-glass-cocktail"
        case "Analcolico":
            return "mdi-glass-stange"
        case "Extra":
            return "mdi-glass-flute"
        case "Special":
            return "mdi-french-fries"
        case "Piadina":
            return "mdi-taco"
        case "Panino":
            return "mdi-food-hot-dog"
        case "Fuori Menu":
            return "mdi-help-circle-outline"
        case "Sconto":
            return "mdi-cart-percent"
        default:
            return "mdi-plus"
    }
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

export const emailRule = (v: any) => /.+@.+\..+/.test(v) || 'Indirizzo email non valido'

export const passwordMatchRule = (comparison: any) => (v:any) => v === comparison || 'Le password devono essere uguali'