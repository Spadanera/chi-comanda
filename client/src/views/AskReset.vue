<script setup lang="ts">
import { ref } from 'vue'
import Axios from '@/services/client'
import { UserStore } from '@/stores'
import { requiredRule, emailRule } from '@/services/utils'
import Logo from '@/components/Logo.vue';

const userStore = UserStore()
const axios: Axios = new Axios()
const form = ref(null)
const asked = ref<boolean>(false)

const email = ref('')

async function askReset() {
    const { valid } = await form.value?.validate()
    if (valid) {
        try {
            await axios.AskReset(email.value)
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
                <v-col sm="8" cols="12" lg="3">
                    <v-card>
                        <v-card-text style="text-align: center;">
                            <Logo></Logo>
                            <v-form fast-fail @submit.prevent ref="form" v-if="!asked">
                                <v-text-field :rules="[requiredRule, emailRule]" type="email" label="Email" v-model="email"></v-text-field>
                            </v-form>
                            <p v-else>
                                Richiesta effettuata
                            </p>
                        </v-card-text>
                        <v-card-actions>
                            <v-btn class="mt-2" type="submit" @click="askReset" block v-if="!asked">INVIA RICHIESTA</v-btn>
                        </v-card-actions>
                    </v-card>
                </v-col>
            </v-row>
        </v-container>
    </main>
</template>
