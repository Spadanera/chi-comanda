import type { Item } from "../../../models/src"

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
            let found = a.find((_i:Item) => (i.master_item_id === _i.master_item_id && i.note === _i.note && i.name === _i.name))
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

export function copy<T>(input: T):T {
    return JSON.parse(JSON.stringify(input))
}

export function getIcon(key: string): string {
    switch (key) {
        case "BEER":
            return "mdi-beer"
        case "COCKTAIL":
            return "mdi-glass-cocktail"
        case "SOFT-DRINK":
            return "mdi-glass-stange"
        case "EXTRA":
            return "mdi-french-fries"
        case "SPIRIT":
            return "mdi-glass-tulip"
        case "PIADINA":
            return "mdi-food-hot-dog"
        case "PANINO":
            return "mdi-food-hot-dog"
        default:
            return "mdi-plus"
    }
}