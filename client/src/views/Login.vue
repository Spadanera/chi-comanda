<script setup lang="ts">
import { ref } from 'vue'
import Axios from '@/services/client'
import { UserStore } from '@/stores'
import router from '@/router'

const userStore = UserStore()
const axios: Axios = new Axios()

const emit = defineEmits(['reload'])

const credentials = ref({
  email: '',
  password: ''
})

async function login() {
  await axios.Login(credentials.value.email, credentials.value.password)
  emit('reload')
  router.push("/")
}
</script>

<template>
  <main>
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
  </main>
</template>
