<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import Axios from '@/services/client'
import { ref, onBeforeMount, onBeforeUnmount, onMounted } from 'vue'
import router from '@/router'
import { UserStore, SnackbarStore, ProgressStore, ThemeStore } from '@/stores'
import { type User, type Event, type Broadcast } from '../../models/src'
import Avatar from './components/Avatar.vue'
import { io, Socket } from 'socket.io-client'
import { requiredRule, requireRuleArray } from './services/utils'
import bendingString from '@/assets/bending-string.mp3'

const messageSound = new Audio(bendingString)
const axios: Axios = new Axios()
const userStore = UserStore()
const snackbarStore = SnackbarStore()
const progressStore = ProgressStore()
const themeStore = ThemeStore()
const user = ref<User>({} as User)
const theme = ref('light')
const is = ref<Socket>(null)
const event = ref<Event>()
const messageDialog = ref<boolean>(null)
const messageForm = ref(null)
const message = ref<string>(null)
const messageReceivers = ref<number[]>([])
const messageDialogReviced = ref<boolean>(false)
const possibleReceivers = ref<User[]>([])
const broadcast = ref<Broadcast>(null)
const broadcasts = ref<Broadcast[]>([])
const broadcastsQueue = ref<Broadcast[]>([])
const broadcastListDialog = ref<boolean>(null)

function login() {
  user.value = userStore.user
  router.push("/")
}

function reload() {
  user.value = userStore.user
}

function reloadPage() {
  window.location.reload()
}

function openMessageDialog() {
  messageDialogReviced.value = false
  message.value = ''
  messageDialog.value = true
}

function closeMessageDialogReceived() {
  messageDialogReviced.value = false
  window.setTimeout(() => {
    if (broadcastsQueue.value.length) {
      broadcast.value = broadcastsQueue.value.shift()
      messageDialogReviced.value = true
    }
  }, 200)
}

async function sendMessage() {
  const { valid } = await messageForm.value?.validate()
  if (valid && event.value.id) {
    const broad = {
      event_id: event.value.id,
      message: message.value,
      receivers: messageReceivers.value,
      sender: (user.value as User)
    } as Broadcast
    await axios.BroadcastMessage(broad)
    messageDialog.value = false
    snackbarStore.show("Messaggio inviato", 3000, 'success')

    broad.dateTime = new Date()
    broadcasts.value.unshift(broad)
    localStorage.setItem("broadcasts", JSON.stringify(broadcasts.value))
  }
}

async function getOnGoingEvent() {
  event.value = await axios.GetOnGoingEvent()
  if (event.value.id) {
    possibleReceivers.value = event.value.users?.filter((u: User) => u.id !== user.value.id)
    messageReceivers.value = possibleReceivers.value.map((u: User) => u.id)
    const localBroadcasts: string = localStorage.getItem("broadcasts")
    if (localBroadcasts) {
      broadcasts.value = JSON.parse(localStorage.getItem("broadcasts")) as Broadcast[]
    }
  }
  else {
    localStorage.removeItem("broadcasts")
  }
}

function getLocalTime(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleTimeString('it-it', {
    timeZone: 'Europe/Rome',
    hour: '2-digit',
    minute: '2-digit'
  });
}

onBeforeMount(async () => {
  await userStore.checkAuthentication()
  user.value = userStore.user

  is.value = io(window.location.origin, {
    path: "/socket/socket.io"
  })

  is.value.on('connect_error', (err: any) => {
    snackbarStore.show("Errore nella connessione, prova a ricaricare la pagina", -1, 'top', 'error', true)
    is.value.emit('end')
  })
})

onMounted(async () => {
  await getOnGoingEvent()

  is.value.emit('join', 'main')

  is.value.on('reload', async () => {
    if (user.value?.id) {
      getOnGoingEvent()
    }
  })

  is.value.on('broadcast', async (data: Broadcast) => {
    if (data.receivers.includes(user.value?.id)) {
      data.dateTime = new Date()
      broadcasts.value.unshift(data)
      localStorage.setItem("broadcasts", JSON.stringify(broadcasts.value))
      if (!messageDialogReviced.value) {
        broadcast.value = data
        messageDialogReviced.value = true
        messageSound.play()
      } else {
        broadcastsQueue.value.push(data)
      }
    }
  })
})

onBeforeUnmount(() => {
  if (is.value) {
    is.value.emit('end')
  }
})

</script>

<template>
  <v-responsive class="" max-height="100%">
    <v-app :theme="themeStore.theme">
      <v-app-bar>
        <template v-slot:prepend>
          <RouterLink to="/">
            <img alt="Chi Comanda" v-if="themeStore.theme === 'light'" class="logo" src="@/assets/chicomanda.png"
              style="margin-left: 8px; margin-top: 7px;" width="40" height="40" />
            <img alt="Chi Comanda" v-else class="logo" src="@/assets/chicomanda-invert.png"
              style="margin-left: 8px; margin-top: 7px;" width="40" height="40" />
          </RouterLink>
        </template>
        <v-app-bar-title>
          <RouterLink to="/">CHI COMANDA</RouterLink>
        </v-app-bar-title>
        <v-btn @click="openMessageDialog()" v-if="event?.id" size="x-large" icon="mdi-account-voice"></v-btn>
        <v-menu v-if="userStore.isLoggedIn">
          <template v-slot:activator="{ props }">
            <v-btn icon v-bind="props">
              <Avatar :user="userStore.user" alt></Avatar>
            </v-btn>
          </template>

          <v-list>
            <v-list-item>
              <v-list-item-title>
                <v-btn @click="broadcastListDialog = true" v-if="event.id" variant="text">
                  MESSAGGI
                  <template v-slot:prepend>
                    <v-icon>mdi-message-bulleted</v-icon>
                  </template>
                </v-btn>
              </v-list-item-title>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>
                <v-btn @click="themeStore.toggle" v-if="userStore.isLoggedIn" variant="text">
                  INVERTI TEMA
                  <template v-slot:prepend>
                    <v-icon>{{ theme === 'light' ? 'mdi-weather-sunny' : 'mdi-weather-night' }}</v-icon>
                  </template>
                </v-btn>
              </v-list-item-title>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>
                <RouterLink to="/profile">
                  <v-btn v-if="userStore.isLoggedIn" variant="text">
                    PROFILO
                    <template v-slot:prepend>
                      <v-icon>mdi-account</v-icon>
                    </template>
                  </v-btn>
                </RouterLink>
              </v-list-item-title>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>
                <v-btn @click="axios.Logout()" v-if="userStore.isLoggedIn" variant="text">
                  ESCI
                  <template v-slot:prepend>
                    <v-icon>mdi-logout</v-icon>
                  </template>
                </v-btn>
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
        <v-btn v-else :prepend-icon="theme === 'light' ? 'mdi-weather-sunny' : 'mdi-weather-night'" text="Inverti tema"
          slim @click="themeStore.toggle"></v-btn>
      </v-app-bar>
      <v-main>
        <RouterView :is="is" v-model="user" @login="login" @reload="reload" :event="event" />
      </v-main>
      <v-snackbar v-model="snackbarStore.enable" :timeout="snackbarStore.timeout" :location="snackbarStore.location"
        :color="snackbarStore.color">
        {{ snackbarStore.text }}
        <template v-slot:actions>
          <v-btn variant="text" @click="reloadPage" v-if="snackbarStore.reload">
            Ricarica Pagina
          </v-btn>
          <v-btn variant="text" @click="snackbarStore.enable = false">
            Chiudi
          </v-btn>
        </template>
      </v-snackbar>
      <v-overlay v-model="progressStore.loading" persistent scroll-strategy="block" class="align-center justify-center">
        <v-progress-circular :size="80" color="primary" indeterminate></v-progress-circular>
      </v-overlay>
      <v-dialog v-model="messageDialog" max-width="600px">
        <v-card>
          <v-card-title>
            Invia Messaggio
          </v-card-title>
          <v-card-text>
            <v-form @submit.stop ref="messageForm">
              <v-select label="Destinatari" :items="possibleReceivers" v-model="messageReceivers" item-value="id"
                item-title="username" multiple :rules="[requireRuleArray]">
                <template v-slot:item="{ props, item }">
                  <v-list-item v-bind="props" :title="item.title">
                    <template v-slot:prepend>
                      <Avatar :user="item.raw" alt size="small"></Avatar>
                    </template>
                  </v-list-item>
                </template>
                <template v-slot:selection="{ item }">
                  <v-chip>
                    <Avatar :user="item.raw" alt size="small"></Avatar>
                    <span style="margin-left: 5px;">{{ item.title }}</span>
                  </v-chip>
                </template>
              </v-select>
              <v-textarea label="Messaggio" v-model="message" :rules="[requiredRule]" clearable></v-textarea>
            </v-form>
          </v-card-text>
          <v-card-actions>
            <v-btn variant="plain" @click="messageDialog = false">Annulla</v-btn>
            <v-btn variant="plain" @click="sendMessage()">Invia</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
      <v-dialog persistent scrollable transition="dialog-top-transition" v-model="messageDialogReviced"
        max-width="500px">
        <v-card prepend-icon="mdi-message-alert" title="Nuovo Messaggio">
          <v-divider></v-divider>
          <v-card-text class="text-h6 py-2">
            <v-list-item class="w-100">
              <template v-slot:prepend>
                <Avatar :user="broadcast?.sender"></Avatar>
              </template>
              <v-list-item-title>{{ broadcast?.sender?.username }}</v-list-item-title>
            </v-list-item>
            <v-container>
              "{{ broadcast?.message }}"
            </v-container>
          </v-card-text>
          <v-divider></v-divider>
          <v-card-actions>
            <v-btn variant="plain" @click="closeMessageDialogReceived()">CHIUDI</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
      <v-dialog v-model="broadcastListDialog" scrollable max-width="600px">
        <v-card title="Messaggi" prepend-icon="mdi-message-bulleted">
          <v-divider></v-divider>
          <v-card-text style="padding: 0;">
            <v-list lines="two">
              <v-list-item :title="getLocalTime(item.dateTime.toString())" :subtitle="item.message"
                v-for="item in broadcasts">
                <template v-slot:prepend>
                  <Avatar :user="item.sender"></Avatar>
                </template>
              </v-list-item>
            </v-list>
          </v-card-text>
          <v-divider></v-divider>
          <v-card-actions>
            <v-btn variant="plain" @click="broadcastListDialog = false">CHIUDI</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-app>
  </v-responsive>

</template>

<style scoped></style>