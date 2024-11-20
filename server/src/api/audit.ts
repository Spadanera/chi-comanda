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
        } catch (error:any) {
            console.log("Error inserting audit", error.message)
        }
    }
}

const auditApi = new AuditApi()
export default auditApi