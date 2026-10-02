import crypto from 'crypto'
import db, { placeholders, Queryable } from '../db'
import config from '../config'
import { PaymentSetting, PaymentTransaction } from '../../../models/src'
import { notify } from '../socket'
import tableService from './table'
import { BadRequestError, ForbiddenError, HttpError, NotFoundError } from '../http/errors'

const SUMUP_API = 'https://api.sumup.com/v0.1'

export type PaymentProvider = 'sumup_checkout' | 'sumup_pos' | 'sumup_solo'
export const PAYMENT_PROVIDERS: PaymentProvider[] = ['sumup_checkout', 'sumup_pos', 'sumup_solo']

export interface PaymentRequest {
    table_id: number
    event_id: number
    amount: number
    item_ids: number[]
    description: string
}

/** `full` closes the table, `partial` pays only the chosen items. */
export type PaymentMode = 'full' | 'partial'

/** What a transaction pays, fixed when it is created. */
interface PreparedPayment {
    itemIds: number[]
    mode: PaymentMode
}

interface TransactionRow {
    id: number
    table_id: number
    event_id: number
    amount: string | number
    status: string
    mode: PaymentMode
    item_ids: string | number[] | null
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Fixes the items a payment covers and checks the amount: partial payments cover the chosen
 * items (unpaid, of this table), full payments every item unpaid right now. The amount may be
 * lower than the total (a discount) but not higher.
 */
async function preparePayment(req: PaymentRequest): Promise<PreparedPayment> {
    const table = await db.queryOne<{ status: string }>('SELECT status FROM tables WHERE id = ? AND event_id = ?', [req.table_id, req.event_id])
    if (!table || table.status !== 'ACTIVE') {
        throw new BadRequestError('Tavolo non trovato o già chiuso')
    }
    const unpaid = await tableService.unpaidItems(req.table_id)
    const mode: PaymentMode = req.item_ids.length ? 'partial' : 'full'
    const covered = mode === 'partial' ? unpaid.filter(i => req.item_ids.includes(i.id)) : unpaid
    if (mode === 'partial' && covered.length !== new Set(req.item_ids).size) {
        throw new BadRequestError('Alcuni prodotti non sono di questo tavolo o sono già pagati')
    }
    if (!covered.length) {
        throw new BadRequestError('Non c\'è niente da pagare')
    }
    const due = round2(covered.reduce((sum, i) => sum + Number(i.price), 0))
    if (req.amount > due + 0.001) {
        throw new BadRequestError(`L'importo supera il totale da pagare (${due.toFixed(2)} €)`)
    }
    return { itemIds: covered.map(i => i.id), mode }
}

/**
 * Applies a confirmed payment inside the caller's transaction: pays the covered items still
 * unpaid, records the difference with the amount as a discount, and closes the table for a
 * full payment when nothing else is left to pay (items ordered meanwhile stay to be paid).
 */
async function settle(q: Queryable, tx: TransactionRow): Promise<void> {
    const itemIds: number[] = (typeof tx.item_ids === 'string' ? JSON.parse(tx.item_ids) : tx.item_ids) || []
    const items = itemIds.length
        ? await q.query<{ id: number, price: number }>(
            `SELECT id, price FROM items WHERE table_id = ? AND id IN (${placeholders(itemIds)}) AND IFNULL(paid, FALSE) = FALSE`,
            [tx.table_id, ...itemIds])
        : []
    const due = round2(items.reduce((sum, i) => sum + Number(i.price), 0))
    const discount = round2(due - Number(tx.amount))
    if (items.length && discount > 0) {
        await tableService.insertDiscount(tx.event_id, tx.table_id, discount, q)
    }
    await tableService.paySelectedItems(tx.table_id, items.map(i => i.id), q)
    if (tx.mode === 'full' && !(await tableService.unpaidItems(tx.table_id, q)).length) {
        await tableService.closeWith(q, tx.table_id)
    }
}

async function sumupRequest(path: string, apiKey: string, method: 'GET' | 'POST', body?: unknown) {
    const res = await fetch(`${SUMUP_API}${path}`, {
        method,
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    let data: any = text
    try { data = JSON.parse(text) } catch { /* not JSON */ }
    return { status: res.status, ok: res.ok, data }
}

async function getProviderConfig(provider: string): Promise<Record<string, string>> {
    const row = await db.queryOne<{ enabled: number, config: unknown }>(
        'SELECT enabled, config FROM payment_settings WHERE provider = ?', [provider])
    if (!row || !row.enabled) {
        throw new BadRequestError(`Provider "${provider}" non configurato o non abilitato`)
    }
    return (typeof row.config === 'string' ? JSON.parse(row.config) : row.config) as Record<string, string>
}

function insertTransaction(provider: PaymentProvider, req: PaymentRequest, prepared: PreparedPayment, currency: string,
    externalId: string | null, checkoutReference: string): Promise<number> {
    return db.insert(`
        INSERT INTO payment_transactions
            (table_id, event_id, provider, external_id, checkout_reference, amount, currency, status, item_ids, mode)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
        [req.table_id, req.event_id, provider, externalId, checkoutReference, req.amount, currency,
            JSON.stringify(prepared.itemIds), prepared.mode])
}

/** Signature that authenticates the public POS callback for a given transaction. */
function signTransaction(transactionId: number): string {
    return crypto.createHmac('sha256', config.sessionSecret).update(`sumup-pos:${transactionId}`).digest('hex')
}

function isValidSignature(transactionId: number, signature: string): boolean {
    const expected = Buffer.from(signTransaction(transactionId))
    const given = Buffer.from(signature || '')
    return expected.length === given.length && crypto.timingSafeEqual(expected, given)
}

class PaymentService {
    // ── Settings ─────────────────────────────────────────────────────────────

    /** Provider settings for the admin page. Secrets in `config` are never returned. */
    async getSettings(): Promise<PaymentSetting[]> {
        const rows = await db.query(`
            SELECT id, provider, enabled, (config IS NOT NULL AND JSON_LENGTH(config) > 0) AS configured
            FROM payment_settings`)
        return rows.map(r => ({ id: r.id, provider: r.provider, enabled: !!r.enabled, configured: !!r.configured })) as PaymentSetting[]
    }

    async getAvailableProviders(): Promise<PaymentSetting[]> {
        const rows = await db.query('SELECT provider FROM payment_settings WHERE enabled = 1')
        return rows.map(r => ({ provider: r.provider, enabled: true })) as PaymentSetting[]
    }

    async saveSettings(setting: PaymentSetting): Promise<number> {
        if (!PAYMENT_PROVIDERS.includes(setting.provider as PaymentProvider)) {
            throw new BadRequestError('Provider sconosciuto')
        }
        return db.execute(`
            INSERT INTO payment_settings (provider, enabled, config) VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), config = VALUES(config)`,
            [setting.provider, setting.enabled ? 1 : 0, JSON.stringify(setting.config || {})])
    }

    // ── sumup_checkout: payment link / QR code ───────────────────────────────

    async createCheckoutLink(req: PaymentRequest): Promise<PaymentTransaction> {
        const prepared = await preparePayment(req)
        const providerConfig = await getProviderConfig('sumup_checkout')
        if (!providerConfig.api_key) throw new BadRequestError('API key SumUp mancante')

        const checkoutReference = `chicomanda-${req.table_id}-${Date.now()}`
        const currency = providerConfig.currency || 'EUR'
        const res = await sumupRequest('/checkouts', providerConfig.api_key, 'POST', {
            checkout_reference: checkoutReference, amount: req.amount, currency, description: req.description,
        })
        if (!res.ok) {
            throw new HttpError(502, `SumUp Checkout error: ${JSON.stringify(res.data)}`)
        }

        const id = await insertTransaction('sumup_checkout', req, prepared, currency, res.data.id, checkoutReference)
        return {
            id, table_id: req.table_id, event_id: req.event_id, provider: 'sumup_checkout',
            external_id: res.data.id, checkout_reference: checkoutReference, amount: req.amount, currency,
            status: 'PENDING', item_ids: prepared.itemIds,
            payment_url: `https://pay.sumup.com/b2c/${res.data.id}`,
        } as PaymentTransaction
    }

    // ── sumup_pos: URL scheme opening the SumUp app on the tablet ────────────

    async createPosSession(req: PaymentRequest): Promise<PaymentTransaction & { url_scheme: string }> {
        const prepared = await preparePayment(req)
        const providerConfig = await getProviderConfig('sumup_pos')
        if (!providerConfig.affiliate_key) throw new BadRequestError('Affiliate key SumUp POS mancante')
        if (!providerConfig.server_url) throw new BadRequestError('URL server non configurato per SumUp POS')

        const checkoutReference = `chicomanda-pos-${req.table_id}-${Date.now()}`
        const currency = providerConfig.currency || 'EUR'
        const id = await insertTransaction('sumup_pos', req, prepared, currency, null, checkoutReference)

        // SumUp calls this back (appending smp-status / smp-tx-code) once the payment ends
        const callback = new URL(`${providerConfig.server_url.replace(/\/$/, '')}/api/public/payment/sumup/pos-callback`)
        callback.searchParams.set('tx_id', String(id))
        callback.searchParams.set('sig', signTransaction(id))

        const query: Record<string, string> = {
            'affiliate-key': providerConfig.affiliate_key,
            amount: req.amount.toFixed(2),
            currency,
            title: req.description,
            callback: callback.toString(),
            'foreign-tx-id': checkoutReference,
        }
        // encodeURIComponent (not URLSearchParams) so spaces become %20, as the SumUp app expects
        const urlScheme = 'sumupmerchant://pay?' + Object.entries(query)
            .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')

        return {
            id, table_id: req.table_id, event_id: req.event_id, provider: 'sumup_pos',
            checkout_reference: checkoutReference, amount: req.amount, currency, status: 'PENDING', item_ids: prepared.itemIds,
            url_scheme: urlScheme,
        } as PaymentTransaction & { url_scheme: string }
    }

    /** Public callback invoked by the SumUp app. Only signed, still pending transactions are updated. */
    async handlePosCallback(transactionId: number, signature: string, smpStatus: string, smpTxCode?: string): Promise<void> {
        if (!isValidSignature(transactionId, signature)) {
            throw new ForbiddenError('Firma non valida')
        }
        if (smpStatus === 'success') {
            await this.markPaid(transactionId, smpTxCode)
        } else {
            await this.markFailed(transactionId)
        }
    }

    /**
     * PENDING -> PAID and settlement of the table in one transaction. The conditional update is
     * the lock: when the callback and the polling (or two callbacks) arrive together, only the
     * first one settles. Returns false when the transaction was not pending any more.
     */
    private async markPaid(transactionId: number, externalId?: string): Promise<boolean> {
        const row = await db.transaction(async q => {
            const updated = await q.execute(`
                UPDATE payment_transactions SET status = 'PAID', external_id = COALESCE(?, external_id)
                WHERE id = ? AND status = 'PENDING'`, [externalId || null, transactionId])
            if (!updated) return undefined
            const tx = await q.queryOne<TransactionRow>('SELECT * FROM payment_transactions WHERE id = ?', [transactionId])
            await settle(q, tx!)
            return tx
        })
        if (!row) return false
        notify.tablesChanged(['waiter', 'table', 'checkout'])
        notify.paymentCompleted({ transaction_id: transactionId, table_id: row.table_id, status: 'PAID' })
        return true
    }

    private async markFailed(transactionId: number): Promise<void> {
        const updated = await db.execute(`UPDATE payment_transactions SET status = 'FAILED' WHERE id = ? AND status = 'PENDING'`, [transactionId])
        if (!updated) return
        const tx = await db.queryOne<{ table_id: number }>('SELECT table_id FROM payment_transactions WHERE id = ?', [transactionId])
        notify.paymentCompleted({ transaction_id: transactionId, table_id: tx?.table_id, status: 'FAILED' })
    }

    // ── sumup_solo: standalone card terminal (requires SumUp partner access) ──
    // https://developer.sumup.com/docs/terminal-payments

    async createSoloPayment(req: PaymentRequest): Promise<PaymentTransaction> {
        const prepared = await preparePayment(req)
        const providerConfig = await getProviderConfig('sumup_solo')
        if (!providerConfig.api_key) throw new BadRequestError('API key SumUp Solo mancante')
        if (!providerConfig.reader_code) throw new BadRequestError('Codice reader SumUp Solo mancante')

        const checkoutReference = `chicomanda-solo-${req.table_id}-${Date.now()}`
        const currency = providerConfig.currency || 'EUR'

        const created = await sumupRequest('/checkouts', providerConfig.api_key, 'POST', {
            checkout_reference: checkoutReference, amount: req.amount, currency, description: req.description,
        })
        if (!created.ok) {
            throw new HttpError(502, `SumUp Solo checkout error: ${JSON.stringify(created.data)}`)
        }
        const checkoutId: string = created.data.id

        const sent = await sumupRequest(`/readers/${encodeURIComponent(providerConfig.reader_code)}/checkouts`,
            providerConfig.api_key, 'POST', { checkout_reference: checkoutReference })
        // Reader errors are not fatal: the checkout stays valid and can still be paid
        if (!sent.ok) {
            console.warn(`SumUp Solo send-to-reader warning (${sent.status}):`, sent.data)
        }

        const id = await insertTransaction('sumup_solo', req, prepared, currency, checkoutId, checkoutReference)
        return {
            id, table_id: req.table_id, event_id: req.event_id, provider: 'sumup_solo',
            external_id: checkoutId, checkout_reference: checkoutReference, amount: req.amount, currency,
            status: 'PENDING', item_ids: prepared.itemIds,
        } as PaymentTransaction
    }

    // ── Status polling (checkout link and Solo; POS is notified via socket) ──

    async checkTransactionStatus(transactionId: number): Promise<{ status: string }> {
        const tx = await db.queryOne('SELECT * FROM payment_transactions WHERE id = ?', [transactionId])
        if (!tx) throw new NotFoundError('Transazione non trovata')
        if (tx.status !== 'PENDING' || !tx.external_id) return { status: tx.status }

        const providerConfig = await getProviderConfig(tx.provider)
        const res = await sumupRequest(`/checkouts/${encodeURIComponent(tx.external_id)}`, providerConfig.api_key, 'GET')
        if (!res.ok) throw new HttpError(502, 'Errore nel controllo stato SumUp')

        const sumupStatus: string = res.data.status
        if (sumupStatus === 'PAID') {
            await this.markPaid(transactionId)
            return { status: 'PAID' }
        }
        if (['FAILED', 'EXPIRED', 'CANCELLED'].includes(sumupStatus)) {
            await this.markFailed(transactionId)
            return { status: 'FAILED' }
        }
        return { status: 'PENDING' }
    }
}

export default new PaymentService()
