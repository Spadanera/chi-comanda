import { Server, ServerOptions, Socket } from 'socket.io'
import { IncomingMessage, Server as HttpServer, ServerResponse } from 'http'
import { RequestHandler } from 'express'
import { Session, SessionData } from 'express-session'
import { Message, User } from '../../../models/src'
import { Request } from 'express'
import { hasAnyRole, Roles } from '../http/middleware'
import { loadSessionUser } from '../auth/passport'

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
    session?: Session & Partial<SessionData> & { passport?: { user?: unknown } }
}

let io: Server | undefined

const isRoom = (room: unknown): room is Room => (ROOMS as readonly unknown[]).includes(room)

/** Private room grouping the sockets opened with a given session, used to drop them on logout. */
const sessionRoom = (sessionId: string) => `session:${sessionId}`

/** Private room grouping the sockets of a user, used to drop them when their roles change. */
const userRoom = (userId: number) => `user:${userId}`

/** The room of a screen in a venue: clients name the screen only, the venue comes from the session. */
export const venueRoom = (venueId: number, room: Room) => `venue:${venueId}:${room}`

export function canJoin(user: User | undefined, room: Room): boolean {
    if (!user?.venueId) return false
    const roles = ROOM_ROLES[room]
    return roles === null || hasAnyRole(user, roles)
}

/**
 * The user logged in the session the socket was opened with, with the roles held now. The session is reloaded from
 * the store on every call, so a logout, an expired session or a role change is noticed.
 */
async function sessionUser(socket: Socket): Promise<User | undefined> {
    const req = socket.request as SessionRequest
    if (!req.session) return undefined
    // reload() replaces req.session with a fresh object: read it again in the callback
    const reloaded = await new Promise<boolean>(resolve => req.session!.reload(error => resolve(!error)))
    const stored = req.session?.passport?.user
    if (!reloaded || stored === undefined) return undefined
    return loadSessionUser(req as unknown as Request, stored).catch(() => undefined)
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
        socket.on('join', async (room: unknown, ack?: unknown) => {
            const user = isRoom(room) ? await sessionUser(socket) : undefined
            const joined = isRoom(room) && canJoin(user, room)
            if (joined) {
                socket.join([venueRoom(user!.venueId!, room), userRoom(Number(user!.id))])
            }
            if (typeof ack === 'function') ack(joined)
        })
        // Liveness check sent by clients when the screen turns back on
        socket.on('alive', (ack?: unknown) => {
            if (typeof ack === 'function') ack()
        })
        socket.on('leave', (room: unknown) => {
            if (!isRoom(room)) return
            for (const joined of [...socket.rooms].filter(r => r.startsWith('venue:') && r.endsWith(`:${room}`))) {
                socket.leave(joined)
            }
        })
    })
    return io
}

/** Disconnects every client, e.g. on shutdown: they reconnect on their own to the next instance. */
export function disconnectAll() {
    io?.disconnectSockets(true)
}

/** Disconnects every socket opened with the given session (e.g. after logout or a venue switch). */
export function disconnectSession(sessionId: string) {
    io?.in(sessionRoom(sessionId)).disconnectSockets(true)
}

/**
 * Disconnects the sockets of a user whose roles or account changed: they reconnect and join again with the roles held
 * now, so a revoked role stops the messages at once.
 */
export function disconnectUser(userId: number) {
    io?.in(userRoom(userId)).disconnectSockets(true)
}

/** Disconnects every socket in a venue (e.g. the venue was disabled). */
export function disconnectVenue(venueId: number) {
    io?.in(ROOMS.map(room => venueRoom(venueId, room))).disconnectSockets(true)
}

/** Sends to the screens of one venue: a message can't reach another venue. */
export function sendMessage(venueId: number, message: Message) {
    if (!io) {
        console.error('Socket server not initialized, dropping message', message.event)
        return
    }
    const rooms = (message.rooms ?? (message.room ? [message.room] : [])) as Room[]
    for (const room of rooms) {
        io.to(venueRoom(venueId, room)).emit(message.event, message.body)
    }
}

/** Typed notifications sent to the connected screens of a venue. */
export const notify = {
    tablesChanged(venueId: number, rooms: Room[] = ['waiter', 'bartender', 'table', 'checkout']) {
        sendMessage(venueId, { rooms, event: 'reload-table', body: {} })
    },
    eventsChanged(venueId: number) {
        sendMessage(venueId, { room: 'main', event: 'reload' })
    },
    broadcast(venueId: number, body: unknown) {
        sendMessage(venueId, { room: 'main', event: 'broadcast', body })
    },
    newOrder(venueId: number, order: unknown, table: unknown) {
        sendMessage(venueId, { room: 'bartender', event: 'new-order', body: order })
        sendMessage(venueId, { room: 'checkout', event: 'new-order', body: table })
    },
    orderCompleted(venueId: number, checkoutBody: unknown) {
        sendMessage(venueId, { room: 'checkout', event: 'order-completed', body: checkoutBody })
        sendMessage(venueId, { room: 'bartender', event: 'order-completed', body: {} })
    },
    itemUpdated(venueId: number, item: unknown) {
        sendMessage(venueId, { room: 'bartender', event: 'item-updated', body: item })
    },
    itemRemoved(venueId: number, itemId: number) {
        sendMessage(venueId, { rooms: ['bartender', 'checkout'], event: 'item-removed', body: itemId })
    },
    paymentCompleted(venueId: number, body: { transaction_id: number, table_id?: number, status: string }) {
        sendMessage(venueId, { room: 'checkout', event: 'payment-completed', body })
    },
}
