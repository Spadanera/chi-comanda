<script setup lang="ts">
import { ref, onMounted, computed } from "vue"
import { type Event, type Event as EventType, type User } from "../../../../models/src"
import Axios from '@/services/client'
import { SnackbarStore } from '@/stores'
import { requiredRule, copy } from "@/services/utils"
import EventList from "@/components/EventList.vue"
import Avatar from "@/components/Avatar.vue"
const axios = new Axios()
const snackbarStore = SnackbarStore()
const tab = ref<string>(null)
const events = ref<EventType[]>([])
const dialog = ref<boolean>(false)
const dialogEvent = ref<EventType>(null)
const loading = ref<boolean>(false)
const form = ref(null)
const menu = ref([])
const users = ref<User[]>([])


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

async function openDialog(event?: Event) {
  if (event) {
    const e = copy<Event>(event)
    e.date = new Date(e.date)
    dialogEvent.value = e
  }
  else {
    dialogEvent.value = {
      name: 'Serata Standard',
      date: new Date()
    } as EventType
  }
  menu.value = await axios.GetAllMenu()
  users.value = await axios.GetAvailableUsers()
  if (menu.value.length) {
    dialogEvent.value.menu_id = menu.value[0].id
  }
  dialog.value = true
}

async function upsertEvent() {
  const { valid } = await form.value?.validate()
  if (valid) {
    const _event = copy<Event>(dialogEvent.value)
    if (typeof _event.date === 'string') {
      _event.date = new Date(_event.date)
    }
    _event.date.setHours(_event.date.getHours() + 4)
    _event.users = _event.users.map((u:User) => {
      return {
        id: u.id
      } as User
    })
    if (!_event.id) {
      await axios.CreateEvent(_event)
      snackbarStore.show('Evento creato con successo', 3000, 'bottom', 'success')
    }
    else {
      await axios.EditEvent(_event)
      snackbarStore.show('Evento modificato con successo', 3000, 'bottom', 'success')
    }
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
      <EventList v-else v-model="ongoingEvents" @reload="load" @editevent="openDialog"></EventList>
    </v-tabs-window-item>
    <v-tabs-window-item value="PLANNED">
      <v-skeleton-loader type="card" v-if="loading"></v-skeleton-loader>
      <EventList v-else :ongoing="ongoingEvents.length" v-model="futureEvents" @reload="load" @editevent="openDialog">
      </EventList>
    </v-tabs-window-item>
    <v-tabs-window-item value="CLOSED">
      <v-skeleton-loader type="card" v-if="loading"></v-skeleton-loader>
      <EventList v-else v-model="passedEvents" @reload="load"></EventList>
    </v-tabs-window-item>
  </v-tabs-window>
  <v-fab v-if="tab === 'PLANNED'" icon="mdi-plus" app style="position: fixed; right: 10px; bottom: 10px;"
    location="bottom right" @click="openDialog()"></v-fab>
  <v-dialog v-model="dialog" width="380px">
    <v-card>
      <v-card-title v-if="dialogEvent.id === undefined">
        Crea Nuovo Evento
      </v-card-title>
      <v-card-title v-else>
        Modifica Evento
      </v-card-title>
      <v-card-text>
        <v-form @submit.prevent ref="form">
          <v-text-field v-model="dialogEvent.name"
            :disabled="dialogEvent.id !== undefined && dialogEvent.status === 'ONGOING'"
            :readonly="dialogEvent.id !== undefined && dialogEvent.status === 'ONGOING'" label="Nome Evento"
            :clearable="dialogEvent.id === undefined" :rules="[requiredRule]"></v-text-field>
          <v-select label="Menu" :items="menu"
            :disabled="dialogEvent.id !== undefined && dialogEvent.status === 'ONGOING'"
            :readonly="dialogEvent.id !== undefined && dialogEvent.status === 'ONGOING'" v-model="dialogEvent.menu_id"
            item-value="id" item-title="name" :rules="[requiredRule]"></v-select>
          <v-select label="Lavoranti" :items="users" v-model="dialogEvent.users" item-value="id"
            item-title="username" multiple :rules="[requiredRule]" return-object>
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
          <v-date-picker hide-header locale="it"
            :disabled="dialogEvent.id !== undefined && dialogEvent.status === 'ONGOING'"
            :readonly="dialogEvent.id !== undefined && dialogEvent.status === 'ONGOING'" first-day-of-week="1"
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
