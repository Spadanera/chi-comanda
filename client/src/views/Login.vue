<script setup lang="ts">
import { ref } from 'vue'
import Axios from '@/services/client'
import { RouterLink } from 'vue-router'
import { requiredRule, emailRule } from '@/services/utils';
import Logo from '@/components/Logo.vue';

const axios: Axios = new Axios()
const form = ref(null)

const emit = defineEmits(['login'])

const credentials = ref({
  email: '',
  password: ''
})

async function login() {
  const { valid } = await form.value?.validate()
  if (valid) {
    try {
      await axios.Login(credentials.value.email, credentials.value.password)
      emit("login")
    } catch (error) {
      console.error(error)
    }
  }
}
</script>

<template>
  <main>
    <v-container>
      <v-row justify="center">
        <v-col sm="8" cols="12" lg="6" xl="4">
          <v-card>
            <v-card-text style="text-align: center;">
              <Logo></Logo>
              <v-form ref="form" fast-fail @submit.prevent>
                <v-text-field :rules="[requiredRule, emailRule]" type="email" label="Email"
                  v-model="credentials.email"></v-text-field>
                <v-text-field :rules="[requiredRule]" type="password" label="Password"
                  v-model="credentials.password"></v-text-field>
              </v-form>
              <p>
                <RouterLink to="/askreset">Password dimenticata</RouterLink>
              </p>
            </v-card-text>
            <v-card-actions>
              <v-btn class="mt-2" type="submit" @click="login" block>ACCEDI</v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </main>
</template>
