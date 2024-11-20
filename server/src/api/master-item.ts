import db from "../db"
import { Item, MasterItem, Menu, Repository, SubType, Type } from "../../../models/src"

class MasterItemsApi {
    constructor() {
    }

    async getAllMenu(): Promise<Menu[]> {
        return await db.query(`SELECT 
            id, name, creation_date, 
            (SELECT COUNT(id) FROM events WHERE events.menu_id = menu.id AND events.status IN ('PLANNED', 'ONGOING')) AS canDelete 
            FROM menu`, [])
    }

    async createMenu(menu: Menu): Promise<number> {
        const result = await db.executeInsert('INSERT INTO menu (name, creation_date, status) VALUES (?, NOW(), "ACTIVE")', [menu.name])
        if (menu.from_id) {
            await db.executeInsert(`INSERT INTO master_items (name, sub_type_id, price, destination_id, available, status, menu_id)
                SELECT name, sub_type_id, price, destination_id, available, status, ?
                FROM master_items`, [result])
        }
        return result
    }

    async editMenu(menu: Menu): Promise<number> {
        return await db.executeUpdate('UPDATE menu SET name = ? WHERE id = ?', [menu.name, menu.id])
    }

    async deleteMenu(menu_id: number): Promise<number> {
        const events = await db.query("SELECT id FROM events WHERE menu_id = ? AND status IN ('ONGOING', 'PLANNED')", [menu_id])
        if (events.length) {
            throw new Error("Can't delete menu. Events connected")
        }
        return await db.executeTransaction([
            "DELETE FROM master_items WHERE menu_id = ?",
            "DELETE FROM menu WHERE id = ?"
        ], [
            [menu_id], [menu_id]
        ])
    }

    async getAll(menu_id: number): Promise<Item[]> {
        return await db.query(`SELECT master_items.*, destinations.name destination, sub_types.name sub_type, types.name type, sub_types.icon icon
            FROM master_items
            INNER JOIN destinations ON master_items.destination_id = destinations.id
            INNER JOIN sub_types ON master_items.sub_type_id = sub_types.id
            INNER JOIN types ON types.id = sub_types.type_id
            WHERE master_items.status = 'ACTIVE' AND master_items.menu_id = ?`
            , [menu_id])
    }

    async getAllAvailable(menu_id: number): Promise<Item[]> {
        return await db.query(`
            SELECT master_items.*, sub_types.name sub_type, types.name type, sub_types.icon icon
            FROM master_items 
            INNER JOIN sub_types ON master_items.sub_type_id = sub_types.id
            INNER JOIN types ON types.id = sub_types.type_id
            WHERE available = TRUE AND status = "ACTIVE" AND master_items.menu_id = ?`, [menu_id])
    }

    async get(id: number): Promise<Item[]> {
        return await db.query('SELECT * FROM master_items WHERE ID = ?', [id])
    }

    async create(item: MasterItem): Promise<number> {
        return await db.executeInsert('INSERT INTO master_items (name, sub_type_id, price, destination_id, available, status, menu_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
            , [item.name, item.sub_type_id, item.price, item.destination_id, item.available, item.status, item.menu_id])
    }

    async delete(id: number): Promise<number> {
        return await db.executeUpdate('DELETE FROM master_items WHERE id = ?', [id])
    }

    async update(item: MasterItem): Promise<number> {
        return await db.executeUpdate('UPDATE master_items SET name = ?, sub_type_id = ?, price = ?, destination_id = ?, available = ?, status = ? WHERE id = ?'
            , [item.name, item.sub_type_id, item.price, item.destination_id, item.available, item.status, item.id])
    }

    async getTypes(): Promise<Repository[]> {
        return await db.query<Repository>('SELECT types.*, (SELECT COUNT(id) FROM sub_types WHERE type_id = types.id) numProducts FROM types', [])
    }

    async createType(type: Type): Promise<number> {
        return await db.executeInsert('INSERT INTO types (name, icon) VALUES (?,?)', [type.name, type.icon])
    }

    async updateType(type: Type): Promise<number> {
        return await db.executeInsert('UPDATE types SET name = ?, icon = ? WHERE id = ?', [type.name, type.icon, type.id])
    }

    async deleteType(id: number): Promise<number> {
        if ((await db.query('SELECT id FROM sub_types WHERE type_id = ?', [id])).length === 0) {
            return await db.executeUpdate("DELETE FROM types WHERE id = ?", [id])
        }
        throw new Error(`Subtype connected. Can't delete type with id ${id}`)
    }

    async getSubTypes(): Promise<SubType[]> {
        return await db.query<SubType>(`SELECT sub_types.*, types.name type,
            (SELECT COUNT(id) FROM master_items WHERE sub_type_id = sub_types.id) numProducts
            FROM sub_types
            INNER JOIN types ON types.id = sub_types.type_id`
        , [])
    }

    async createSubTypes(sub_types: SubType): Promise<number> {
        return await db.executeInsert("INSERT INTO sub_types (name, type_id, icon) VALUES (?,?,?)", [sub_types.name, sub_types.type_id, sub_types.icon])
    }

    async updateSubTypes(sub_types: SubType): Promise<number> {
        return await db.executeUpdate("UPDATE sub_types SET name = ?, type_id = ?, icon = ? WHERE id = ?", [sub_types.name, sub_types.type_id, sub_types.icon, sub_types.id])
    }

    async deleteSubtypes(id: number): Promise<number> {
        if ((await db.query('SELECT id FROM master_items WHERE sub_type_id = ? AND status = "ACTIVE"', [id])).length === 0) {
            return await db.executeUpdate("DELETE FROM sub_types WHERE id = ?", [id])
        }
        throw new Error(`Master items connected. Can't delete type with id ${id}`)
    }
}

const masterItemApi = new MasterItemsApi()
export default masterItemApi