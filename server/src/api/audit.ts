import db from "../db"
import { Audit } from "../../../models/src"
import { getCurrentDateTimeInItaly } from "../utils/helper"

class AuditApi {
    constructor() {
    }

    async insert(audit: Audit): Promise<void> {
        try {
            await db.executeUpdate('INSERT INTO audit (user_id, method, path, data, dateTime) VALUES (?,?,?,?,?)'
                , [audit.user_id, audit.method, audit.path, audit.data, getCurrentDateTimeInItaly()])
        } catch (error: any) {
            console.error("Error inserting audit", error.message)
        }
    }

    async get(page: number, itemsPerPage: number, sortBy: string = 'dateTime', sortDir: string = 'desc'): Promise<{ data: Audit[], totalCount: number }> {
        sortDir = sortDir === 'asc' ? 'ASC' : 'DESC'
        if (sortBy === 'undefined' || sortBy === undefined || sortBy === null) {
            sortBy = 'dateTime'
        }
        const offset = (page - 1) * itemsPerPage
        const data = await db.query(`
            SELECT audit.id, users.id user_id, users.username, audit.method, audit.path, audit.dateTime, audit.data
            FROM audit
            INNER JOIN users ON users.id = audit.user_id
            ORDER BY ${sortBy} ${sortDir}
            LIMIT ${itemsPerPage} OFFSET ${offset};`,
            [itemsPerPage, offset])
        const totalCount = (await db.queryOne('SELECT COUNT(*) count FROM audit', []))

        return {
            data, totalCount: +totalCount.count
        }
    }
}

const auditApi = new AuditApi()
export default auditApi