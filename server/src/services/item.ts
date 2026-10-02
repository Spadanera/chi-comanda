import db from '../db'
import { Item } from '../../../models/src'
import { notify } from '../socket'

class ItemService {
    async delete(id: number): Promise<number> {
        const result = await db.execute('DELETE FROM items WHERE id = ?', [id])
        notify.itemRemoved(id)
        return result
    }

    /** Updates done/paid flags; with `reopenTable` the item's table goes back to ACTIVE. */
    async update(item: Item, reopenTable = false): Promise<number> {
        const result = await db.execute('UPDATE items SET done = ?, paid = ? WHERE id = ?', [item.done, item.paid, item.id])
        if (reopenTable) {
            await db.execute(`UPDATE tables SET status = 'ACTIVE', paid = NULL WHERE id = ?`, [item.table_id])
        }
        notify.itemUpdated(item)
        return result
    }
}

export default new ItemService()
