import db from "../db"
import { type PaymentProvider } from "../../../models/src"
import { getCurrentDateTimeInItaly } from "../utils/helper"

class PaymentProviderApi {
    constructor() {
    }

    async getAll(): Promise<PaymentProvider[]> {
        return await db.query("SELECT name, type, status FROM payment_providers")
    }

    async create(paymentProvider: PaymentProvider): Promise<number> {
        return await db.executeInsert(
            'INSERT INTO payment_providers (name, type, status, creation_date, access_info) VALUES (?,?,?,?,?)',
            [paymentProvider.name, paymentProvider.type, 'ACTIVE', getCurrentDateTimeInItaly(), paymentProvider.access_info])
    }
}

const paymentProviderApi = new PaymentProviderApi()
export default paymentProviderApi