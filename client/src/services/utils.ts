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

export enum Roles {
    admin = 'admin',
    checkout = 'checkout',
    waiter = 'waiter',
    bartender = 'bartender',
    superuser = 'superuser',
    client = 'client'
}

export const icons = [
    "mdi-baguette",
    "mdi-barley",
    "mdi-beer",
    "mdi-beer-outline",
    "mdi-blender",
    "mdi-blender-outline",
    "mdi-bottle-soda",
    "mdi-bottle-soda-classic",
    "mdi-bottle-soda-outline",
    "mdi-bottle-wine",
    "mdi-bottle-wine-outline",
    "mdi-bowl",
    "mdi-bowl-mix",
    "mdi-bowl-mix-outline",
    "mdi-bowl-outline",
    "mdi-bread-slice",
    "mdi-bread-slice-outline",
    "mdi-cake",
    "mdi-cake-layered",
    "mdi-cake-variant",
    "mdi-cake-variant-outline",
    "mdi-candy",
    "mdi-candy-off",
    "mdi-candy-off-outline",
    "mdi-candy-outline",
    "mdi-candycane",
    "mdi-carrot",
    "mdi-cheese",
    "mdi-cheese-off",
    "mdi-chili-hot",
    "mdi-chili-medium",
    "mdi-chili-mild",
    "mdi-chili-off",
    "mdi-coffee",
    "mdi-coffee-maker",
    "mdi-coffee-maker-check",
    "mdi-coffee-maker-check-outline",
    "mdi-coffee-off",
    "mdi-coffee-off-outline",
    "mdi-coffee-outline",
    "mdi-coffee-to-go",
    "mdi-coffee-to-go-outline",
    "mdi-cookie",
    "mdi-cookie-alert",
    "mdi-cookie-alert-outline",
    "mdi-cookie-check",
    "mdi-cookie-check-outline",
    "mdi-cookie-clock",
    "mdi-cookie-clock-outline",
    "mdi-cookie-cog",
    "mdi-cookie-cog-outline",
    "mdi-cookie-edit",
    "mdi-cookie-edit-outline",
    "mdi-cookie-lock",
    "mdi-cookie-lock-outline",
    "mdi-cookie-minus",
    "mdi-cookie-minus-outline",
    "mdi-cookie-off",
    "mdi-cookie-off-outline",
    "mdi-cookie-outline",
    "mdi-cookie-plus",
    "mdi-cookie-plus-outline",
    "mdi-cookie-refresh",
    "mdi-cookie-refresh-outline",
    "mdi-cookie-remove",
    "mdi-cookie-remove-outline",
    "mdi-cookie-settings",
    "mdi-cookie-settings-outline",
    "mdi-corn",
    "mdi-corn-off",
    "mdi-cow-off",
    "mdi-cube-off-outline",
    "mdi-cube-outline",
    "mdi-cup",
    "mdi-cup-off",
    "mdi-cup-off-outline",
    "mdi-cup-outline",
    "mdi-cup-water",
    "mdi-cupcake",
    "mdi-egg",
    "mdi-egg-fried",
    "mdi-egg-off",
    "mdi-egg-off-outline",
    "mdi-egg-outline",
    "mdi-fish",
    "mdi-fish-off",
    "mdi-food",
    "mdi-food-apple",
    "mdi-food-apple-outline",
    "mdi-food-croissant",
    "mdi-food-drumstick",
    "mdi-food-drumstick-off",
    "mdi-food-drumstick-off-outline",
    "mdi-food-drumstick-outline",
    "mdi-food-fork-drink",
    "mdi-food-halal",
    "mdi-food-hot-dog",
    "mdi-food-kosher",
    "mdi-food-off",
    "mdi-food-off-outline",
    "mdi-food-outline",
    "mdi-food-steak",
    "mdi-food-steak-off",
    "mdi-food-takeout-box",
    "mdi-food-takeout-box-outline",
    "mdi-food-turkey",
    "mdi-food-variant",
    "mdi-food-variant-off",
    "mdi-french-fries",
    "mdi-fruit-cherries",
    "mdi-fruit-cherries-off",
    "mdi-fruit-citrus",
    "mdi-fruit-citrus-off",
    "mdi-fruit-grapes",
    "mdi-fruit-grapes-outline",
    "mdi-fruit-pear",
    "mdi-fruit-pineapple",
    "mdi-fruit-watermelon",
    "mdi-glass-cocktail",
    "mdi-glass-cocktail-off",
    "mdi-glass-flute",
    "mdi-glass-fragile",
    "mdi-glass-mug",
    "mdi-glass-mug-off",
    "mdi-glass-mug-variant",
    "mdi-glass-mug-variant-off",
    "mdi-glass-pint-outline",
    "mdi-glass-stange",
    "mdi-glass-tulip",
    "mdi-glass-wine",
    "mdi-grill",
    "mdi-grill-outline",
    "mdi-hamburger",
    "mdi-hamburger-check",
    "mdi-hamburger-minus",
    "mdi-hamburger-off",
    "mdi-hamburger-plus",
    "mdi-hamburger-remove",
    "mdi-hops",
    "mdi-ice-cream",
    "mdi-ice-cream-off",
    "mdi-ice-pop",
    "mdi-keg",
    "mdi-kettle",
    "mdi-kettle-alert",
    "mdi-kettle-alert-outline",
    "mdi-kettle-off",
    "mdi-kettle-off-outline",
    "mdi-kettle-outline",
    "mdi-kettle-steam",
    "mdi-kettle-steam-outline",
    "mdi-leaf",
    "mdi-leaf-off",
    "mdi-leek",
    "mdi-liquor",
    "mdi-microwave",
    "mdi-muffin",
    "mdi-mushroom",
    "mdi-mushroom-off",
    "mdi-mushroom-off-outline",
    "mdi-mushroom-outline",
    "mdi-noodles",
    "mdi-nutrition",
    "mdi-pasta",
    "mdi-peanut",
    "mdi-peanut-off",
    "mdi-peanut-off-outline",
    "mdi-peanut-outline",
    "mdi-pizza",
    "mdi-popcorn",
    "mdi-pot",
    "mdi-pot-mix",
    "mdi-pot-mix-outline",
    "mdi-pot-outline",
    "mdi-pot-steam",
    "mdi-pot-steam-outline",
    "mdi-pretzel",
    "mdi-rice",
    "mdi-sausage",
    "mdi-sausage-off",
    "mdi-scale",
    "mdi-seed",
    "mdi-seed-off",
    "mdi-seed-off-outline",
    "mdi-seed-outline",
    "mdi-shaker",
    "mdi-shaker-outline",
    "mdi-silverware",
    "mdi-silverware-clean",
    "mdi-silverware-fork",
    "mdi-silverware-fork-knife",
    "mdi-silverware-spoon",
    "mdi-silverware-variant",
    "mdi-soy-sauce",
    "mdi-spoon-sugar",
    "mdi-square-circle",
    "mdi-stove",
    "mdi-taco",
    "mdi-tea",
    "mdi-tea-outline",
    "mdi-toaster-oven",
    "mdi-water"
]