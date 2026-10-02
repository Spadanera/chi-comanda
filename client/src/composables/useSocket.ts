import { ref } from 'vue'
import { io, type Socket } from 'socket.io-client'

type SocketSetup = (socket: Socket) => void

let _socket: Socket | null = null
export const socketConnected = ref(false)

/** Rooms joined through `joinRoom`, (re)joined on every connection. */
const joinedRooms = new Set<string>()
/** Long-lived handlers (App level), registered again on every new socket. */
const setups = new Set<SocketSetup>()

function createSocket(): Socket {
  const socket = io(window.location.origin, { path: '/socket/socket.io' })
  socket.on('connect', () => {
    socketConnected.value = true
    joinedRooms.forEach(room => socket.emit('join', room))
  })
  setups.forEach(setup => setup(socket))
  return socket
}

function closeSocket() {
  if (_socket) {
    _socket.disconnect()
    _socket = null
  }
}

export function useSocket(): Socket {
  if (!_socket) {
    _socket = createSocket()
  }
  return _socket
}

/** Joins a room now and again after every reconnection or recreation of the socket. */
export function joinRoom(room: string) {
  joinedRooms.add(room)
  const socket = useSocket()
  // Otherwise joined by the 'connect' handler
  if (socket.connected) socket.emit('join', room)
}

export function leaveRoom(room: string) {
  joinedRooms.delete(room)
  useSocket().emit('leave', room)
}

/**
 * Registers handlers that must survive the socket being recreated: they run on the current
 * socket and on every new one. Returns a function that unregisters them.
 */
export function onSocketCreated(setup: SocketSetup): () => void {
  setups.add(setup)
  setup(useSocket())
  return () => {
    setups.delete(setup)
  }
}

/**
 * Opens a new connection, keeping the joined rooms and the `onSocketCreated` handlers.
 * The server reads the user from the session when the socket connects, and the session id
 * changes on login and logout: the socket must be recreated every time.
 */
export function recreateSocket(): Socket {
  closeSocket()
  return useSocket()
}

export function destroySocket() {
  closeSocket()
  joinedRooms.clear()
  socketConnected.value = false
}
