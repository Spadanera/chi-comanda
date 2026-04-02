import { ref, type Ref } from 'vue'
import { type Broadcast, type Event, type User } from '../../../models/src'
import { UserStore, SnackbarStore } from '@/stores'
import { copy } from '@/services/utils'
import Axios from '@/services/client'
import { useSocket } from './useSocket'
import bendingString from '@/assets/bending-string.mp3'

const messageSound = new Audio(bendingString)

export function useBroadcast(event: Ref<Event | undefined>) {
  const userStore = UserStore()
  const snackbarStore = SnackbarStore()
  const axios = new Axios()
  const socket = useSocket()

  const messageDialog = ref<boolean>(false)
  const messageForm = ref(null)
  const message = ref<string>('')
  const messageReceivers = ref<number[]>([])
  const messageDialogReceived = ref<boolean>(false)
  const possibleReceivers = ref<User[]>([])
  const broadcast = ref<Broadcast | null>(null)
  const broadcasts = ref<Broadcast[]>([])
  const broadcastsQueue = ref<Broadcast[]>([])
  const broadcastListDialog = ref<boolean>(false)

  function openMessageDialog() {
    messageDialogReceived.value = false
    message.value = ''
    messageDialog.value = true
  }

  function closeMessageDialogReceived() {
    messageDialogReceived.value = false
    window.setTimeout(() => {
      if (broadcastsQueue.value.length) {
        broadcast.value = broadcastsQueue.value.shift()
        messageDialogReceived.value = true
      }
    }, 200)
  }

  async function sendMessage() {
    const { valid } = await messageForm.value?.validate()
    if (valid && event.value?.id) {
      const sender = copy<User>(userStore.user as User)
      delete sender.avatar
      const broad: Broadcast = {
        event_id: event.value.id,
        message: message.value,
        receivers: messageReceivers.value,
        sender
      } as Broadcast
      await axios.BroadcastMessage(broad)
      messageDialog.value = false
      snackbarStore.show('Messaggio inviato', 3000, 'success')
      broad.dateTime = new Date()
      broadcasts.value.unshift(broad)
      localStorage.setItem('broadcasts', JSON.stringify(broadcasts.value))
    }
  }

  function getLocalTime(dateString: string) {
    return new Date(dateString).toLocaleTimeString('it-it', {
      timeZone: 'Europe/Rome',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function loadBroadcastsFromStorage() {
    const stored = localStorage.getItem('broadcasts')
    if (stored) {
      broadcasts.value = JSON.parse(stored) as Broadcast[]
    }
  }

  function initReceivers() {
    if (event.value?.id) {
      possibleReceivers.value = event.value.users?.filter((u: User) => u.id !== userStore.id) ?? []
      messageReceivers.value = possibleReceivers.value.map((u: User) => u.id)
      loadBroadcastsFromStorage()
    } else {
      localStorage.removeItem('broadcasts')
    }
  }

  function registerSocketHandler() {
    socket.on('broadcast', async (data: Broadcast) => {
      if (data.receivers.includes(userStore.id)) {
        data.dateTime = new Date()
        broadcasts.value.unshift(data)
        localStorage.setItem('broadcasts', JSON.stringify(broadcasts.value))
        if (!messageDialogReceived.value) {
          broadcast.value = data
          messageDialogReceived.value = true
          try {
            await messageSound.play()
          } catch {
            // autoplay blocked by browser policy
          }
        } else {
          broadcastsQueue.value.push(data)
        }
      }
    })
  }

  function unregisterSocketHandler() {
    socket.off('broadcast')
  }

  return {
    messageDialog,
    messageForm,
    message,
    messageReceivers,
    messageDialogReceived,
    possibleReceivers,
    broadcast,
    broadcasts,
    broadcastListDialog,
    openMessageDialog,
    closeMessageDialogReceived,
    sendMessage,
    getLocalTime,
    initReceivers,
    registerSocketHandler,
    unregisterSocketHandler
  }
}
