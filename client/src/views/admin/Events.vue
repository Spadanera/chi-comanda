<script setup lang="ts">
import { ref, onMounted, computed } from "vue"
import EventList from "@/components/EventList.vue";
import { type Event as EventType } from "../../../../models/src"
import Axios from '@/services/client'
import { SnackbarStore } from '@/stores'

const axios = new Axios()
const snackbarStore = SnackbarStore()
const tab = ref<string>(null)
const events = ref<EventType[]>([])
const dialog = ref<boolean>(false)
const dialogEvent = ref<EventType>(null)
const loading = ref<boolean>(false)
const form = ref(null)
const requiredRule = ref([(value: any) => !!value || 'Inserire un valore'])

const ongoingEvents = computed<EventType[]>(() => {
  return events.value.filter(e => e.status === 'ONGOING')
})

const futureEvents = computed<EventType[]>(() => {
  return events.value.filter(e => e.status === 'PLANNED').sort((a: EventType, b: EventType) => a.date < b.date ? -1 : 1)
})

const passedEvents = computed<EventType[]>(() => {
  return events.value.filter(e => e.status === 'CLOSED')
})

async function getAllEvents() {
  events.value = await axios.GetAllEvents()
}

function openDialog() {
  dialogEvent.value = {
    name: 'Serata Standard',
    date: new Date()
  } as EventType
  dialog.value = true
}

async function createEvent() {
  const { valid } = await form.value?.validate()
  if (valid) {
    await axios.CreateEvent(dialogEvent.value)
    snackbarStore.show('Evento creato con successo', 3000, 'bottom', 'success')
    await load()
    dialog.value = false
  }
}

async function load(goToOngoing: boolean = false) {
  loading.value = true
  await getAllEvents()
  if (goToOngoing) {
    tab.value = ongoingEvents.value.length ? 'ONGOING' : 'PLANNED'
  } else if (!ongoingEvents.value.length && tab.value === 'ONGOING') {
    tab.value = 'PLANNED'
  }
  loading.value = false
}

onMounted(async () => {
  await load()
})
</script>
<template>
  <v-tabs v-model="tab" grow>
    <v-tab value="ONGOING">Eventi Attivo</v-tab>
    <v-tab value="PLANNED">Eventi Programmati</v-tab>
    <v-tab value="CLOSED">Eventi Chiusi</v-tab>
  </v-tabs>
  <v-tabs-window v-model="tab">
    <v-tabs-window-item value="ONGOING">
      <v-skeleton-loader type="card" v-if="loading"></v-skeleton-loader>
      <EventList v-else v-model="ongoingEvents" @reload="load"></EventList>
    </v-tabs-window-item>
    <v-tabs-window-item value="PLANNED">
      <v-skeleton-loader type="card" v-if="loading"></v-skeleton-loader>
      <EventList v-else :ongoing="ongoingEvents.length" v-model="futureEvents" @reload="load"></EventList>
    </v-tabs-window-item>
    <v-tabs-window-item value="CLOSED">
      <v-skeleton-loader type="card" v-if="loading"></v-skeleton-loader>
      <EventList v-else v-model="passedEvents" @reload="load"></EventList>
    </v-tabs-window-item>
  </v-tabs-window>
  <v-fab v-if="tab === 'PLANNED'" icon="mdi-plus" app style="position: fixed; right: 10px; bottom: 10px;"
    location="bottom right" @click="openDialog"></v-fab>
  <v-dialog v-model="dialog" width="380px">
    <v-card>
      <v-card-title>
        Crea nuovo evento
      </v-card-title>
      <v-card-text>
        <v-form @submit.prevent ref="form">
          <v-text-field v-model="dialogEvent.name" label="Nome Evento" clearable :rules="requiredRule">

          </v-text-field>
          <v-date-picker locale="it" first-day-of-week="1" v-model:model-value="dialogEvent.date"></v-date-picker>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-btn variant="plain" @click="dialog = false">ANNULLA</v-btn>
        <v-btn variant="plain" @click="createEvent">CONFERMA</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
