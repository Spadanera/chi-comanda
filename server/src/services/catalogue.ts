import { Item, MasterItem, Menu, SubType, Type } from '../../../models/src'
import { ConflictError } from '../http/errors'
import { VenueContext } from '../venue/context'

/** Menus, their products (master items) and the product categories (types / sub types) of a venue. */
class CatalogueService {
    // ── Menus ────────────────────────────────────────────────────────────────

    getAllMenu(ctx: VenueContext): Promise<Menu[]> {
        return ctx.db.query(`
            SELECT id, name, creation_date,
            (SELECT COUNT(id) FROM events
             WHERE events.venue_id = :venue AND events.menu_id = menu.id AND events.status IN ('PLANNED', 'ONGOING')) AS canDelete
            FROM menu
            WHERE menu.venue_id = :venue`)
    }

    /** Creates a menu, optionally copying every product of the menu `from_id`. */
    async createMenu(ctx: VenueContext, menu: Menu): Promise<number> {
        if (menu.from_id) await ctx.db.find('menu', menu.from_id, 'id')
        return ctx.db.transaction(async tx => {
            const menuId = await tx.insert(`INSERT INTO menu (venue_id, name, creation_date, status) VALUES (:venue, ?, NOW(), 'ACTIVE')`,
                [menu.name])
            if (menu.from_id) {
                await tx.execute(`
                    INSERT INTO master_items (venue_id, name, sub_type_id, price, destination_id, available, status, menu_id)
                    SELECT :venue, name, sub_type_id, price, destination_id, available, status, ?
                    FROM master_items
                    WHERE venue_id = :venue AND menu_id = ?`, [menuId, menu.from_id])
            }
            return menuId
        })
    }

    editMenu(ctx: VenueContext, menu: Menu): Promise<number> {
        return ctx.db.executeOne('UPDATE menu SET name = ? WHERE venue_id = :venue AND id = ?', [menu.name, menu.id])
    }

    async deleteMenu(ctx: VenueContext, menuId: number): Promise<number> {
        await ctx.db.find('menu', menuId, 'id')
        const events = await ctx.db.query(`
            SELECT id FROM events WHERE venue_id = :venue AND menu_id = ? AND status IN ('ONGOING', 'PLANNED')`, [menuId])
        if (events.length) {
            throw new ConflictError('Impossibile eliminare il menu: ci sono eventi collegati')
        }
        return ctx.db.transaction(async tx => {
            await tx.execute('DELETE FROM master_items WHERE venue_id = :venue AND menu_id = ?', [menuId])
            return tx.execute('DELETE FROM menu WHERE venue_id = :venue AND id = ?', [menuId])
        })
    }

    // ── Products ─────────────────────────────────────────────────────────────

    async getAll(ctx: VenueContext, menuId: number): Promise<Item[]> {
        await ctx.db.find('menu', menuId, 'id')
        return ctx.db.query(`
            SELECT master_items.*, destinations.name destination, sub_types.name sub_type, types.name type, sub_types.icon icon
            FROM master_items
            INNER JOIN destinations ON destinations.venue_id = :venue AND master_items.destination_id = destinations.id
            INNER JOIN sub_types ON sub_types.venue_id = :venue AND master_items.sub_type_id = sub_types.id
            INNER JOIN types ON types.venue_id = :venue AND types.id = sub_types.type_id
            WHERE master_items.venue_id = :venue AND master_items.status = 'ACTIVE' AND master_items.menu_id = ?`, [menuId])
    }

    async getAllAvailable(ctx: VenueContext, menuId: number): Promise<Item[]> {
        await ctx.db.find('menu', menuId, 'id')
        return ctx.db.query(`
            SELECT master_items.*, sub_types.name sub_type, types.name type, sub_types.icon icon
            FROM master_items
            INNER JOIN sub_types ON sub_types.venue_id = :venue AND master_items.sub_type_id = sub_types.id
            INNER JOIN types ON types.venue_id = :venue AND types.id = sub_types.type_id
            WHERE master_items.venue_id = :venue AND available = TRUE AND status = 'ACTIVE' AND master_items.menu_id = ?`, [menuId])
    }

    /** The menu, sub type and destination of a product must be the venue's: 404 otherwise. */
    private async ensureReferences(ctx: VenueContext, item: MasterItem) {
        await ctx.db.ensure('sub_types', [item.sub_type_id])
        await ctx.db.ensure('destinations', [item.destination_id])
    }

    async create(ctx: VenueContext, item: MasterItem): Promise<number> {
        await ctx.db.find('menu', item.menu_id, 'id')
        await this.ensureReferences(ctx, item)
        return ctx.db.insert(`
            INSERT INTO master_items (venue_id, name, sub_type_id, price, destination_id, available, status, menu_id)
            VALUES (:venue, ?, ?, ?, ?, ?, ?, ?)`,
            [item.name, item.sub_type_id, item.price, item.destination_id, item.available, item.status, item.menu_id])
    }

    async update(ctx: VenueContext, item: MasterItem): Promise<number> {
        await this.ensureReferences(ctx, item)
        return ctx.db.executeOne(`
            UPDATE master_items SET name = ?, sub_type_id = ?, price = ?, destination_id = ?, available = ?, status = ?
            WHERE venue_id = :venue AND id = ?`,
            [item.name, item.sub_type_id, item.price, item.destination_id, item.available, item.status, item.id])
    }

    // ── Types ────────────────────────────────────────────────────────────────

    getTypes(ctx: VenueContext): Promise<Type[]> {
        return ctx.db.query(`
            SELECT types.*, (SELECT COUNT(id) FROM sub_types WHERE sub_types.venue_id = :venue AND type_id = types.id) numProducts
            FROM types
            WHERE types.venue_id = :venue`)
    }

    createType(ctx: VenueContext, type: Type): Promise<number> {
        return ctx.db.insert('INSERT INTO types (venue_id, name, icon) VALUES (:venue, ?, ?)', [type.name, type.icon])
    }

    updateType(ctx: VenueContext, type: Type): Promise<number> {
        return ctx.db.executeOne('UPDATE types SET name = ?, icon = ? WHERE venue_id = :venue AND id = ?', [type.name, type.icon, type.id])
    }

    async deleteType(ctx: VenueContext, id: number): Promise<number> {
        await ctx.db.find('types', id, 'id')
        const subTypes = await ctx.db.query('SELECT id FROM sub_types WHERE venue_id = :venue AND type_id = ?', [id])
        if (subTypes.length) {
            throw new ConflictError('Impossibile eliminare la tipologia: ci sono sottotipologie collegate')
        }
        return ctx.db.executeOne('DELETE FROM types WHERE venue_id = :venue AND id = ?', [id])
    }

    // ── Sub types ────────────────────────────────────────────────────────────

    getSubTypes(ctx: VenueContext): Promise<SubType[]> {
        return ctx.db.query(`
            SELECT sub_types.*, types.name type,
            (SELECT COUNT(id) FROM master_items WHERE master_items.venue_id = :venue AND sub_type_id = sub_types.id) numProducts
            FROM sub_types
            INNER JOIN types ON types.venue_id = :venue AND types.id = sub_types.type_id
            WHERE sub_types.venue_id = :venue`)
    }

    async createSubType(ctx: VenueContext, subType: SubType): Promise<number> {
        await ctx.db.find('types', subType.type_id, 'id')
        return ctx.db.insert('INSERT INTO sub_types (venue_id, name, type_id, icon) VALUES (:venue, ?, ?, ?)',
            [subType.name, subType.type_id, subType.icon])
    }

    async updateSubType(ctx: VenueContext, subType: SubType): Promise<number> {
        await ctx.db.find('types', subType.type_id, 'id')
        return ctx.db.executeOne('UPDATE sub_types SET name = ?, type_id = ?, icon = ? WHERE venue_id = :venue AND id = ?',
            [subType.name, subType.type_id, subType.icon, subType.id])
    }

    async deleteSubType(ctx: VenueContext, id: number): Promise<number> {
        await ctx.db.find('sub_types', id, 'id')
        const products = await ctx.db.query(`SELECT id FROM master_items WHERE venue_id = :venue AND sub_type_id = ? AND status = 'ACTIVE'`, [id])
        if (products.length) {
            throw new ConflictError('Impossibile eliminare la sottotipologia: ci sono prodotti collegati')
        }
        return ctx.db.executeOne('DELETE FROM sub_types WHERE venue_id = :venue AND id = ?', [id])
    }
}

export default new CatalogueService()
