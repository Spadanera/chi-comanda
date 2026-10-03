<script setup lang="ts">
import { ref } from 'vue'
import api from '@/services/client'
import Logo from '@/components/Logo.vue'
import { useFeature } from '@/composables/useConfig'
import { requiredRule, passwordMatchRule } from '@/services/utils';

const props = defineProps(['token'])
const googleLogin = useFeature('google-login')
const form = ref(null)
const fileInput = ref<HTMLInputElement | null>(null)
const files = ref()

const credentials = ref({
  username: '',
  password: '',
  confirmPassword: '',
  token: props.token as string,
})

function handleFileChange() {
  files.value = fileInput.value?.files
}

async function accept() {
  const { valid } = await form.value?.validate()
  if (valid) {
    try {
      const formData = new FormData()
      if (files.value && files.value.length) {
        formData.append('avatar', files.value[0])
      }
      formData.append('username', credentials.value.username)
      formData.append('password', credentials.value.password)
      formData.append('token', credentials.value.token)
      await api.AcceptInvitation(formData)
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
        <v-col sm="8" cols="12" lg="4" xl="4">
          <v-card>
            <v-card-text style="text-align: center;">
              <Logo></Logo>

              <p v-if="googleLogin" class="text-body-2 text-medium-emphasis mb-4">
                Scegli come configurare il tuo account
              </p>

              <!-- Google fast track -->
              <v-btn
                v-if="googleLogin"
                block
                variant="tonal"
                color="primary"
                prepend-icon="mdi-google"
                class="mb-4"
                @click="api.loginWithGoogle(props.token)"
              >
                Accetta con Google
              </v-btn>

              <v-divider v-if="googleLogin" class="mb-4">
                <span class="text-caption text-medium-emphasis px-2">oppure imposta manualmente</span>
              </v-divider>

              <v-form fast-fail @submit.prevent ref="form">
                <v-text-field type="text" label="Nome Utente" v-model="credentials.username"
                  :rules="[requiredRule]"></v-text-field>
                <v-text-field type="password" label="Password" v-model="credentials.password"
                  :rules="[requiredRule]"></v-text-field>
                <v-text-field type="password" label="Conferma Password"
                  :rules="[requiredRule, passwordMatchRule(credentials.password)]"
                  v-model="credentials.confirmPassword"></v-text-field>
                <v-file-input @change="handleFileChange" label="Avatar" ref="fileInput" accept="image/*" show-size />
              </v-form>
            </v-card-text>
            <v-card-actions>
              <v-btn class="mt-2" type="submit" @click="accept" block>ACCETTA INVITO</v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </main>
</template>
