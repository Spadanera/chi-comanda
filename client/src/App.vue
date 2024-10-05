<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import Axios from './services/client'
import { onBeforeMount, ref } from 'vue'
import router from '@/router'
import { UserStore, SnackbarStore } from '@/stores'

const axios: Axios = new Axios()
const userStore = UserStore()
const snackbarStore = SnackbarStore()

onBeforeMount(async () => {
  userStore.isLoggedIn = await axios?.CheckAuthentication() || 0
  if (!userStore.isLoggedIn) {
    router.push("/login")
  }
})

</script>

<template>
  <v-responsive class="border rounded" max-height="100%">
    <v-app>
      <v-app-bar title="LOMP">
        <v-spacer></v-spacer>
        <v-btn @click="axios.Logout()" v-if="userStore.isLoggedIn">
          LOG OUT
        </v-btn>
      </v-app-bar>
      <!-- <v-navigation-drawer>
        <v-list>
          <v-list-item title="Navigation drawer"></v-list-item>
        </v-list>
      </v-navigation-drawer> -->

      <v-main>
        <v-container>
          <RouterView />
        </v-container>
      </v-main>
      <v-snackbar v-model="snackbarStore.show" :timeout="snackbarStore.timeout">
        {{ snackbarStore.text }}
        <template v-slot:actions>
          <v-btn variant="text" @click="snackbarStore.show = false">
            Chiudi
          </v-btn>
        </template>
      </v-snackbar>
    </v-app>
  </v-responsive>

</template>

<style scoped></style>
