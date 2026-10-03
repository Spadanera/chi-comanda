import { Item } from '../../../models/src'
import { notify } from '../socket'
import { VenueContext } from '../venue/context'

class ItemService {
    async delete(ctx: VenueContext, id: number): Promise<number> {
        const result = await ctx.db.executeOne('DELETE FROM items WHERE venue_id = :venue AND id = ?', [id])
        notify.itemRemoved(ctx.venueId, id)
        return result
    }

    /** Updates done/paid flags; with `reopenTable` the item's table goes back to ACTIVE. */
    async update(ctx: VenueContext, item: Item, reopenTable = false): Promise<number> {
        // The table comes from the stored item, never from the request
        const stored = await ctx.db.find<Item>('items', item.id, 'id, table_id')
        const result = await ctx.db.execute('UPDATE items SET done = ?, paid = ? WHERE venue_id = :venue AND id = ?',
            [item.done, item.paid, stored.id])
        if (reopenTable) {
            await ctx.db.execute(`UPDATE tables SET status = 'ACTIVE', paid = NULL WHERE venue_id = :venue AND id = ?`, [stored.table_id])
        }
        notify.itemUpdated(ctx.venueId, { ...item, table_id: stored.table_id })
        return result
    }
}

export default new ItemService()
