<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { type Event, type Item, type Table, ItemTypes as types } from "../../../models/src"
import Confirm from '@/components/Confirm.vue'
import Axios from '@/services/client'
import { copy, sortItem, getIcon } from "@/services/utils"
import EventDetails from '@/components/EventDetails.vue'

const emit = defineEmits(['reload'])
const props = defineProps(['ongoing'])

const axios = new Axios()

const events = defineModel<Event[]>({ default: [] })

const confirmCloseEvent = ref<boolean>(false)
const confirmDeleteEvent = ref<boolean>(false)
const selectedEvent = ref<Event>(null)
const selectedTable = ref<Table>(null)
const bottomSheet = ref<boolean>(null)
const tab = ref<number>(0)
const drawer = ref<boolean>(true)

const items = computed<Item[]>(() => {
    const _items: Item[] = []
    if (selectedEvent.value && selectedEvent.value.tables) {
        selectedEvent.value.tables.forEach((t: Table) => {
            _items.push(...t.items)
        })
    }
    return _items
})

function closeEventConfirm(event: Event) {
    selectedEvent.value = copy<Event>(event)
    selectedEvent.value.status = 'CLOSED'
    confirmCloseEvent.value = true
}

function deleteEventConfirm(event: Event) {
    selectedEvent.value = copy<Event>(event)
    confirmDeleteEvent.value = true
}

async function closeEvent() {
    await axios.SetEventStatus(selectedEvent.value)
    confirmCloseEvent.value = false
    emit('reload', true)
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
    emit('reload', true)
}

async function showEvent(event: Event) {
    if (event.status !== 'PLANNED') {
        selectedEvent.value = copy<Event>(event)
        const _event: Event = await axios.GetEvent(event.id)
        selectedEvent.value.tables = _event.tables
        bottomSheet.value = true
    }
}

function getExtendedDate(dateString: string): string {
    const date = new Date(dateString);

    const options: Intl.DateTimeFormatOptions = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    };

    return date.toLocaleDateString("it-IT", options);
}

onMounted(() => {

})
</script>
<template>
    <v-container>
        <v-row>
            <v-col v-for="event in events" sm="6" cols="12" lg="4">
                <v-card :title="getExtendedDate(event.date.toString())" @click="showEvent(event)">
                    <v-card-subtitle>{{ event.name }} <span v-if="event.status === 'ONGOING'"> - <span
                                style="font-weight: bold">Incasso attuale: {{ event.currentPaid }}
                                €</span></span></v-card-subtitle>
                    <v-card-text v-show="event.status !== 'PLANNED'">
                        <v-btn readonly size="small" density="compact" variant="plain">
                            <v-icon>mdi-table-furniture</v-icon> {{ event.tableCount }}
                        </v-btn>
                        <v-btn readonly size="small" density="compact" variant="plain">
                            <v-icon>mdi-beer</v-icon> {{ event.beverageCount }}
                        </v-btn>
                        <v-btn readonly size="small" density="compact" variant="plain">
                            <v-icon>mdi-hamburger</v-icon> {{ event.foodCount }}
                        </v-btn>
                        <v-btn readonly size="small" density="compact" variant="plain">
                            <v-icon>mdi-currency-eur</v-icon> {{ event.revenue }}
                        </v-btn>
                        <v-btn readonly size="small" density="compact" variant="plain">
                            <v-icon>mdi-cart-percent</v-icon> {{ event.discount * -1 }} €
                        </v-btn>
                    </v-card-text>
                    <v-card-actions v-if="event.status === 'ONGOING' || event.status === 'PLANNED'">
                        <v-btn text="APRI EVENTO" v-if="event.status === 'PLANNED' && !ongoing" size="small"
                            density="compact" variant="plain" @click.stop="setEventStatus(event, 'ONGOING')"></v-btn>
                        <v-btn text="ELIMINA" v-if="event.status === 'PLANNED'" size="small" density="compact"
                            variant="plain" @click.stop="deleteEventConfirm(event)"></v-btn>
                        <v-btn text="CHIUDI EVENTO" v-if="event.status === 'ONGOING' && event.tablesOpen === 0"
                            size="small" density="compact" variant="plain"
                            @click.stop="closeEventConfirm(event)"></v-btn>
                        <v-btn text="SONO PRESENTI TAVOLI APERTI"
                            v-if="event.status === 'ONGOING' && event.tablesOpen > 0" size="small" density="compact"
                            variant="plain" :readonly="true" @click.stop="closeEventConfirm(event)"></v-btn>
                        <v-btn text="ANNULLA" v-if="event.status === 'ONGOING' && event.tableCount === 0" size="small"
                            density="compact" variant="plain" @click.stop="setEventStatus(event, 'PLANNED')"></v-btn>
                    </v-card-actions>
                </v-card>
            </v-col>
        </v-row>
    </v-container>
    <v-bottom-sheet scrollable v-model="bottomSheet">
        <EventDetails v-model="selectedEvent" @close="bottomSheet = false"></EventDetails>
    </v-bottom-sheet>
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
