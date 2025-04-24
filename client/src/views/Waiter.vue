<script setup lang="ts">
import { type AvailableTable } from "../../../models/src"
import { ref, onMounted, computed, onUnmounted } from "vue"
import Axios from '@/services/client'
import { sortAvailableTable } from "@/services/utils"
import { SnackbarStore } from '@/stores'
import { useRoute } from 'vue-router'

const emit = defineEmits(['login', 'reload'])
const props = defineProps(['is', 'event'])

const route = useRoute()
const queryToPass = route.query.origin ? `?origin=${route.query.origin}` : ''
const is = props.is
const event = props.event
const tables = ref<AvailableTable[]>([])
const snackbarStore = SnackbarStore()
const axios = new Axios()
const loading = ref<boolean>(true)
const availableTable = computed<AvailableTable[]>(() => tables.value.filter(t => !t.event_id).sort(sortAvailableTable))
const activeTable = computed<AvailableTable[]>(() => tables.value.filter(t => t.event_id).sort(sortAvailableTable))


async function reloadTableHandlerasync() {
  tables.value = await axios.GetAvailableTables(event.id)
  snackbarStore.show("Tavoli aggiornati")
}

onMounted(async () => {
  if (event && event.id) {
    tables.value = await axios.GetAvailableTables(event.id)
    is.emit('join', 'waiter')

    is.on('reload-table', reloadTableHandlerasync)
  }
  loading.value = false
})

onUnmounted(() => {
  if (is) {
    is.emit('leave', 'waiter')
    is.off('reload-table', reloadTableHandlerasync)
  }
})
</script>

<template>
  <main>
    <v-skeleton-loader v-if="loading" type="card"></v-skeleton-loader>
    <v-container v-else-if="!event?.id">
      <h3>Cameriere</h3>
      <p>Nessun evento attivo</p>
    </v-container>
    <v-container v-else>
      <v-row>
        <v-col>
          <h2>Tavoli attivi</h2>
        </v-col>
      </v-row>
      <v-row>
        <v-col v-for="table in activeTable" cols="4">
          <RouterLink
            :to="`/waiter/${event?.id}/mastertable/${table?.master_table_id ? table?.master_table_id : 0}/table/${table.table_id}/menu/${event.menu_id}${queryToPass}`">
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
          <RouterLink
            :to="`/waiter/${event?.id}/mastertable/${table?.master_table_id}/table/0/menu/${event.menu_id}${queryToPass}`">
            <v-card height="50px" style="padding-top: 10px;">
              {{ table.master_table_name }}
            </v-card>
          </RouterLink>
        </v-col>
        <v-col cols="4">
          <RouterLink :to="`/waiter/${event?.id}/mastertable/0/table/0/menu/${event.menu_id}`">
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