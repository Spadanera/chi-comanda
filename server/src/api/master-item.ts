import db from "../db"
import { Item, MasterItem, Menu } from "../../../models/src"

class MasterItemsApi {
    constructor() {
    }

    async getAllMenu(): Promise<Menu[]> {
        return await db.query(`SELECT 
            id, name, creation_date, 
            (SELECT COUNT(id) FROM master_items WHERE menu_id = menu.id AND type = 'Bevanda') beverageCount,
            (SELECT COUNT(id) FROM master_items WHERE menu_id = menu.id AND type = 'Cibo') foodCount,
            (SELECT COUNT(id) FROM events WHERE events.menu_id = menu.id AND events.status IN ('PLANNED', 'ONGOING')) AS canDelete 
            FROM menu`, [])
    }

    async createMenu(menu: Menu): Promise<number> {
        const result = await db.executeInsert('INSERT INTO menu (name, creation_date, status) VALUES (?, NOW(), "ACTIVE")', [menu.name])
        if (menu.from_id) {
            await db.executeInsert(`INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status, menu_id)
                SELECT name, type, sub_type, price, destination_id, available, status, ?
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
        return await db.query(`SELECT master_items.*, destinations.name destination
            FROM master_items
            INNER JOIN destinations ON master_items.destination_id = destinations.id
            WHERE master_items.status = 'ACTIVE' AND master_items.menu_id = ?`
            , [menu_id])
    }

    async getAllAvailable(menu_id: number): Promise<Item[]> {
        return await db.query(`
            SELECT * FROM master_items WHERE available = TRUE AND status = "ACTIVE" AND master_items.menu_id = ?`, [menu_id])
    }

    async get(id: number): Promise<Item[]> {
        return await db.query('SELECT * FROM master_items WHERE ID = ?', [id])
    }

    async create(item: MasterItem): Promise<number> {
        return await db.executeInsert('INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status, menu_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            , [item.name, item.type, item.sub_type, item.price, item.destination_id, item.available, item.status, item.menu_id])
    }

    async delete(id: number): Promise<number> {
        return await db.executeUpdate('DELETE FROM master_items WHERE id = ?', [id])
    }

    async update(item: MasterItem): Promise<number> {
        return await db.executeUpdate('UPDATE master_items SET name = ?, type = ?, sub_type = ?, price = ?, destination_id = ?, available = ?, status = ? WHERE id = ?'
            , [item.name, item.type, item.sub_type, item.price, item.destination_id, item.available, item.status, item.id])
    }
}

const masterItemApi = new MasterItemsApi()
export default masterItemApi