<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import Axios from '@/services/client'
import { ref, onBeforeMount } from 'vue'
import router from '@/router'
import { UserStore, SnackbarStore, ProgressStore, ThemeStore } from '@/stores'
import { type User } from '../../models/src'

const axios: Axios = new Axios()
const userStore = UserStore()
const snackbarStore = SnackbarStore()
const progressStore = ProgressStore()
const themeStore = ThemeStore()
const user = ref<User>({} as User)
const theme = ref('light')
const avatar = ref(null)

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

onBeforeMount(async () => {
  await userStore.checkAuthentication()
  user.value = userStore.user
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
        <v-menu v-if="userStore.isLoggedIn">
          <template v-slot:activator="{ props }">
            <v-btn icon v-bind="props">
              <v-avatar color="red">
                <v-img v-if="user.avatar && user.avatar" alt="John" :src="user.avatar"></v-img>
                <span v-else-if="user.username" class="text-h5">{{ user.username[0] }}</span>
              </v-avatar>
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
        <RouterView v-model="user" @login="login" @reload="reload" />
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
    </v-app>
  </v-responsive>

</template>

<style scoped></style>