<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { type Event } from "../../../models/src"
import Confirm from '@/components/Confirm.vue'
import Axios from '@/services/client'
import { groupItems, copy, sortItem } from "@/services/utils"

const emit = defineEmits(['reload'])
const props = defineProps(['ongoing'])

const axios = new Axios()

const events = defineModel<Event[]>({ default: [] })

const confirmCloseEvent = ref<boolean>(false)
const confirmDeleteEvent = ref<boolean>(false)
const selectedEvent = ref<Event>(null)

function closeEventConfirm(event: Event) {
    selectedEvent.value = copy<Event>(event)
    selectedEvent.value.status = 'CLOSED'
    confirmCloseEvent.value = true
    emit('reload')
}

function deleteEventConfirm(event: Event) {
    selectedEvent.value = copy<Event>(event)
    confirmDeleteEvent.value = true
    emit('reload')
}

async function closeEvent() {
    await axios.SetEventStatus(selectedEvent.value)
    confirmCloseEvent.value = false
    emit('reload')
}

async function deleteEvent() {
    await axios.DeleteEvent(selectedEvent.value.id)
    confirmDeleteEvent.value = false
    emit('reload')
}

async function setEventStatus(event: Event, status: string) {
    const _event = copy<Event>(event)
    _event.status = status
    await axios.SetEventStatus(_event)
    emit('reload')
}

onMounted(() => {

})
</script>
<template>
    <v-container>
        <v-row>
            <v-col v-for="event in events" sm="6" xs="12" lg="4">
                <v-card :subtitle="event.name" :title="event.date.toString().split('T')[0]">
                    <v-card-text>
                        <v-btn readonly size="small" density="compact" variant="plain">
                            <v-icon>mdi-table-furniture</v-icon> 10
                        </v-btn>
                        <v-btn readonly size="small" density="compact" variant="plain">
                            <v-icon>mdi-hamburger</v-icon> 10
                        </v-btn>
                        <v-btn readonly size="small" density="compact" variant="plain">
                            <v-icon>mdi-beer</v-icon> 10
                        </v-btn>
                        <v-btn readonly size="small" density="compact" variant="plain">
                            <v-icon>mdi-currency-eur</v-icon> 10
                        </v-btn>
                    </v-card-text>
                    <v-card-actions v-if="event.status === 'ONGOING' || event.status === 'PLANNED'">
                        <v-btn text="CHIUDI EVENTO" v-if="event.status === 'ONGOING'" size="small"
                            density="compact" variant="plain" @click="closeEventConfirm(event)"></v-btn>
                        <v-btn text="ANNULLA" v-if="event.status === 'ONGOING'" size="small"
                            density="compact" variant="plain" @click="setEventStatus(event, 'PLANNED')"></v-btn>
                        <v-btn text="APRI EVENTO" v-if="event.status === 'PLANNED' && !ongoing" size="small"
                            density="compact" variant="plain" @click="setEventStatus(event, 'ONGOING')"></v-btn>
                        <v-btn text="ELIMINA" v-if="event.status === 'PLANNED'" size="small" density="compact"
                            variant="plain" @click="deleteEventConfirm(event)"></v-btn>
                    </v-card-actions>
                </v-card>
            </v-col>
        </v-row>
    </v-container>
    <Confirm v-model="confirmCloseEvent">
        <template v-slot:action>
            <v-btn text="Conferma" variant="plain" @click="closeEvent"></v-btn>
        </template>
    </Confirm>
    <Confirm v-model="confirmDeleteEvent">
        <template v-slot:action>
            <v-btn text="Conferma" variant="plain" @click="deleteEvent"></v-btn>
        </template>
    </Confirm>
</template>
