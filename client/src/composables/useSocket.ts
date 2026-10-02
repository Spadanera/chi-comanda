import { ref } from 'vue'
import { io, type Socket } from 'socket.io-client'

type SocketSetup = (socket: Socket) => void

let _socket: Socket | null = null
/** True once the socket has connected at least once (the screens wait for it). */
export const socketConnected = ref(false)
/** Current connection state, false while the connection is down and being restored. */
export const socketOnline = ref(true)

/** Rooms joined through `joinRoom`, (re)joined on every connection. */
const joinedRooms = new Set<string>()
/** Long-lived handlers (App level), registered again on every new socket. */
const setups = new Set<SocketSetup>()

function createSocket(): Socket {
  const socket = io(window.location.origin, { path: '/socket/socket.io' })
  socket.on('connect', () => {
    socketConnected.value = true
    socketOnline.value = true
    joinedRooms.forEach(room => socket.emit('join', room))
  })
  socket.on('disconnect', reason => {
    socketOnline.value = false
    // socket.io doesn't reconnect by itself after a server-side disconnect (e.g. a server restart)
    if (reason === 'io server disconnect' && _socket === socket) socket.connect()
  })
  socket.on('connect_error', () => { socketOnline.value = false })
  setups.forEach(setup => setup(socket))
  return socket
}

function closeSocket() {
  if (_socket) {
    _socket.disconnect()
    _socket = null
  }
}

/**
 * Phones suspend the page when the screen turns off and drop the connection. When the page
 * becomes visible again or the network comes back, reconnect right away instead of waiting for
 * the next retry of the exponential backoff.
 */
function reconnectNow() {
  if (_socket && !_socket.connected && document.visibilityState === 'visible') {
    _socket.connect()
  }
}
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', reconnectNow)
  window.addEventListener('online', reconnectNow)
  window.addEventListener('pageshow', reconnectNow)
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
  socketOnline.value = true
}
