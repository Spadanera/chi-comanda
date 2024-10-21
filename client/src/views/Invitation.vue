<script setup lang="ts">
import { ref } from 'vue'
import Axios from '@/services/client'
import { SnackbarStore, UserStore } from '@/stores'
import type { Invitation } from '../../../models/src';

const props = defineProps(['token'])
const axios: Axios = new Axios()
const form = ref(null)
const requiredRule = ref([(value: any) => !!value || 'Campo obbligatorio'])
const snackbarStore = SnackbarStore()

const credentials = ref<Invitation>({
  username: '',
  password: '',
  confirmPassword: '',
  token: props.token
} as Invitation)

async function reset() {
  const { valid } = await form.value?.validate()
  if (valid) {
    if (credentials.value.password !== credentials.value.confirmPassword) {
      snackbarStore.show("Le password non coincidono", 3000, 'top', 'error')
    }
    else {
      try {
        await axios.AcceptInvitation(credentials.value)
      } catch (error) {
        console.log(error)
      }
    }
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
              <img alt="Chi Comanda" class="logo" src="@/assets/chicomanda.png" style="" width="240" height="240" />
              <v-form fast-fail @submit.prevent ref="form">
                <v-text-field type="text" label="Nome Utente" v-model="credentials.username"
                  :rules="requiredRule"></v-text-field>
                <v-text-field type="password" label="Password" v-model="credentials.password"
                  :rules="requiredRule"></v-text-field>
                <v-text-field type="password" label="Conferma Password" :rules="requiredRule"
                  v-model="credentials.confirmPassword"></v-text-field>
              </v-form>
            </v-card-text>
            <v-card-actions>
              <v-btn class="mt-2" type="submit" @click="reset" block>ACCETTA INVITO</v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </main>
</template>
