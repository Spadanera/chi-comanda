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
  // Only after a real drop: calling connect() while the first connection is still opening
  // (pageshow fires right at load) sends a second CONNECT and the server closes the session
  if (!_socket || _socket.connected || socketOnline.value || document.visibilityState !== 'visible') return
  // disconnect() stops the pending backoff timer, connect() retries right away
  _socket.disconnect().connect()
}
/**
 * When the screen turns back on the socket may look connected while the network died under it
 * (it would notice only at the ping timeout, up to 45s later, receiving nothing meanwhile):
 * ask the server whether it's there and, without an answer, drop the connection so it reopens.
 */
async function checkOnWake() {
  if (!_socket || document.visibilityState !== 'visible') return
  if (!_socket.connected) return reconnectNow()
  try {
    await _socket.timeout(3000).emitWithAck('alive')
  } catch {
    // Closing the transport triggers 'disconnect' and the automatic reconnection
    _socket.io.engine?.close()
  }
}

if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', checkOnWake)
  // Page Lifecycle: fired when a frozen page (Android, screen off) runs again
  document.addEventListener('resume', checkOnWake)
  window.addEventListener('online', checkOnWake)
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
