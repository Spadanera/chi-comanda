import db from '../db'
import { Item, MasterItem, Menu, SubType, Type } from '../../../models/src'
import { ConflictError } from '../http/errors'

/** Menus, their products (master items) and the product categories (types / sub types). */
class CatalogueService {
    // ── Menus ────────────────────────────────────────────────────────────────

    getAllMenu(): Promise<Menu[]> {
        return db.query(`
            SELECT id, name, creation_date,
            (SELECT COUNT(id) FROM events WHERE events.menu_id = menu.id AND events.status IN ('PLANNED', 'ONGOING')) AS canDelete
            FROM menu`)
    }

    /** Creates a menu, optionally copying every product of the menu `from_id`. */
    createMenu(menu: Menu): Promise<number> {
        return db.transaction(async tx => {
            const menuId = await tx.insert(`INSERT INTO menu (name, creation_date, status) VALUES (?, NOW(), 'ACTIVE')`, [menu.name])
            if (menu.from_id) {
                await tx.execute(`
                    INSERT INTO master_items (name, sub_type_id, price, destination_id, available, status, menu_id)
                    SELECT name, sub_type_id, price, destination_id, available, status, ?
                    FROM master_items
                    WHERE menu_id = ?`, [menuId, menu.from_id])
            }
            return menuId
        })
    }

    editMenu(menu: Menu): Promise<number> {
        return db.execute('UPDATE menu SET name = ? WHERE id = ?', [menu.name, menu.id])
    }

    async deleteMenu(menuId: number): Promise<number> {
        const events = await db.query(`SELECT id FROM events WHERE menu_id = ? AND status IN ('ONGOING', 'PLANNED')`, [menuId])
        if (events.length) {
            throw new ConflictError('Impossibile eliminare il menu: ci sono eventi collegati')
        }
        return db.transaction(async tx => {
            await tx.execute('DELETE FROM master_items WHERE menu_id = ?', [menuId])
            return tx.execute('DELETE FROM menu WHERE id = ?', [menuId])
        })
    }

    // ── Products ─────────────────────────────────────────────────────────────

    getAll(menuId: number): Promise<Item[]> {
        return db.query(`
            SELECT master_items.*, destinations.name destination, sub_types.name sub_type, types.name type, sub_types.icon icon
            FROM master_items
            INNER JOIN destinations ON master_items.destination_id = destinations.id
            INNER JOIN sub_types ON master_items.sub_type_id = sub_types.id
            INNER JOIN types ON types.id = sub_types.type_id
            WHERE master_items.status = 'ACTIVE' AND master_items.menu_id = ?`, [menuId])
    }

    getAllAvailable(menuId: number): Promise<Item[]> {
        return db.query(`
            SELECT master_items.*, sub_types.name sub_type, types.name type, sub_types.icon icon
            FROM master_items
            INNER JOIN sub_types ON master_items.sub_type_id = sub_types.id
            INNER JOIN types ON types.id = sub_types.type_id
            WHERE available = TRUE AND status = 'ACTIVE' AND master_items.menu_id = ?`, [menuId])
    }

    create(item: MasterItem): Promise<number> {
        return db.insert(`
            INSERT INTO master_items (name, sub_type_id, price, destination_id, available, status, menu_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [item.name, item.sub_type_id, item.price, item.destination_id, item.available, item.status, item.menu_id])
    }

    update(item: MasterItem): Promise<number> {
        return db.execute(`
            UPDATE master_items SET name = ?, sub_type_id = ?, price = ?, destination_id = ?, available = ?, status = ?
            WHERE id = ?`,
            [item.name, item.sub_type_id, item.price, item.destination_id, item.available, item.status, item.id])
    }

    // ── Types ────────────────────────────────────────────────────────────────

    getTypes(): Promise<Type[]> {
        return db.query('SELECT types.*, (SELECT COUNT(id) FROM sub_types WHERE type_id = types.id) numProducts FROM types')
    }

    createType(type: Type): Promise<number> {
        return db.insert('INSERT INTO types (name, icon) VALUES (?,?)', [type.name, type.icon])
    }

    updateType(type: Type): Promise<number> {
        return db.execute('UPDATE types SET name = ?, icon = ? WHERE id = ?', [type.name, type.icon, type.id])
    }

    async deleteType(id: number): Promise<number> {
        const subTypes = await db.query('SELECT id FROM sub_types WHERE type_id = ?', [id])
        if (subTypes.length) {
            throw new ConflictError('Impossibile eliminare la tipologia: ci sono sottotipologie collegate')
        }
        return db.execute('DELETE FROM types WHERE id = ?', [id])
    }

    // ── Sub types ────────────────────────────────────────────────────────────

    getSubTypes(): Promise<SubType[]> {
        return db.query(`
            SELECT sub_types.*, types.name type,
            (SELECT COUNT(id) FROM master_items WHERE sub_type_id = sub_types.id) numProducts
            FROM sub_types
            INNER JOIN types ON types.id = sub_types.type_id`)
    }

    createSubType(subType: SubType): Promise<number> {
        return db.insert('INSERT INTO sub_types (name, type_id, icon) VALUES (?,?,?)', [subType.name, subType.type_id, subType.icon])
    }

    updateSubType(subType: SubType): Promise<number> {
        return db.execute('UPDATE sub_types SET name = ?, type_id = ?, icon = ? WHERE id = ?',
            [subType.name, subType.type_id, subType.icon, subType.id])
    }

    async deleteSubType(id: number): Promise<number> {
        const products = await db.query(`SELECT id FROM master_items WHERE sub_type_id = ? AND status = 'ACTIVE'`, [id])
        if (products.length) {
            throw new ConflictError('Impossibile eliminare la sottotipologia: ci sono prodotti collegati')
        }
        return db.execute('DELETE FROM sub_types WHERE id = ?', [id])
    }
}

export default new CatalogueService()
