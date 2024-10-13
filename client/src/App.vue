<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import Axios from '@/services/client'
import { onMounted, ref, onBeforeMount } from 'vue'
import router from '@/router'
import { UserStore, SnackbarStore, ProgressStore, type IUser } from '@/stores'

const axios: Axios = new Axios()
const userStore = UserStore()
const snackbarStore = SnackbarStore()
const progressStore = ProgressStore()
const user = ref({})
const test = ref<boolean>(true)

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
  user.value = userStore.user
})

</script>

<template>
  <v-responsive class="" max-height="100%">
    <v-app>
      <v-app-bar>
        <template v-slot:prepend>
          <!-- <v-img scr="@/assets/chicomanda.png" alt="Chi Comanda"></v-img> -->
          <RouterLink to="/">
            <img alt="Chi Comanda" class="logo" src="@/assets/chicomanda.png" style="margin-left: 8px; margin-top: 7px;" width="40"
              height="40" />
          </RouterLink>
        </template>
        <v-app-bar-title>
          <RouterLink to="/">CHI COMANDA</RouterLink>
        </v-app-bar-title>
        <v-btn @click="axios.Logout()" v-if="userStore.isLoggedIn">
          LOG OUT
        </v-btn>
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