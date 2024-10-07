<script setup lang="ts">
import { ref } from 'vue'
import Axios from '@/services/client'
import { UserStore } from '@/stores'
import router from '@/router'

const userStore = UserStore()
const axios: Axios = new Axios()

const emit = defineEmits(['login'])

const credentials = ref({
  email: '',
  password: ''
})

async function login() {
  await axios.Login(credentials.value.email, credentials.value.password)
  emit("login")
}
</script>

<template>
  <main>
    <v-container>
      <v-row justify="center">
        <v-col sm="8" xs="12" lg="4">
          <v-card>
            <v-card-text>
              <v-form fast-fail @submit.prevent>
                <v-text-field type="email" label="Email" v-model="credentials.email"></v-text-field>
      
                <v-text-field type="password" label="Password" v-model="credentials.password"></v-text-field>
      
              </v-form>
            </v-card-text>
            <v-card-actions>
              <v-btn class="mt-2" type="submit" @click="login" block>LOG IN</v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </main>
</template>
