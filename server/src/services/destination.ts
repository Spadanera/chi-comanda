import db from '../db'
import { Destination } from '../../../models/src'

class DestinationService {
    getAll(): Promise<Destination[]> {
        return db.query(`
            SELECT id, name, status, minute_to_alert,
            (SELECT COUNT(id) FROM master_items WHERE destination_id = destinations.id) AS canDelete
            FROM destinations WHERE status = 'ACTIVE'`)
    }

    create(destination: Destination): Promise<number> {
        return db.insert(`INSERT INTO destinations (name, status, minute_to_alert) VALUES (?, 'ACTIVE', ?)`,
            [destination.name, destination.minute_to_alert])
    }

    update(destination: Destination): Promise<number> {
        return db.execute('UPDATE destinations SET name = ?, status = ?, minute_to_alert = ? WHERE id = ?',
            [destination.name, destination.status, destination.minute_to_alert, destination.id])
    }
}

export default new DestinationService()
