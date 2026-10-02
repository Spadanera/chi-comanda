import https from 'https'
import db from '../db'
import { PaymentSetting, PaymentTransaction } from '../../../models/src'
import { SocketIOService } from '../socket'

// ---------------------------------------------------------------------------
// HTTP helper (native https, no extra deps)
// ---------------------------------------------------------------------------
function httpsRequest(
    url: string,
    options: { method: string; headers: Record<string, string>; body?: string }
): Promise<{ statusCode: number; data: any }> {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url)
        const reqOptions = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method,
            headers: {
                ...options.headers,
                ...(options.body ? { 'Content-Length': Buffer.byteLength(options.body).toString() } : {})
            }
        }
        const req = https.request(reqOptions, (res) => {
            let raw = ''
            res.on('data', (chunk) => (raw += chunk))
            res.on('end', () => {
                try {
                    resolve({ statusCode: res.statusCode || 0, data: JSON.parse(raw) })
                } catch {
                    resolve({ statusCode: res.statusCode || 0, data: raw })
                }
            })
        })
        req.on('error', reject)
        if (options.body) req.write(options.body)
        req.end()
    })
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
async function getConfig(provider: string): Promise<Record<string, string>> {
    const row = await db.queryOne<any>('SELECT enabled, config FROM payment_settings WHERE provider = ?', [provider])
    if (!row || !row.enabled) throw new Error(`Provider "${provider}" non configurato o non abilitato`)
    const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config
    return config as Record<string, string>
}

async function insertTransaction(
    provider: string,
    table_id: number,
    event_id: number,
    amount: number,
    currency: string,
    item_ids: number[],
    external_id: string | null,
    checkout_reference: string
): Promise<number> {
    return db.executeInsert(
        `INSERT INTO payment_transactions
            (table_id, event_id, provider, external_id, checkout_reference, amount, currency, status, item_ids)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
        [table_id, event_id, provider, external_id, checkout_reference, amount, currency, JSON.stringify(item_ids)]
    )
}

// ---------------------------------------------------------------------------
// PaymentApi class
// ---------------------------------------------------------------------------
class PaymentApi {

    // ── Settings ────────────────────────────────────────────────────────────

    async getSettings(): Promise<PaymentSetting[]> {
        const rows = await db.query<any>(
            `SELECT id, provider, enabled,
                (config IS NOT NULL AND JSON_LENGTH(config) > 0) AS configured
             FROM payment_settings`
        )
        return rows.map((r) => ({
            id: r.id,
            provider: r.provider,
            enabled: !!r.enabled,
            configured: !!r.configured
        })) as PaymentSetting[]
    }

    async getAvailableProviders(): Promise<PaymentSetting[]> {
        const rows = await db.query<any>(
            'SELECT provider, enabled FROM payment_settings WHERE enabled = 1'
        )
        return rows.map((r) => ({ provider: r.provider, enabled: true })) as PaymentSetting[]
    }

    async saveSettings(setting: PaymentSetting): Promise<number> {
        const existing = await db.queryOne<any>(
            'SELECT id FROM payment_settings WHERE provider = ?',
            [setting.provider]
        )
        const configJson = JSON.stringify(setting.config || {})
        if (existing && existing.id) {
            return db.executeUpdate(
                'UPDATE payment_settings SET enabled = ?, config = ? WHERE provider = ?',
                [setting.enabled ? 1 : 0, configJson, setting.provider]
            )
        }
        return db.executeInsert(
            'INSERT INTO payment_settings (provider, enabled, config) VALUES (?, ?, ?)',
            [setting.provider, setting.enabled ? 1 : 0, configJson]
        )
    }

    // ── Provider: sumup_checkout (link / QR code) ────────────────────────────

    async createCheckoutLink(
        table_id: number,
        event_id: number,
        amount: number,
        item_ids: number[],
        description: string
    ): Promise<PaymentTransaction> {
        const config = await getConfig('sumup_checkout')
        if (!config.api_key) throw new Error('API key SumUp mancante')

        const checkout_reference = `chicomanda-${table_id}-${Date.now()}`
        const currency = config.currency || 'EUR'

        const res = await httpsRequest('https://api.sumup.com/v0.1/checkouts', {
            method: 'POST',
            headers: { Authorization: `Bearer ${config.api_key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ checkout_reference, amount, currency, description })
        })

        if (res.statusCode !== 200 && res.statusCode !== 201) {
            throw new Error(`SumUp Checkout error: ${JSON.stringify(res.data)}`)
        }

        const txId = await insertTransaction(
            'sumup_checkout', table_id, event_id, amount, currency,
            item_ids, res.data.id, checkout_reference
        )

        return {
            id: txId, table_id, event_id, provider: 'sumup_checkout',
            external_id: res.data.id, checkout_reference, amount, currency,
            status: 'PENDING', item_ids,
            payment_url: `https://pay.sumup.com/b2c/${res.data.id}`
        } as PaymentTransaction
    }

    // ── Provider: sumup_pos (URL scheme → app SumUp su tablet) ──────────────

    async createPosSession(
        table_id: number,
        event_id: number,
        amount: number,
        item_ids: number[],
        description: string
    ): Promise<PaymentTransaction & { url_scheme: string }> {
        const config = await getConfig('sumup_pos')
        if (!config.affiliate_key) throw new Error('Affiliate key SumUp POS mancante')
        if (!config.server_url) throw new Error('URL server non configurato per SumUp POS')

        const checkout_reference = `chicomanda-pos-${table_id}-${Date.now()}`
        const currency = config.currency || 'EUR'

        const txId = await insertTransaction(
            'sumup_pos', table_id, event_id, amount, currency,
            item_ids, null, checkout_reference
        )

        // Callback che SumUp chiamerà dopo il pagamento
        const callbackUrl =
            `${config.server_url.replace(/\/$/, '')}/api/public/payment/sumup/pos-callback` +
            `?tx_id=${txId}`

        // URL scheme che apre l'app SumUp sul tablet
        const urlScheme =
            `sumupmerchant://pay` +
            `?affiliate-key=${encodeURIComponent(config.affiliate_key)}` +
            `&amount=${amount.toFixed(2)}` +
            `&currency=${currency}` +
            `&title=${encodeURIComponent(description)}` +
            `&callback=${encodeURIComponent(callbackUrl)}` +
            `&foreign-tx-id=${encodeURIComponent(checkout_reference)}`

        return {
            id: txId, table_id, event_id, provider: 'sumup_pos',
            checkout_reference, amount, currency, status: 'PENDING', item_ids,
            url_scheme: urlScheme
        } as PaymentTransaction & { url_scheme: string }
    }

    // Callback pubblico chiamato dall'app SumUp dopo il pagamento POS
    async handlePosCallback(tx_id: number, smpStatus: string, smpTxCode?: string): Promise<void> {
        const newStatus = smpStatus === 'success' ? 'PAID' : 'FAILED'

        await db.executeUpdate(
            'UPDATE payment_transactions SET status = ?, external_id = COALESCE(?, external_id) WHERE id = ?',
            [newStatus, smpTxCode || null, tx_id]
        )

        const tx = await db.queryOne<any>(
            'SELECT table_id, event_id FROM payment_transactions WHERE id = ?',
            [tx_id]
        )

        SocketIOService.instance().sendMessage({
            rooms: ['checkout'],
            event: 'payment-completed',
            body: { transaction_id: tx_id, table_id: tx?.table_id, status: newStatus }
        })
    }

    // ── Provider: sumup_solo (terminale standalone via REST API) ─────────────
    // Richiede accesso al programma partner SumUp POS.
    // Documentazione: https://developer.sumup.com/docs/terminal-payments

    async createSoloPayment(
        table_id: number,
        event_id: number,
        amount: number,
        item_ids: number[],
        description: string
    ): Promise<PaymentTransaction> {
        const config = await getConfig('sumup_solo')
        if (!config.api_key) throw new Error('API key SumUp Solo mancante')
        if (!config.reader_code) throw new Error('Codice reader SumUp Solo mancante')

        const checkout_reference = `chicomanda-solo-${table_id}-${Date.now()}`
        const currency = config.currency || 'EUR'

        // Step 1: crea il checkout
        const createRes = await httpsRequest('https://api.sumup.com/v0.1/checkouts', {
            method: 'POST',
            headers: { Authorization: `Bearer ${config.api_key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ checkout_reference, amount, currency, description })
        })

        if (createRes.statusCode !== 200 && createRes.statusCode !== 201) {
            throw new Error(`SumUp Solo checkout error: ${JSON.stringify(createRes.data)}`)
        }

        const checkoutId: string = createRes.data.id

        // Step 2: invia il checkout al terminale Solo
        const sendRes = await httpsRequest(
            `https://api.sumup.com/v0.1/readers/${encodeURIComponent(config.reader_code)}/checkouts`,
            {
                method: 'POST',
                headers: { Authorization: `Bearer ${config.api_key}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ checkout_reference })
            }
        )

        // 404 / errori specifici del reader vengono loggati ma non bloccano (il checkout rimane valido)
        if (sendRes.statusCode !== 200 && sendRes.statusCode !== 201 && sendRes.statusCode !== 204) {
            console.warn(`SumUp Solo send-to-reader warning (${sendRes.statusCode}):`, sendRes.data)
        }

        const txId = await insertTransaction(
            'sumup_solo', table_id, event_id, amount, currency,
            item_ids, checkoutId, checkout_reference
        )

        return {
            id: txId, table_id, event_id, provider: 'sumup_solo',
            external_id: checkoutId, checkout_reference, amount, currency,
            status: 'PENDING', item_ids
        } as PaymentTransaction
    }

    // ── Status check (usato da checkout link e solo; il POS usa socket) ──────

    async checkTransactionStatus(transaction_id: number): Promise<{ status: string }> {
        const tx = await db.queryOne<any>(
            'SELECT * FROM payment_transactions WHERE id = ?',
            [transaction_id]
        )
        if (!tx || !tx.id) throw new Error('Transazione non trovata')
        if (tx.status !== 'PENDING') return { status: tx.status }

        const config = await getConfig(tx.provider)

        const res = await httpsRequest(
            `https://api.sumup.com/v0.1/checkouts/${tx.checkout_reference}`,
            { method: 'GET', headers: { Authorization: `Bearer ${config.api_key}` } }
        )

        if (res.statusCode !== 200) throw new Error('Errore nel controllo stato SumUp')

        let newStatus = 'PENDING'
        const sumupStatus: string = res.data.status
        if (sumupStatus === 'PAID') newStatus = 'PAID'
        else if (['FAILED', 'EXPIRED', 'CANCELLED'].includes(sumupStatus)) newStatus = 'FAILED'

        if (newStatus !== 'PENDING') {
            await db.executeUpdate(
                'UPDATE payment_transactions SET status = ? WHERE id = ?',
                [newStatus, transaction_id]
            )
        }

        return { status: newStatus }
    }
}

const paymentApi = new PaymentApi()
export default paymentApi
