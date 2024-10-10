import type { Item, AvailableTable } from "../../../models/src"

export function sortItem(a: Item, b: Item): number {
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
            }
            else {
                i.quantity = 1
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
            return "mdi-food-hot-dog"
        case "Panino":
            return "mdi-food-hot-dog"
        default:
            return "mdi-plus"
    }
}

export function sortTable(a: AvailableTable, b: AvailableTable): number {
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