import db from "../db"
import { type PaymentProvider } from "../../../models/src"
import { getCurrentDateTimeInItaly } from "../utils/helper"

class PaymentProviderApi {
    constructor() {
    }

    async getAll(): Promise<PaymentProvider[]> {
        return await db.query(`
            SELECT id, display_name, type, status, is_default 
            FROM payment_providers 
            WHERE status != 'DELETED'
            ORDER BY is_default DESC, display_name
            `)
    }

    async create(paymentProvider: PaymentProvider): Promise<number> {
        const paymentProviders: PaymentProvider[] = await db.query('SELECT id FROM payment_providers WHERE status = "ACTIVE"')
        return await db.executeInsert(
            'INSERT INTO payment_providers (display_name, type, status, creation_date, is_default, access_info) VALUES (?,?,?,?,?,?)',
            [paymentProvider.name, paymentProvider.type, 'ACTIVE', getCurrentDateTimeInItaly(), paymentProviders.length === 0 ? true : false, paymentProvider.access_info])
    }

    async editStatus(paymentProvider: PaymentProvider): Promise<number> {
        return await db.executeUpdate('UPDATE payment_providers SET status = ? WHERE id = ?', [paymentProvider.status, paymentProvider.id])
    }

    async setAsDefault(id: number): Promise<number> {
        return await db.executeTransaction(
            [
                'UPDATE payment_providers SET is_default = false',
                'UPDATE payment_providers SET is_default = true WHERE id = ?'
            ],
            [
                [],
                [id]
            ])
    }
}

const paymentProviderApi = new PaymentProviderApi()
export default paymentProviderApi