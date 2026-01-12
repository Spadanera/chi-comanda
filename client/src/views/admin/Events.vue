<script setup lang="ts">
import { ref, onMounted, watch } from "vue"
import { type Event, type Event as EventType, type User } from "../../../../models/src"
import Axios from '@/services/client'
import { SnackbarStore } from '@/stores'
import { requiredRule, copy } from "@/services/utils"
import EventList from "@/components/EventList.vue"
import Avatar from "@/components/Avatar.vue"

const props = defineProps(['event'])

const menuStart = ref(false)
const menuEnd = ref(false)

function formatDate(date: any) {
  if (!date) return null
  return new Date(date).toLocaleDateString('it-IT')
}

const axios = new Axios()
const snackbarStore = SnackbarStore()
const tab = ref('ONGOING')
const events = ref<EventType[]>([])
const dialog = ref(false)
const dialogEvent = ref<EventType>(null)
const loading = ref(false)
const form = ref(null)
const menu = ref([])
const users = ref<User[]>([])

const page = ref(1)
const totalPages = ref(1)
const dateRange = ref({ start: null, end: null })

async function getAllEvents(status: string) {
  let end: Date | null = dateRange.value.end ? new Date(dateRange.value.end) : null
  let endString: string | undefined

  if (end) {
    end.setHours(23, 59, 59, 999)
    endString = end.toISOString()
  }

  const filters = status === 'CLOSED'
    ? { page: page.value, start: dateRange.value.start, end: endString }
    : undefined
  const data = await axios.GetAllEvents(status, filters)

  if ('events' in data) {
    events.value = data.events
    totalPages.value = data.totalPages || 1
  } else {
    events.value = data
  }
}

async function openDialog(event?: Event) {
  if (event) {
    const e = copy<Event>(event)
    e.date = new Date(e.date)
    dialogEvent.value = e
  } else {
    dialogEvent.value = {
      name: 'Serata Standard',
      date: new Date(),
      minimumConsumptionPrice: 5
    } as EventType
  }

  const [menuRes, usersRes] = await Promise.all([
    axios.GetAllMenu(),
    axios.GetAvailableUsers()
  ])

  menu.value = menuRes
  users.value = usersRes

  if (menu.value.length && !dialogEvent.value.id) {
    dialogEvent.value.menu_id = menu.value[0].id
  }
  dialog.value = true
}

async function upsertEvent() {
  const { valid } = await form.value?.validate()
  if (!valid) return

  const _event = copy<Event>(dialogEvent.value)
  if (typeof _event.date === 'string') {
    _event.date = new Date(_event.date)
  }
  _event.date.setHours(_event.date.getHours() + 4)
  _event.users = _event.users.map(({ id }) => ({ id } as User))

  if (!_event.id) {
    await axios.CreateEvent(_event)
    snackbarStore.show('Evento creato con successo', 3000, 'bottom', 'success')
  } else {
    await axios.EditEvent(_event)
    snackbarStore.show('Evento modificato con successo', 3000, 'bottom', 'success')
  }
  await load()
  dialog.value = false
}

async function load(status?: string) {
  if (!tab.value) return
  loading.value = true
  if (status && typeof status === 'string') {
    tab.value = status
  }
  await getAllEvents(tab.value)
  loading.value = false
}

watch(tab, (val) => {
  if (val !== 'CLOSED') {
    page.value = 1
    dateRange.value = { start: null, end: null }
  }
  load()
})

watch([page, () => dateRange.value.start, () => dateRange.value.end], ([nPage, nStart, nEnd], [oPage, oStart, oEnd]) => {
  if (tab.value !== 'CLOSED') return

  if (nStart !== oStart || nEnd !== oEnd) {
    if (page.value !== 1) {
      page.value = 1
      return
    }
  }

  load()
})

onMounted(async () => {
  await load()
  if (events.value.length === 0) {
    tab.value = 'PLANNED'
  }
})
</script>

<template>
  <v-tabs v-model="tab" grow>
    <v-tab value="ONGOING">Eventi Attivo</v-tab>
    <v-tab value="PLANNED">Eventi Programmati</v-tab>
    <v-tab value="CLOSED">Eventi Chiusi</v-tab>
  </v-tabs>

  <v-tabs-window v-model="tab" style="padding-bottom: 80px;">
    <v-tabs-window-item v-for="item in ['ONGOING', 'PLANNED', 'CLOSED']" :key="item" :value="item">
      <v-skeleton-loader type="card" v-if="loading"></v-skeleton-loader>
      <EventList :ongoing="props.event.id > 0" v-else v-model="events" @reload="load" @editevent="openDialog">
      </EventList>
    </v-tabs-window-item>
  </v-tabs-window>

  <v-footer app v-if="tab === 'CLOSED'" class="d-flex flex-column align-center pa-2 bg-grey-lighten-4" elevation="4">
    <div class="d-flex w-100 align-center justify-center gap-4 mb-2">

      <v-menu v-model="menuStart" :close-on-content-click="false" location="top center">
        <template v-slot:activator="{ props }">
          <v-text-field v-bind="props" :model-value="formatDate(dateRange.start)" label="Da"
            prepend-inner-icon="mdi-calendar" density="compact" hide-details variant="outlined" readonly
            style="max-width: 180px;" clearable @click:clear="dateRange.start = null"></v-text-field>
        </template>
        <v-date-picker v-model="dateRange.start" hide-header color="primary"
          @update:model-value="menuStart = false"></v-date-picker>
      </v-menu>

      <v-menu v-model="menuEnd" :close-on-content-click="false" location="top center">
        <template v-slot:activator="{ props }">
          <v-text-field v-bind="props" :model-value="formatDate(dateRange.end)" label="A"
            prepend-inner-icon="mdi-calendar" density="compact" hide-details variant="outlined" readonly
            style="max-width: 180px;" clearable @click:clear="dateRange.end = null"></v-text-field>
        </template>
        <v-date-picker v-model="dateRange.end" hide-header color="primary"
          @update:model-value="menuEnd = false"></v-date-picker>
      </v-menu>

    </div>
    <v-pagination v-model="page" :length="totalPages" density="compact" total-visible="5"></v-pagination>
  </v-footer>

  <v-fab v-if="tab === 'PLANNED'" icon="mdi-plus" app style="position: fixed; right: 10px; bottom: 10px;"
    location="bottom right" @click="openDialog()"></v-fab>

  <v-dialog v-model="dialog" width="380px">
    <v-card>
      <v-card-title>{{ dialogEvent.id ? 'Modifica Evento' : 'Crea Nuovo Evento' }}</v-card-title>
      <v-card-text>
        <v-form @submit.prevent ref="form">
          <v-text-field v-model="dialogEvent.name" :disabled="!!dialogEvent.id && dialogEvent.status === 'ONGOING'"
            :readonly="!!dialogEvent.id && dialogEvent.status === 'ONGOING'" label="Nome Evento"
            :clearable="!dialogEvent.id" :rules="[requiredRule]"></v-text-field>
          <v-select label="Menu" :items="menu" :disabled="!!dialogEvent.id && dialogEvent.status === 'ONGOING'"
            :readonly="!!dialogEvent.id && dialogEvent.status === 'ONGOING'" v-model="dialogEvent.menu_id"
            item-value="id" item-title="name" :rules="[requiredRule]"></v-select>
          <v-select label="Lavoranti" :items="users" v-model="dialogEvent.users" item-value="id" item-title="username"
            multiple :rules="[requiredRule]" return-object>
            <template v-slot:item="{ props, item }">
              <v-list-item v-bind="props" :title="item.title">
                <template v-slot:prepend>
                  <Avatar :user="item.raw" alt size="small"></Avatar>
                </template>
              </v-list-item>
            </template>
            <template v-slot:selection="{ item }">
              <v-chip>
                <Avatar :user="item.raw" alt size="small"></Avatar>
                <span style="margin-left: 5px;">{{ item.title }}</span>
              </v-chip>
            </template>
          </v-select>
          <v-text-field v-model="dialogEvent.minimumConsumptionPrice" :disabled="!!dialogEvent.id && dialogEvent.status === 'ONGOING'"
            :readonly="!!dialogEvent.id && dialogEvent.status === 'ONGOING'" label="Prezzo Consumazione Minima"
            :clearable="dialogEvent.status !== 'ONGOING'" type="number" append-inner-icon="mdi-currency-eur"></v-text-field>
          <v-date-picker hide-header locale="it" :disabled="!!dialogEvent.id && dialogEvent.status === 'ONGOING'"
            :readonly="!!dialogEvent.id && dialogEvent.status === 'ONGOING'" first-day-of-week="1"
            v-model:model-value="dialogEvent.date"></v-date-picker>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-btn variant="plain" @click="dialog = false">ANNULLA</v-btn>
        <v-btn variant="plain" @click="upsertEvent">CONFERMA</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>