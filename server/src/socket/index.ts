import { Server, ServerOptions, Socket } from 'socket.io'
import { IncomingMessage, Server as HttpServer, ServerResponse } from 'http'
import { RequestHandler } from 'express'
import { Session, SessionData } from 'express-session'
import { Message, User } from '../../../models/src'
import { hasAnyRole, Roles } from '../http/middleware'

/** Rooms a client may join. Each screen of the app listens on its own room. */
export const ROOMS = ['main', 'waiter', 'bartender', 'checkout', 'table'] as const
export type Room = typeof ROOMS[number]

/**
 * Roles allowed in each room (superuser always passes); `null` means any logged user.
 * Keep in sync with the `allowedRole` of the client routes that join the room.
 */
const ROOM_ROLES: Record<Room, Roles[] | null> = {
    main: null,
    waiter: [Roles.waiter, Roles.checkout, Roles.bartender],
    table: [Roles.waiter, Roles.checkout],
    bartender: [Roles.bartender, Roles.waiter],
    checkout: [Roles.checkout],
}

type SessionRequest = IncomingMessage & {
    session?: Session & Partial<SessionData> & { passport?: { user?: User } }
}

let io: Server | undefined

const isRoom = (room: unknown): room is Room => (ROOMS as readonly unknown[]).includes(room)

/** Private room grouping the sockets opened with a given session, used to drop them on logout. */
const sessionRoom = (sessionId: string) => `session:${sessionId}`

export function canJoin(user: User | undefined, room: Room): boolean {
    if (!user) return false
    const roles = ROOM_ROLES[room]
    return roles === null || hasAnyRole(user, roles)
}

/**
 * The user logged in the session the socket was opened with. The session is reloaded from the
 * store on every call, so a logout or an expired session is noticed.
 */
function sessionUser(socket: Socket): Promise<User | undefined> {
    const req = socket.request as SessionRequest
    if (!req.session) return Promise.resolve(undefined)
    // reload() replaces req.session with a fresh object: read it again in the callback
    return new Promise(resolve => req.session!.reload(error => resolve(error ? undefined : req.session?.passport?.user)))
}

export function initializeSocket(httpServer: HttpServer, sessionMiddleware: RequestHandler, opts?: Partial<ServerOptions>): Server {
    io = new Server(httpServer, opts)
    // Share the express session, only on the handshake request (later polling requests carry a `sid`)
    io.engine.use((req: IncomingMessage & { _query?: { sid?: string } }, res: ServerResponse, next: (error?: unknown) => void) => {
        if (req._query?.sid === undefined) {
            sessionMiddleware(req as any, res as any, next)
        } else {
            next()
        }
    })
    io.on('connection', socket => {
        const sessionId = (socket.request as SessionRequest).session?.id
        if (sessionId) socket.join(sessionRoom(sessionId))
        socket.on('end', () => socket.disconnect())
        socket.on('join', async (room: unknown, ack?: unknown) => {
            const joined = isRoom(room) && canJoin(await sessionUser(socket), room)
            if (joined) socket.join(room)
            if (typeof ack === 'function') ack(joined)
        })
        socket.on('leave', (room: unknown) => {
            if (isRoom(room)) socket.leave(room)
        })
    })
    return io
}

/** Disconnects every socket opened with the given session (e.g. after logout). */
export function disconnectSession(sessionId: string) {
    io?.in(sessionRoom(sessionId)).disconnectSockets(true)
}

export function sendMessage(message: Message) {
    if (!io) {
        console.error('Socket server not initialized, dropping message', message.event)
        return
    }
    const rooms = message.rooms ?? (message.room ? [message.room] : [])
    for (const room of rooms) {
        io.to(room).emit(message.event, message.body)
    }
}

/** Typed notifications sent to the connected screens. */
export const notify = {
    tablesChanged(rooms: Room[] = ['waiter', 'bartender', 'table', 'checkout']) {
        sendMessage({ rooms, event: 'reload-table', body: {} })
    },
    eventsChanged() {
        sendMessage({ room: 'main', event: 'reload' })
    },
    broadcast(body: unknown) {
        sendMessage({ room: 'main', event: 'broadcast', body })
    },
    newOrder(order: unknown, table: unknown) {
        sendMessage({ room: 'bartender', event: 'new-order', body: order })
        sendMessage({ room: 'checkout', event: 'new-order', body: table })
    },
    orderCompleted(checkoutBody: unknown) {
        sendMessage({ room: 'checkout', event: 'order-completed', body: checkoutBody })
        sendMessage({ room: 'bartender', event: 'order-completed', body: {} })
    },
    itemUpdated(item: unknown) {
        sendMessage({ room: 'bartender', event: 'item-updated', body: item })
    },
    itemRemoved(itemId: number) {
        sendMessage({ rooms: ['bartender', 'checkout'], event: 'item-removed', body: itemId })
    },
    paymentCompleted(body: { transaction_id: number, table_id?: number, status: string }) {
        sendMessage({ room: 'checkout', event: 'payment-completed', body })
    },
}
