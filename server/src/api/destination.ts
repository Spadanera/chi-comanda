import db from "../db"
import { Destination } from "../../../models/src"

class DestinationApi {
    constructor() {
    }

    async getAll(): Promise<Destination[]> {
        return await db.query(`SELECT id, name, status,
            (SELECT COUNT(id) FROM master_items WHERE destination_id = destinations.id) AS canDelete 
            FROM destinations WHERE status = "ACTIVE"`
        , [])
    }

    async get(id: number): Promise<Destination> {
        return await db.queryOne('SELECT * FROM destinations WHERE ID = ?', [id])
    }

    async create(destination: Destination): Promise<number> {
        return await db.executeUpdate('INSERT INTO destinations (name, status) VALUES (?, "ACTIVE")'
            , [destination.name])
    }

    async update(destination: Destination): Promise<number> {
        return await db.executeUpdate('UPDATE destinations SET name = ?, status = ? WHERE id = ?'
            , [destination.name, destination.status, destination.id])
    }
}

const destinationApi = new DestinationApi()
export default destinationApi