import { ref } from 'vue'
import { io, type Socket } from 'socket.io-client'

let _socket: Socket | null = null
export const socketConnected = ref(false)

export function useSocket(): Socket {
  if (!_socket) {
    _socket = io(window.location.origin, { path: '/socket/socket.io' })
  }
  return _socket
}

export function destroySocket() {
  if (_socket) {
    _socket.emit('end')
    _socket = null
    socketConnected.value = false
  }
}
