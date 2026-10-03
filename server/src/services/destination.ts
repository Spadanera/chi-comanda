import { Destination } from '../../../models/src'
import { VenueContext } from '../venue/context'

class DestinationService {
    getAll(ctx: VenueContext): Promise<Destination[]> {
        return ctx.db.query(`
            SELECT id, name, status, minute_to_alert,
            (SELECT COUNT(id) FROM master_items WHERE master_items.venue_id = :venue AND destination_id = destinations.id) AS canDelete
            FROM destinations WHERE venue_id = :venue AND status = 'ACTIVE'`)
    }

    create(ctx: VenueContext, destination: Destination): Promise<number> {
        return ctx.db.insert(`INSERT INTO destinations (venue_id, name, status, minute_to_alert) VALUES (:venue, ?, 'ACTIVE', ?)`,
            [destination.name, destination.minute_to_alert])
    }

    update(ctx: VenueContext, destination: Destination): Promise<number> {
        return ctx.db.executeOne('UPDATE destinations SET name = ?, status = ?, minute_to_alert = ? WHERE venue_id = :venue AND id = ?',
            [destination.name, destination.status, destination.minute_to_alert, destination.id])
    }
}

export default new DestinationService()
