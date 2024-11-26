<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import Axios from '@/services/client'
import { ref, onBeforeMount, onBeforeUnmount, onMounted } from 'vue'
import router from '@/router'
import { UserStore, SnackbarStore, ProgressStore, ThemeStore } from '@/stores'
import { type User, type Event, type Broadcast } from '../../models/src'
import Avatar from './components/Avatar.vue'
import { io, Socket } from 'socket.io-client'

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
  messageDialog.value = true
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
  event.value = await axios.GetOnGoingEvent()

  is.value.emit('join', 'main')

  is.value.on('reload', async () => {
    if (user.value?.id) {
      event.value = await axios.GetOnGoingEvent()
    }
  })

  is.value.on('message', async (broadcast: Broadcast) => {
    if (broadcast.receivers.includes(user.value?.id)) {
      
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
        <v-spacer></v-spacer>
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
      <v-dialog v-model="messageDialog">
        <v-card>
          <v-card-title>
            Invia Messaggio
          </v-card-title>
          <v-card-actions>
            <v-btn variant="plain" @click="messageDialog = false">Annulla</v-btn>
            <v-btn variant="plain">Invia</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-app>
  </v-responsive>

</template>

<style scoped></style>