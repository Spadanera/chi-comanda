import { describe, expect, it, vi } from 'vitest'

vi.mock('@/router', () => ({ default: { push: vi.fn() } }))
vi.mock('@/composables/useSocket', () => ({ recreateSocket: vi.fn() }))
vi.mock('@/composables/useConfig', () => ({ loadConfig: vi.fn() }))

import { ApiError } from '@/services/client'
import { dropExpectedErrors } from '@/services/monitoring'

describe('browser errors sent to Sentry', () => {
    const event = { message: 'x' }

    it('drops network errors and answers the user has seen', () => {
        expect(dropExpectedErrors(event, { originalException: new ApiError(0, 'Errore di connessione', '/orders') })).toBeNull()
        expect(dropExpectedErrors(event, { originalException: new ApiError(400, 'Tavolo già chiuso', '/tables/1/complete') })).toBeNull()
        expect(dropExpectedErrors(event, { originalException: new ApiError(401, 'Unauthorized', '/events') })).toBeNull()
    })

    it('keeps bugs and server errors', () => {
        expect(dropExpectedErrors(event, { originalException: new TypeError('undefined is not a function') })).toBe(event)
        expect(dropExpectedErrors(event, { originalException: new ApiError(500, 'Si è verificato un errore', '/orders') })).toBe(event)
        expect(dropExpectedErrors(event)).toBe(event)
    })
})
