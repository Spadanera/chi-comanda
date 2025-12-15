<script setup lang="ts">
import { ref, onMounted, watch } from "vue"
import { type Event, type Event as EventType, type User } from "../../../../models/src"
import Axios from '@/services/client'
import { SnackbarStore } from '@/stores'
import { requiredRule, copy } from "@/services/utils"
import EventList from "@/components/EventList.vue"
import Avatar from "@/components/Avatar.vue"

const props = defineProps(['event'])

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

async function getAllEvents(status: string) {
  const data = await axios.GetAllEvents(status)
  events.value = data
}

async function openDialog(event?: Event) {
  if (event) {
    const e = copy<Event>(event)
    e.date = new Date(e.date)
    dialogEvent.value = e
  } else {
    dialogEvent.value = {
      name: 'Serata Standard',
      date: new Date()
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
  if (status) {
    tab.value = status
  }
  await getAllEvents(tab.value)
  loading.value = false
}

watch(tab, load)

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
  <v-tabs-window v-model="tab">
    <v-tabs-window-item v-for="item in ['ONGOING', 'PLANNED', 'CLOSED']" :key="item" :value="item">
      <v-skeleton-loader type="card" v-if="loading"></v-skeleton-loader>
      <EventList :ongoing="props.event.id > 0" v-else v-model="events" @reload="load" @editevent="openDialog">
      </EventList>
    </v-tabs-window-item>
  </v-tabs-window>
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