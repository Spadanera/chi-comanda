<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'
import api from '@/services/client'
import { ref, onBeforeMount, onBeforeUnmount, onMounted, computed, watch } from 'vue'
import router from '@/router'
import { UserStore, SnackbarStore, ProgressStore, ThemeStore } from '@/stores'
import { type User, type Event } from '../../models/src'
import Avatar from './components/Avatar.vue'
import ThemeSwitch from './components/ThemeSwitch.vue'
import PushPrompt from './components/PushPrompt.vue'
import logoLight from '@/assets/logo/maitre-light.svg'
import logoDark from '@/assets/logo/maitre-dark.svg'
import { requireRuleArray, requiredRule } from './services/utils'
import { socketConnected, socketOnline, destroySocket, onSocketCreated, joinRoom } from './composables/useSocket'
import { useBroadcast } from './composables/useBroadcast'

const route = useRoute()
const userStore = UserStore()
const snackbarStore = SnackbarStore()
const progressStore = ProgressStore()
const themeStore = ThemeStore()
const user = ref<User>({} as User)
const event = ref<Event>()

const {
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
} = useBroadcast(event)

const routeTitle = computed(() => {
  if (route.params.pagetitle) {
    return Array.isArray(route.params.pagetitle)
      ? route.params.pagetitle[0]
      : route.params.pagetitle
  }
  return route.matched
    .filter((r) => r.name)
    .map((r) => r.name)
    .join(' - ')
})

function login() {
  user.value = userStore.user
  getOnGoingEvent()
  router.push('/')
}

async function logout() {
  await api.Logout()
  user.value = userStore.user
}

function reload() {
  user.value = userStore.user
}

function reloadPage() {
  window.location.reload()
}

async function getOnGoingEvent() {
  event.value = await api.GetOnGoingEvent()
  initReceivers()
}

let unregisterSocketSetup: (() => void) | undefined

// Brief drops (screen off, phone in the pocket) are restored silently: tell the user only when
// the real-time connection stays down, and offer a reload only after a long outage.
const offline = ref(false)
const longOffline = ref(false)
let offlineTimers: number[] = []
function restartOfflineTimers() {
  offlineTimers.forEach(clearTimeout)
  offlineTimers = []
  offline.value = false
  longOffline.value = false
  if (!socketOnline.value) {
    // A timer may expire while the page is frozen and fire on wake-up just before the
    // reconnection: show the notice only if the connection is still down at that moment
    offlineTimers = [
      window.setTimeout(() => { if (!socketOnline.value) offline.value = true }, 6000),
      window.setTimeout(() => { if (!socketOnline.value) longOffline.value = true }, 30000),
    ]
  }
}
watch(socketOnline, restartOfflineTimers)
// With the screen off the timers would expire unseen and fire all at once on wake-up, even if
// the connection comes back a moment later: count the outage from when the screen turns on.
function onVisibilityChange() {
  if (document.visibilityState === 'visible') restartOfflineTimers()
}
document.addEventListener('visibilitychange', onVisibilityChange)
// Page Lifecycle: a frozen page (Android, screen off) runs again
document.addEventListener('resume', onVisibilityChange)

onBeforeMount(() => {
  // Registered again on the new socket opened after login / logout
  unregisterSocketSetup = onSocketCreated(socket => {
    socket.on('reload', async () => {
      if (user.value?.id) {
        getOnGoingEvent()
      }
    })
  })
  // Refused by the server until the user logs in; rejoined by the socket opened after login
  joinRoom('main')

  registerSocketHandler()
})

onMounted(async () => {
  themeStore.watchSystem()
  await userStore.checkAuthentication()
  user.value = userStore.user
  if (user.value?.id) {
    await getOnGoingEvent()
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  document.removeEventListener('resume', onVisibilityChange)
  unregisterSocketSetup?.()
  unregisterSocketHandler()
  destroySocket()
})
</script>

<template>
  <v-responsive max-height="100%">
    <v-app :theme="themeStore.theme">
      <v-app-bar>
        <template v-slot:prepend>
          <RouterLink to="/">
            <img alt="Chi Comanda" :src="themeStore.theme === 'dark' ? logoDark : logoLight"
              style="margin-left: 8px; margin-top: 7px;" width="40" height="40" />
          </RouterLink>
        </template>
        <v-app-bar-title>
          <RouterLink to="/" class="d-flex flex-column"
            style="text-decoration: none; color: inherit; line-height: 1.1;">
            <span class="brand-title">CHI COMANDA</span>
            <span v-if="routeTitle" class="text-caption font-weight-light"
              style="font-size: 0.75rem !important; opacity: 0.8; text-transform: uppercase;">
              {{ routeTitle }}
            </span>
          </RouterLink>
        </v-app-bar-title>
        <v-btn @click="openMessageDialog()" v-if="event?.id && user?.id" size="x-large" icon="mdi-account-voice"></v-btn>
        <v-menu v-if="userStore.isLoggedIn">
          <template v-slot:activator="{ props }">
            <v-btn icon v-bind="props">
              <Avatar :user="userStore.user" alt></Avatar>
            </v-btn>
          </template>
          <v-list>
            <v-list-item v-if="event && event.id">
              <v-list-item-title>
                <v-btn @click="broadcastListDialog = true" variant="text">
                  MESSAGGI
                  <template v-slot:prepend>
                    <v-icon>mdi-message-bulleted</v-icon>
                  </template>
                </v-btn>
              </v-list-item-title>
            </v-list-item>
            <v-list-item>
              <ThemeSwitch labels @click.stop></ThemeSwitch>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>
                <RouterLink to="/profile">
                  <v-btn variant="text">
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
                <v-btn @click="logout()" variant="text">
                  ESCI
                  <template v-slot:prepend>
                    <v-icon>mdi-logout</v-icon>
                  </template>
                </v-btn>
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
        <template v-else>
          <RouterLink to="/landing" style="text-decoration: none;">
            <v-btn variant="text" slim>Info</v-btn>
          </RouterLink>
          <ThemeSwitch class="mr-2"></ThemeSwitch>
        </template>
      </v-app-bar>
      <v-main>
        <RouterView v-if="socketConnected || route.name === 'Landing'" v-model="user" @login="login" @reload="reload" :event="event" />

      </v-main>
      <PushPrompt></PushPrompt>
      <!-- v-if, not just model-value: opened and closed within a few ms (wake-up) the snackbar stayed on screen -->
      <v-snackbar v-if="offline && userStore.isLoggedIn" :model-value="true" location="top" color="warning" :timeout="-1">
        <v-progress-circular v-if="!longOffline" indeterminate size="16" width="2" class="mr-2"></v-progress-circular>
        {{ longOffline ? 'Aggiornamenti in tempo reale non disponibili' : 'Connessione persa, mi sto ricollegando…' }}
        <template v-slot:actions v-if="longOffline">
          <v-btn variant="text" @click="reloadPage">Ricarica</v-btn>
        </template>
      </v-snackbar>
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
          <v-card-title>Invia Messaggio</v-card-title>
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
      <v-dialog persistent scrollable transition="dialog-top-transition" v-model="messageDialogReceived"
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
                v-for="item in broadcasts" :key="item.dateTime?.toString()">
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

<style scoped>
.brand-title {
  font-family: 'Federo', 'Futura', 'Century Gothic', sans-serif;
  letter-spacing: .14em;
}
</style>
