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
        <v-app-bar-title>
          <RouterLink to="/">LOMP</RouterLink>
        </v-app-bar-title>
        <v-progress-linear v-model="progressStore.overallProgress" color="cyan-darken-2" indeterminate absolute
          :active="progressStore.loading"></v-progress-linear>
        <v-spacer></v-spacer>
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
    </v-app>
  </v-responsive>

</template>

<style scoped></style>