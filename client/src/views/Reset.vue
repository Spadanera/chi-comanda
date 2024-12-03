<script setup lang="ts">
import { ref } from 'vue'
import Axios from '@/services/client'
import type { Invitation } from '../../../models/src'
import { requiredRule, passwordMatchRule } from '@/services/utils'
import Logo from '@/components/Logo.vue'

const props = defineProps(['token'])
const axios: Axios = new Axios()
const form = ref(null)

const credentials = ref({
    password: '',
    confirmPassword: ''
})

async function reset() {
    const { valid } = await form.value?.validate()
    if (valid) {
        try {
            await axios.Reset({
                token: props.token,
                password: credentials.value.password
            } as Invitation)
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
                            <v-form fast-fail @submit.prevent ref="form">
                                <v-text-field type="password" label="Password" v-model="credentials.password"
                                    :rules="[requiredRule]"></v-text-field>
                                <v-text-field type="password" label="Conferma Password" :rules="[requiredRule, passwordMatchRule(credentials.password)]"
                                    v-model="credentials.confirmPassword"></v-text-field>
                            </v-form>
                        </v-card-text>
                        <v-card-actions>
                            <v-btn class="mt-2" type="submit" @click="reset" block>REIMPOSTA PASSWORD</v-btn>
                        </v-card-actions>
                    </v-card>
                </v-col>
            </v-row>
        </v-container>
    </main>
</template>
