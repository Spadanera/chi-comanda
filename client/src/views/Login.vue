<script setup lang="ts">
import { ref } from 'vue'
import Axios from '@/services/client'
import { UserStore } from '@/stores'
import { SnackbarStore } from '@/stores';
import { RouterLink } from 'vue-router';

const userStore = UserStore()
const axios: Axios = new Axios()

const emit = defineEmits(['login'])

const credentials = ref({
  email: '',
  password: ''
})

async function login() {
  try {
    await axios.Login(credentials.value.email, credentials.value.password)
    emit("login")
  } catch (error) {
    console.log(error)
  }
}
</script>

<template>
  <main>
    <v-container>
      <v-row justify="center">
        <v-col sm="8" cols="12" lg="3">
          <v-card>
            <v-card-text style="text-align: center;">
              <img alt="Chi Comanda" class="logo" src="@/assets/chicomanda.png"
                style="" width="240" height="240" />
              <v-form fast-fail @submit.prevent>
                <v-text-field type="email" label="Email" v-model="credentials.email"></v-text-field>
                <v-text-field type="password" label="Password" v-model="credentials.password"></v-text-field>
              </v-form>
              <p>
                <RouterLink to="/askreset">Password dimenticata</RouterLink>
              </p>
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
