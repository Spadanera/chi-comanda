<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'
import Axios from '@/services/client'
import { ref, onBeforeMount, onBeforeUnmount, onMounted, computed } from 'vue'
import router from '@/router'
import { UserStore, SnackbarStore, ProgressStore, ThemeStore } from '@/stores'
import { type User, type Event } from '../../models/src'
import Avatar from './components/Avatar.vue'
import { requireRuleArray, requiredRule } from './services/utils'
import { useSocket, socketConnected, destroySocket } from './composables/useSocket'
import { useBroadcast } from './composables/useBroadcast'

const axios: Axios = new Axios()
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
  await axios.Logout()
  user.value = userStore.user
}

function reload() {
  user.value = userStore.user
}

function reloadPage() {
  window.location.reload()
}

async function getOnGoingEvent() {
  event.value = await axios.GetOnGoingEvent()
  initReceivers()
}

onBeforeMount(() => {
  const socket = useSocket()

  socket.on('connect', () => {
    socketConnected.value = true
    socket.emit('join', 'main')
  })

  socket.on('connect_error', () => {
    snackbarStore.show('Errore nella connessione, prova a ricaricare la pagina', -1, 'top', 'error', true)
    socket.emit('end')
  })

  registerSocketHandler()
})

onMounted(async () => {
  await userStore.checkAuthentication()
  user.value = userStore.user
  if (user.value?.id) {
    await getOnGoingEvent()
  }

  const socket = useSocket()
  socket.on('reload', async () => {
    if (user.value?.id) {
      getOnGoingEvent()
    }
  })
})

onBeforeUnmount(() => {
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
            <img alt="Chi Comanda" v-if="themeStore.theme === 'light'" class="logo" src="@/assets/chicomanda.png"
              style="margin-left: 8px; margin-top: 7px;" width="40" height="40" />
            <img alt="Chi Comanda" v-else class="logo" src="@/assets/chicomanda-invert.png"
              style="margin-left: 8px; margin-top: 7px;" width="40" height="40" />
          </RouterLink>
        </template>
        <v-app-bar-title>
          <RouterLink to="/" class="d-flex flex-column"
            style="text-decoration: none; color: inherit; line-height: 1.1;">
            <span>CHI COMANDA</span>
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
              <v-list-item-title>
                <v-btn @click="themeStore.toggle" variant="text">
                  INVERTI TEMA
                  <template v-slot:prepend>
                    <v-icon>{{ themeStore.theme === 'light' ? 'mdi-weather-sunny' : 'mdi-weather-night' }}</v-icon>
                  </template>
                </v-btn>
              </v-list-item-title>
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
        <v-btn v-else :prepend-icon="themeStore.theme === 'light' ? 'mdi-weather-sunny' : 'mdi-weather-night'"
          text="Inverti tema" slim @click="themeStore.toggle"></v-btn>
      </v-app-bar>
      <v-main>
        <RouterView v-if="socketConnected" v-model="user" @login="login" @reload="reload" :event="event" />

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

<style scoped></style>
