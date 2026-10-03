import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** A socket.io socket stand-in: the test fires its events. */
class FakeSocket {
    handlers: Record<string, ((...args: unknown[]) => void)[]> = {}
    connected = false
    io = { engine: { close: vi.fn() } }
    on(event: string, handler: (...args: unknown[]) => void) {
        (this.handlers[event] ||= []).push(handler)
        return this
    }
    off() { return this }
    emit() { return this }
    connect() { return this }
    disconnect() { this.connected = false; return this }
    timeout() { return { emitWithAck: async () => 'ok' } }
    fire(event: string, ...args: unknown[]) {
        if (event === 'connect') this.connected = true
        if (event === 'disconnect') this.connected = false
        this.handlers[event]?.forEach(h => h(...args))
    }
}

let socket: FakeSocket
vi.mock('socket.io-client', () => ({ io: () => (socket = new FakeSocket()) }))

let mod: typeof import('@/composables/useSocket')

function setVisibility(state: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
    document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(async () => {
    vi.useFakeTimers()
    vi.resetModules()
    mod = await import('@/composables/useSocket')
    mod.useSocket()
})

afterEach(() => {
    mod.destroySocket()
    vi.useRealTimers()
})

describe('onResync', () => {
    it('does not run at the first connection, runs after a reconnection', async () => {
        const reload = vi.fn()
        mod.onResync(reload)
        socket.fire('connect')
        await vi.advanceTimersByTimeAsync(1000)
        expect(reload).not.toHaveBeenCalled()

        socket.fire('disconnect', 'transport close')
        socket.fire('connect')
        await vi.advanceTimersByTimeAsync(1000)
        expect(reload).toHaveBeenCalledTimes(1)
    })

    it('runs when the page becomes visible again, even with the socket still connected', async () => {
        const reload = vi.fn()
        mod.onResync(reload)
        socket.fire('connect')
        await vi.advanceTimersByTimeAsync(10000)

        setVisibility('hidden')
        setVisibility('visible')
        await vi.advanceTimersByTimeAsync(1000)
        expect(reload).toHaveBeenCalledTimes(1)
    })

    it('makes one reload of triggers close together, and not more often than every few seconds on visibility', async () => {
        const reload = vi.fn()
        mod.onResync(reload)
        socket.fire('connect')
        await vi.advanceTimersByTimeAsync(10000)

        // Wake-up: visible, then the socket reconnects
        setVisibility('visible')
        socket.fire('disconnect', 'transport close')
        socket.fire('connect')
        await vi.advanceTimersByTimeAsync(1000)
        expect(reload).toHaveBeenCalledTimes(1)

        // Back and forth between apps
        setVisibility('visible')
        await vi.advanceTimersByTimeAsync(1000)
        expect(reload).toHaveBeenCalledTimes(1)
        await vi.advanceTimersByTimeAsync(5000)
        setVisibility('visible')
        await vi.advanceTimersByTimeAsync(1000)
        expect(reload).toHaveBeenCalledTimes(2)
    })

    it('stops after unregistering, and a failing reload does not stop the others', async () => {
        const failing = vi.fn(async () => { throw new Error('offline') })
        const other = vi.fn()
        const stop = mod.onResync(failing)
        mod.onResync(other)
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        socket.fire('connect')
        socket.fire('disconnect', 'transport close')
        socket.fire('connect')
        await vi.advanceTimersByTimeAsync(1000)
        expect(failing).toHaveBeenCalledTimes(1)
        expect(other).toHaveBeenCalledTimes(1)

        stop()
        socket.fire('disconnect', 'transport close')
        socket.fire('connect')
        await vi.advanceTimersByTimeAsync(1000)
        expect(failing).toHaveBeenCalledTimes(1)
        expect(other).toHaveBeenCalledTimes(2)
        warn.mockRestore()
    })
})
