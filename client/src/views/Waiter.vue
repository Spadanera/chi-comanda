<script setup lang="ts">
import { type AvailableTable, type Event } from "../../../models/src"
import { ref, onMounted } from "vue"
import Axios from '@/services/client'

const emit = defineEmits(['login', 'reload'])

const tables = ref<AvailableTable[]>([])
const availableTable = ref<AvailableTable[]>([])
const activeTable = ref<AvailableTable[]>([])
const event = ref<Event>()
const axios = new Axios()
const loading = ref<boolean>(true)

function sortTable(a:AvailableTable, b:AvailableTable): number {
  const _a = a.table_name || a.master_table_name
  const _b = b.table_name || b.master_table_name
  const numRegex = /^\d+$/
  if (numRegex.test(_a)) {
    if (numRegex.test(_b)) {
      return parseInt(_a) - parseInt(_b)
    }
    else {
      return -1
    }
  }
  else {
    if (numRegex.test(_b)) {
      return 1
    }
    else {
      if (_a < _b) {
        return -1
      }
      else {
        return 1
      }
    }
  }
}

onMounted(async () => {
  event.value = await axios.GetOnGoingEvent()
  if (event.value.id) {
    tables.value = await axios.GetAvailableTables(event.value.id)
    availableTable.value = tables.value.filter(t => !t.event_id).sort(sortTable)
    activeTable.value = tables.value.filter(t => t.event_id).sort(sortTable)
    loading.value = false
  } else {
    loading.value = false
  }
})
</script>

<template>
  <main>
    <v-skeleton-loader v-if="loading" :loading="loading" type="card"></v-skeleton-loader>
    <p v-if="!event?.id && !loading">Nessun evento attivo</p>
    <v-container v-else>
      <v-row>
        <v-col>
          <h2>Tavoli attivi</h2>
        </v-col>
      </v-row>
      <v-row>
        <v-col v-for="table in activeTable" cols="4">
          <RouterLink :to="`/waiter/${event?.id}/order/${table?.master_table_id ? table?.master_table_id : 0}/table/${table.table_id}`">
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
          <RouterLink :to="`/waiter/${event?.id}/order/${table?.master_table_id}/table/0`">
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