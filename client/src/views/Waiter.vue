<script setup lang="ts">
import type { RestaurantLayout, AvailableTable, Room } from "../../../models/src"
import { ref, onMounted, computed, onUnmounted } from "vue"
import Axios from '@/services/client'
import { sortAvailableTable } from "@/services/utils"
import { SnackbarStore } from '@/stores'
import { useRoute } from 'vue-router'
import RoomTabs from '@/components/RoomTabs.vue'
import RestaurantMap from "@/components/RestaurantMap.vue"
import { useRouter } from 'vue-router'

const emit = defineEmits(['login', 'reload'])
const props = defineProps(['is', 'event'])

const router = useRouter()

const route = useRoute()
const queryToPass = route.query.origin ? `?origin=${route.query.origin}` : ''
const is = props.is
const event = props.event
const tables = ref<AvailableTable[]>([])
const snackbarStore = SnackbarStore()
const axios = new Axios()
const loading = ref<boolean>(true)
const activeRoomId = ref<number>()
const rooms = ref<Room[]>([])
const selectedTableId = ref<number>(0)
const zoomLevel = ref(1)
// const availableTable = computed<AvailableTable[]>(() => tables.value.filter(t => !t.event_id).sort(sortAvailableTable))
// const activeTable = computed<AvailableTable[]>(() => tables.value.filter(t => t.event_id).sort(sortAvailableTable))

const currentRoom = computed(() => rooms.value.find(r => r.id === activeRoomId.value))
const roomTables = computed(() => tables.value.filter(t => t.room_id === activeRoomId.value))
const roomSelected = computed(() => activeRoomId.value && rooms.value.length)

const onTableClick = (table: AvailableTable) => {
    router.push(`/waiter/${event?.id}/mastertable/${table?.master_table_id}/table/0/menu/${event.menu_id}${queryToPass}`)
}

async function reloadTableHandlerasync() {
  await getTables()
  snackbarStore.show("Tavoli aggiornati")
}

async function getTables() {
  const layout:RestaurantLayout = await axios.GetWaiterLayout(event.id)
  rooms.value = layout.rooms || []
  tables.value = layout.tables
  if (tables.value.find(t => t.room_id === 0)) {
    rooms.value.push({
      id: 0,
      name: 'Personalizzata'
    } as Room)
  }
}

onMounted(async () => {
  if (event && event.id) {
    await getTables()
    if (rooms.value.length) {
      activeRoomId.value = rooms.value[0].id
    }
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
    <v-container v-else style="margin: 0; padding: 0; min-width: 100%; max-height: calc(100vh - 64px);">
      <RoomTabs v-model="activeRoomId" :rooms="rooms" :editing="false" />

      <RestaurantMap :room="currentRoom" :tables="tables" :zoom="zoomLevel"
                    :selected-table-id="selectedTableId" :editable="false" @click-table="onTableClick" />

      <!-- <v-row>
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
      </v-row> -->
    </v-container>
  </main>
</template>

<style scoped>
.v-card {
  text-align: center;
  font-size: large;
}
</style>