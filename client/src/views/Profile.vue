<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Axios from '@/services/client'
import { requiredRule } from '@/services/utils';
import { type User } from '../../../models/src';
import { UserStore, SnackbarStore } from '../stores';

const emit = defineEmits(['reload'])
const axios: Axios = new Axios()
const formName = ref(null)
const formAvatar = ref(null)
const username = ref<string>(null)
const userStore = UserStore()
const snackbarStore = SnackbarStore()

const fileInput = ref<HTMLInputElement | null>(null)
const files = ref()

function handleFileChange() {
    files.value = fileInput.value?.files
}

async function saveAvatar() {
    const { valid } = await formAvatar.value?.validate()
    if (valid) {
        try {
            const file = files.value[0]
            const formData = new FormData()
            formData.append('avatar', file)
            const avatar = await axios.EditProfileAvatar(formData, userStore.user.id)
            userStore.setAvatar(avatar)
            emit('reload')
            snackbarStore.show("Avatar aggiornato", 3000, 'bottom', 'success')
        } catch (error) {
            console.log(error)
        }
    }
}

async function saveUsername() {
    const { valid } = await formName.value?.validate()
    if (valid) {
        try {
            await axios.EditProfileUsername({
                id: userStore.user.id,
                username: username.value
            } as User)
            userStore.setUsername(username.value)
            emit('reload')
            snackbarStore.show("Nome utente aggiornato", 3000, 'bottom', 'success')
        } catch (error) {
            console.log(error)
        }
    }
}

onMounted(async () => {
    username.value = userStore.user.username
    console.log(userStore.user)
})
</script>

<template>
    <main>
        <v-container>
            <v-row justify="center">
                <v-col sm="8" cols="12" lg="3">
                    <v-card>
                        <v-card-text style="text-align: center;">
                            <div style="text-align: center;">
                                <v-avatar :color="userStore.user.avatar ? 'default' : 'red'" size="x-large">
                                    <v-img v-if="userStore.user.avatar" :alt="userStore.user.username" :src="userStore.user.avatar"></v-img>
                                    <span v-else-if="userStore.user.username" class="text-h5">{{ userStore.user.username[0] }}</span>
                                </v-avatar>
                            </div>
                            <v-form ref="formName" fast-fail @submit.prevent>
                                <v-text-field label="Email" readonly v-model="userStore.user.email"></v-text-field>
                                <v-text-field :rules="[requiredRule]" label="Nome Utente"
                                    v-model="username"></v-text-field>
                                <v-btn class="mt-2" type="submit" @click="saveUsername()" block>SALVA</v-btn>
                            </v-form>
                            <v-form ref="formAvatar" fast-fail @submit.prevent>
                                <v-file-input @change="handleFileChange" label="Avatar" ref="fileInput" accept="image/*"
                                    show-size />
                                <v-btn class="mt-2" type="submit" @click="saveAvatar()" block>SALVA</v-btn>
                            </v-form>
                        </v-card-text>
                    </v-card>
                </v-col>
            </v-row>
        </v-container>
    </main>
</template>
