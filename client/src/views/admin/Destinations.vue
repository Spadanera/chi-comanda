<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { type Destination } from '../../../../models/src';
import { copy, requiredRule, positiveIntegerRule } from '@/services/utils';
import Axios from '@/services/client'

const destinations = ref<Destination[]>([])
const axios = new Axios()
const confirmDeleteDestination = ref<boolean>(false)
const selectedDestination = ref<Destination>(null)
const dialog = ref<boolean>(null)
const form = ref(null)

async function getDestinations() {
    destinations.value = await axios.GetDestinations()
}

async function deleteDestinationConfirm(destination: Destination) {
    selectedDestination.value = destination
    confirmDeleteDestination.value = true
}

async function deleteDestination() {
    selectedDestination.value.status = 'DELETED'
    await axios.EditDestination(selectedDestination.value)
    await getDestinations()
    confirmDeleteDestination.value = false
}

async function createDestination() {
    const { valid } = await form.value?.validate()
    if (valid) {
        await axios.CreateDestination(selectedDestination.value)
        await getDestinations()
        dialog.value = false
    }
}

async function editDestination() {
    const { valid } = await form.value?.validate()
    if (valid) {
        await axios.EditDestination(selectedDestination.value)
        await getDestinations()
        dialog.value = false
    }
}

function openDialog(destination?: Destination) {
    if (destination) {
        selectedDestination.value = copy<Destination>(destination)
    }
    else {
        selectedDestination.value = {
            status: 'ACTIVE',
            minute_to_alert: 15
        } as Destination
    }
    dialog.value = true
}

onMounted(async () => {
    await getDestinations()
})
</script>
<template>
    <v-container>
        <v-row>
            <v-col v-for="destination in destinations" sm="6" cols="12" lg="4">
                <v-card :title="destination.name">
                    <v-card-subtitle>
                        Minuti attesa servizio: <span class="font-weight-bold">{{ destination.minute_to_alert }}</span>
                    </v-card-subtitle>
                    <v-card-text v-if="destination.canDelete > 0">
                        Sono presenti elementi del menu collegati a questa destinazione
                    </v-card-text>
                    <v-card-actions>
                        <v-btn @click="deleteDestinationConfirm(destination)" :readonly="destination.canDelete > 0"
                            :disabled="destination.canDelete > 0" text="ELIMINA" variant="plain"></v-btn>
                        <v-btn text="MODIFICA" @click="openDialog(destination)" variant="plain"></v-btn>
                    </v-card-actions>
                </v-card>
            </v-col>
        </v-row>
    </v-container>
    <v-fab @click="openDialog()" icon="mdi-plus" app style="position: fixed; right: 15px; bottom: 15px;" location="bottom right"></v-fab>
    <v-dialog v-model="dialog" width="380px">
        <v-card>
            <v-card-title v-if="selectedDestination.id">
                Modifica destinazione
            </v-card-title>
            <v-card-title v-else>
                Crea nuova destinazione
            </v-card-title>
            <v-card-text>
                <v-form @submit.prevent ref="form">
                    <v-text-field label="Nome" :rules="[requiredRule]" v-model="selectedDestination.name"></v-text-field>
                    <v-text-field label="Minuti attesa servizio" type="number" :rules="[requiredRule, positiveIntegerRule]" v-model="selectedDestination.minute_to_alert"></v-text-field>
                </v-form>
            </v-card-text>
            <v-card-actions>
                <v-btn variant="plain" @click="dialog = false">ANNULLA</v-btn>
                <v-btn v-if="!selectedDestination.id" variant="plain" @click="createDestination">CONFERMA</v-btn>
                <v-btn v-else variant="plain" @click="editDestination">CONFERMA</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
    <Confirm v-model="confirmDeleteDestination">
        <template v-slot:action>
            <v-btn text="Conferma" variant="plain" @click="deleteDestination"></v-btn>
        </template>
    </Confirm>
</template>
