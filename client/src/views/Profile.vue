<script setup lang="ts">
import { onMounted, ref } from 'vue'
import api from '@/services/client'
import { requiredRule, fileRequiredRule } from '@/services/utils';
import { type User } from '../../../models/src';
import { UserStore, SnackbarStore } from '../stores';
import Avatar from '@/components/Avatar.vue';
import { RouterLink } from 'vue-router';
import { Roles } from '@/services/utils'
import { disablePush, enablePush, loadPushState, pushStatus } from '@/composables/usePush'

const emit = defineEmits(['reload'])
const formName = ref(null)
const formAvatar = ref(null)
const username = ref<string>(null)
const userStore = UserStore()
const snackbarStore = SnackbarStore()
const usernameReadOnly = ref<boolean>(true)
const avatarReadOnly = ref<boolean>(true)

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
            const avatar = await api.EditProfileAvatar(formData, userStore.user.id)
            userStore.setAvatar(avatar)
            emit('reload')
            avatarReadOnly.value = true
            snackbarStore.show("Avatar aggiornato", 3000, 'bottom', 'success')
        } catch (error) {
            console.error(error)
        }
    }
}

function cancelUsername() {
    username.value = userStore.user.username
    usernameReadOnly.value = true
}

async function saveUsername() {
    const { valid } = await formName.value?.validate()
    if (valid) {
        try {
            await api.EditProfileUsername({
                id: userStore.user.id,
                username: username.value
            } as User)
            userStore.setUsername(username.value)
            emit('reload')
            usernameReadOnly.value = true
            snackbarStore.show("Nome utente aggiornato", 3000, 'bottom', 'success')
        } catch (error) {
            console.error(error)
        }
    }
}

const isBartender = userStore.user.roles.includes(Roles.bartender)
const pushBusy = ref(false)

async function togglePush(on: boolean | null) {
    pushBusy.value = true
    try {
        if (on) {
            if (await enablePush() === 'on') {
                snackbarStore.show('Notifiche attivate', 3000, 'bottom', 'success')
            }
        } else {
            await disablePush()
            snackbarStore.show('Notifiche disattivate', 3000, 'bottom', 'success')
        }
    } catch (error) {
        console.error(error)
        snackbarStore.show('Non è stato possibile cambiare le notifiche', 4000, 'top', 'error')
    } finally {
        pushBusy.value = false
    }
}

onMounted(async () => {
    username.value = userStore.user.username
    if (isBartender) {
        await loadPushState().catch(error => console.error(error))
    }
})
</script>

<template>
    <main>
        <v-container>
            <v-row justify="center">
                <v-col sm="8" cols="12" lg="6" xl="4">
                    <v-card>
                        <v-card-text style="text-align: center;">
                            <div style="text-align: center; margin-bottom: 10px;">
                                <Avatar :user="userStore.user" alt size="x-large"></Avatar>
                                <v-btn variant="plain" icon="mdi-pencil" @click="avatarReadOnly = false"></v-btn>
                            </div>
                            <v-form ref="formAvatar" fast-fail @submit.prevent v-if="!avatarReadOnly">
                                <v-file-input :rules="[requiredRule, fileRequiredRule]" @change="handleFileChange" label="Avatar"
                                    ref="fileInput" accept="image/*" show-size>
                                    <template v-slot:selection="{ fileNames }">
                                        <v-chip class="me-2" color="primary" size="small" label>
                                            {{ fileNames[0] }}
                                        </v-chip>
                                    </template>
                                </v-file-input>
                                <v-row>
                                    <v-spacer></v-spacer>
                                    <v-col>
                                        <v-btn class="mt-2" type="submit" @click="avatarReadOnly = true">ANNULLA</v-btn>
                                    </v-col>
                                    <v-col>
                                        <v-btn class="mt-2" type="submit" @click="saveAvatar()">SALVA</v-btn>
                                    </v-col>
                                    <v-spacer></v-spacer>
                                </v-row>
                            </v-form>
                            <v-text-field style="margin-top: 20px" label="Email" readonly
                                v-model="userStore.user.email"></v-text-field>
                            <v-form ref="formName" fast-fail @submit.prevent>
                                <v-text-field :rules="[requiredRule]" label="Nome Utente" v-model="username"
                                    :readonly="usernameReadOnly">
                                    <template v-slot:append-inner>
                                        <v-btn variant="plain" icon="mdi-pencil"
                                            @click="usernameReadOnly = false"></v-btn>
                                    </template>
                                </v-text-field>
                                <v-row>
                                    <v-spacer></v-spacer>
                                    <v-col>
                                        <v-btn class="mt-2" v-if="!usernameReadOnly" type="submit"
                                            @click="cancelUsername()">ANNULLA</v-btn>
                                    </v-col>
                                    <v-col>
                                        <v-btn class="mt-2" v-if="!usernameReadOnly" type="submit"
                                            @click="saveUsername()">SALVA</v-btn>
                                    </v-col>
                                    <v-spacer></v-spacer>
                                </v-row>
                            </v-form>
                        </v-card-text>
                        <template v-if="isBartender && pushStatus !== 'hidden'">
                            <v-divider></v-divider>
                            <v-card-text>
                                <v-switch :model-value="pushStatus === 'on'" @update:model-value="togglePush"
                                    :disabled="pushBusy || ['unsupported', 'needs-install', 'denied'].includes(pushStatus)"
                                    :loading="pushBusy" color="primary" inset hide-details
                                    label="Notifiche dei nuovi ordini"></v-switch>
                                <p class="text-body-2 text-medium-emphasis mt-1">
                                    <template v-if="pushStatus === 'needs-install'">
                                        Su iPhone e iPad le notifiche arrivano solo se aggiungi Chi Comanda alla schermata
                                        Home (Condividi → Aggiungi alla schermata Home) e la apri da lì.
                                    </template>
                                    <template v-else-if="pushStatus === 'unsupported'">
                                        Questo browser non supporta le notifiche.
                                    </template>
                                    <template v-else-if="pushStatus === 'denied'">
                                        Le notifiche sono bloccate nelle impostazioni del browser per questo sito:
                                        sbloccale lì per poterle attivare.
                                    </template>
                                    <template v-else>
                                        Ricevi una notifica per ogni ordine destinato alla tua postazione, anche con
                                        l'app chiusa. Vale per tutti i tuoi dispositivi.
                                    </template>
                                </p>
                            </v-card-text>
                        </template>
                        <v-card-actions>
                            <RouterLink to="/">
                                <v-btn variant="plain">
                                    TORNA AL MENU PRINCIPALE
                                </v-btn>
                            </RouterLink>
                        </v-card-actions>
                    </v-card>
                </v-col>
            </v-row>
        </v-container>
    </main>
</template>
