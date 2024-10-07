<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import Axios from '@/services/client'
import { onMounted, ref, onBeforeMount } from 'vue'
import router from '@/router'
import { UserStore, SnackbarStore, IUser } from '@/stores'

const axios: Axios = new Axios()
const userStore = UserStore()
const snackbarStore = SnackbarStore()
const user = ref({})

function login() {
  user.value = userStore.user
  router.push("/")
}

function reload() {
  user.value = userStore.user
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
        <v-spacer></v-spacer>
        <v-btn @click="axios.Logout()" v-if="userStore.isLoggedIn">
          LOG OUT
        </v-btn>
      </v-app-bar>

      <v-main>
        <RouterView v-model="user" @login="login" @reload="reload" />
      </v-main>
      <v-snackbar v-model="snackbarStore.enable" :timeout="snackbarStore.timeout" :location="snackbarStore.location">
        {{ snackbarStore.text }}
        <template v-slot:actions>
          <v-btn variant="text" @click="snackbarStore.enable = false">
            Chiudi
          </v-btn>
        </template>
      </v-snackbar>
    </v-app>
  </v-responsive>

</template>

<style scoped></style>