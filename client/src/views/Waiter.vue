<script setup lang="ts">
import { type AvailableTable, type Event } from "../../../models/src"
import { ref, onMounted, computed, onBeforeUnmount } from "vue"
import Axios from '@/services/client'
import { sortAvailableTable } from "@/services/utils"
import { io } from 'socket.io-client'
import { SnackbarStore } from '@/stores'
import { useRoute } from 'vue-router'

const emit = defineEmits(['login', 'reload'])

const route = useRoute()
const queryToPass = route.query.origin ? `?origin=${route.query.origin}` : ''
var is: any
const tables = ref<AvailableTable[]>([])
const snackbarStore = SnackbarStore()
const event = ref<Event>()
const axios = new Axios()
const loading = ref<boolean>(true)
const availableTable = computed<AvailableTable[]>(() => tables.value.filter(t => !t.event_id).sort(sortAvailableTable))
const activeTable = computed<AvailableTable[]>(() => tables.value.filter(t => t.event_id).sort(sortAvailableTable))

onMounted(async () => {
  event.value = await axios.GetOnGoingEvent()
  if (event.value.id) {
    tables.value = await axios.GetAvailableTables(event.value.id)
    is = io(window.location.origin, {
      path: "/socket/socket.io"
    })

    is.on('connect', () => {
      is.emit('join', 'waiter')
    })

    is.on('disconnect', () => {

    })

    is.on('connect_error', (err: any) => {
      snackbarStore.show("Errore nella connessione, prova a ricaricare la pagina", -1, 'top', 'error', true)
      is.emit('end')
    })

    is.on('new-table-available', async () => {
      tables.value = await axios.GetAvailableTables(event.value.id)
      snackbarStore.show("Nuovo tavolo disponibile")
    })
  }
  loading.value = false
})

onBeforeUnmount(() => {
  is.emit('end')
})
</script>

<template>
  <main>
    <v-skeleton-loader v-if="loading" type="card"></v-skeleton-loader>
    <p v-if="!event?.id">Nessun evento attivo</p>
    <v-container v-else>
      <v-row>
        <v-col>
          <h2>Tavoli attivi</h2>
        </v-col>
      </v-row>
      <v-row>
        <v-col v-for="table in activeTable" cols="4">
          <RouterLink
            :to="`/waiter/${event?.id}/order/${table?.master_table_id ? table?.master_table_id : 0}/table/${table.table_id}${queryToPass}`">
            <v-card height="50px" style="padding-top: 10px;">
              {{ table.table_name }}
            </v-card>
          </RouterLink>
        </v-col>
      </v-row>
      <v-row>
        <v-col>
          <h2>Tavoli Disponibili</h2>
        </v-col>
      </v-row>
      <v-row>
        <v-col v-for="table in availableTable" cols="4">
          <RouterLink :to="`/waiter/${event?.id}/order/${table?.master_table_id}/table/0${queryToPass}`">
            <v-card height="50px" style="padding-top: 10px;">
              {{ table.master_table_name }}
            </v-card>
          </RouterLink>
        </v-col>
        <v-col cols="4">
          <RouterLink :to="`/waiter/${event?.id}/order/0/table/0`">
            <v-card height="50px" style="padding-top: 10px;">
              <v-icon>mdi-plus</v-icon>
            </v-card>
          </RouterLink>
        </v-col>
      </v-row>
    </v-container>
  </main>
</template>

<style scoped>
.v-card {
  text-align: center;
  font-size: large;
}
</style>