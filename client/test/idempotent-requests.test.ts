import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/router', () => ({ default: { push: vi.fn(async () => undefined) } }))
vi.mock('@/composables/useSocket', () => ({ recreateSocket: vi.fn() }))
vi.mock('@/composables/useConfig', () => ({ loadConfig: vi.fn(async () => undefined) }))

import api, { ApiError, newIdempotencyKey } from '@/services/client'
import { SnackbarStore } from '@/stores'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const keysSent = (fetchMock: ReturnType<typeof vi.fn>) =>
    fetchMock.mock.calls.map(([, init]) => (init.headers as Record<string, string>)['Idempotency-Key'])

beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
})

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

describe('idempotent requests', () => {
    it('makes UUID v4 keys, also without crypto.randomUUID', () => {
        expect(newIdempotencyKey()).toMatch(UUID)
        const real = globalThis.crypto
        vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => real.getRandomValues(a) })
        expect(newIdempotencyKey()).toMatch(UUID)
    })

    it('retries a network error with the same key until it succeeds', async () => {
        const fetchMock = vi.fn()
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValueOnce(new Response('', { status: 502 }))
            .mockResolvedValueOnce(new Response('42', { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)

        const sent = api.CreateOrder({ event_id: 1, items: [] } as any)
        await vi.runAllTimersAsync()

        expect(await sent).toBe(42)
        const keys = keysSent(fetchMock)
        expect(keys).toHaveLength(3)
        expect(new Set(keys).size).toBe(1)
        expect(keys[0]).toMatch(UUID)
        // Nothing shown for the attempts that were retried
        expect(SnackbarStore().enable).toBe(false)
    })

    it('uses a new key for every action', async () => {
        const fetchMock = vi.fn(async () => new Response('1', { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)
        await api.CompleteTable(3)
        await api.CompleteTable(3)
        const [a, b] = keysSent(fetchMock)
        expect(a).not.toBe(b)
    })

    it('gives up after the retries and reports the network error', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
        const sent = api.PaySelectedItem(3, [1]).catch(e => e)
        await vi.runAllTimersAsync()
        const error = await sent
        expect(error).toBeInstanceOf(ApiError)
        expect(error.status).toBe(0)
        expect(SnackbarStore().text).toBe('Errore di connessione')
    })

    it('does not retry an answer of the server', async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: 'Tavolo già chiuso' }), { status: 400 }))
        vi.stubGlobal('fetch', fetchMock)
        const error = await api.CreateSumupPosSession({ table_id: 1, event_id: 1, amount: 1, item_ids: [], description: '' })
            .catch(e => e)
        expect(error.status).toBe(400)
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('lets the caller keep the key and handle the error', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
        const error = await api.CreateOrder({} as any, { key: 'k-1', retries: 0, report: false }).catch(e => e)
        expect(error.status).toBe(0)
        expect(SnackbarStore().enable).toBe(false)
    })
})
