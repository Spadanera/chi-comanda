import { Server, ServerOptions } from 'socket.io'
import { Server as HttpServer } from 'http'
import { Message } from '../../../models/src'

/** Rooms a client may join. Each screen of the app listens on its own room. */
export const ROOMS = ['main', 'waiter', 'bartender', 'checkout', 'table'] as const
export type Room = typeof ROOMS[number]

let io: Server | undefined

export function initializeSocket(httpServer: HttpServer, opts?: Partial<ServerOptions>): Server {
    io = new Server(httpServer, opts)
    io.on('connection', socket => {
        socket.on('end', () => socket.disconnect())
        socket.on('join', (room: string) => {
            if ((ROOMS as readonly string[]).includes(room)) socket.join(room)
        })
        socket.on('leave', (room: string) => socket.leave(room))
    })
    return io
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
