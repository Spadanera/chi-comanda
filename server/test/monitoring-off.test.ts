import { describe, expect, it, vi } from 'vitest'
import * as Sentry from '@sentry/node'

vi.mock('@sentry/node', () => ({ init: vi.fn(), captureException: vi.fn(), flush: vi.fn() }))

describe('Sentry without SENTRY_DSN', () => {
    it('is never initialised and receives nothing', async () => {
        expect(process.env.SENTRY_DSN).toBeFalsy()
        const { initMonitoring, captureError, flushMonitoring } = await import('../src/monitoring')
        initMonitoring()
        captureError(new Error('boom'))
        await flushMonitoring()
        expect(Sentry.init).not.toHaveBeenCalled()
        expect(Sentry.captureException).not.toHaveBeenCalled()
        expect(Sentry.flush).not.toHaveBeenCalled()
    })
})
