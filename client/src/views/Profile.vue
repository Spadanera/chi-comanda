<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Axios from '@/services/client'
import { requiredRule } from '@/services/utils';
import { type User } from '../../../models/src';
import { UserStore } from '../stores';

const axios: Axios = new Axios()
const form = ref(null)
const username = ref<string>(null)
const avatarFile = ref(null)
const userStore = UserStore()

const fileInput = ref<HTMLInputElement | null>(null)
const files = ref()

function handleFileChange() {
    files.value = fileInput.value?.files
}

async function saveAvatar() {
    const { valid } = await form.value?.validate()
    if (valid) {
        try {
            const file = files.value[0]
            const formData = new FormData()
            formData.append('avatar', file)
            await axios.EditProfileAvatar(formData, userStore.user.id)
            // userStore.user.username = username.value
        } catch (error) {
            console.log(error)
        }
    }
}

onMounted(async () => {
    username.value = userStore.user.username
})
</script>

<template>
    <main>
        <v-container>
            <v-row justify="center">
                <v-col sm="8" cols="12" lg="3">
                    <v-card>
                        <v-card-text style="text-align: center;">
                            
                            <v-form ref="form" fast-fail @submit.prevent>
                                <v-text-field :rules="[requiredRule]" label="Nome Utente"
                                    v-model="username"></v-text-field>
                                <v-file-input @change="handleFileChange" label="Avatar" ref="fileInput" accept="image/*" show-size />
                            </v-form>
                        </v-card-text>
                        <v-card-actions>
                            <v-btn class="mt-2" type="submit" @click="saveAvatar" block>SALVA</v-btn>
                        </v-card-actions>
                    </v-card>
                </v-col>
            </v-row>
        </v-container>
    </main>
</template>
