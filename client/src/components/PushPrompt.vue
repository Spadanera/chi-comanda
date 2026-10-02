<script setup lang="ts">
import { ref, watch } from 'vue'
import { UserStore, SnackbarStore } from '@/stores'
import { Roles } from '@/services/utils'
import { declinePush, dismissOnThisDevice, enablePush, loadPushState, nextPushStep } from '@/composables/usePush'

const userStore = UserStore()
const snackbarStore = SnackbarStore()
const dialog = ref(false)
const firstTime = ref(true)
const busy = ref(false)

// Only bartenders get order notifications: ask them once logged in
watch(() => userStore.id, async id => {
    dialog.value = false
    if (!id || !userStore.roles.includes(Roles.bartender)) return
    try {
        await loadPushState()
        const step = nextPushStep()
        if (step === 'resubscribe') {
            await enablePush()
        } else if (step !== 'none') {
            firstTime.value = step === 'ask-first'
            dialog.value = true
        }
    } catch (error) {
        console.error('Push notifications unavailable', error)
    }
}, { immediate: true })

async function activate() {
    busy.value = true
    try {
        if (await enablePush() === 'on') {
            snackbarStore.show('Notifiche attivate', 3000, 'bottom', 'success')
        } else {
            snackbarStore.show("Notifiche bloccate dal browser: puoi sbloccarle dalle impostazioni del sito", 5000, 'top', 'warning')
        }
    } catch (error) {
        console.error(error)
        snackbarStore.show('Non è stato possibile attivare le notifiche', 4000, 'top', 'error')
    } finally {
        busy.value = false
        dialog.value = false
    }
}

async function later() {
    dialog.value = false
    if (firstTime.value) {
        await declinePush()
    } else {
        dismissOnThisDevice()
    }
}
</script>

<template>
    <v-dialog v-model="dialog" max-width="420" persistent>
        <v-card>
            <v-card-item>
                <template v-slot:prepend>
                    <v-icon icon="mdi-bell-ring" color="primary" size="32"></v-icon>
                </template>
                <v-card-title>Notifiche dei nuovi ordini</v-card-title>
            </v-card-item>
            <v-card-text class="d-flex flex-column ga-3">
                <p v-if="firstTime">
                    Quando un cameriere invia un ordine per la tua postazione, ti arriva una notifica sul telefono,
                    anche con lo schermo spento o con l'app chiusa.
                </p>
                <p v-else>
                    Hai le notifiche dei nuovi ordini attive, ma non su questo dispositivo. Vuoi riceverle anche qui?
                </p>
                <p>Dopo aver premuto <b>Attiva</b> il browser ti chiederà il permesso.</p>
                <p class="text-medium-emphasis">Puoi cambiare idea quando vuoi dal tuo profilo.</p>
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn variant="text" :disabled="busy" @click="later">{{ firstTime ? 'No, grazie' : 'Non ora' }}</v-btn>
                <v-btn variant="flat" color="primary" :loading="busy" @click="activate">Attiva</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
