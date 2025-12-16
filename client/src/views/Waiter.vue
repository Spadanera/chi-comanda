<script setup lang="ts">
import type { RestaurantLayout, AvailableTable, Room } from "../../../models/src"
import { ref, computed, onUnmounted, watch } from "vue"
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
const tables = ref<AvailableTable[]>([])
const snackbarStore = SnackbarStore()
const axios = new Axios()
const loading = ref<boolean>(false)
const activeRoomId = ref<number>()
const rooms = ref<Room[]>([])
const selectedTableId = ref<number>(0)
const zoomLevel = ref(1)
let reloadTimeout: ReturnType<typeof setTimeout>

const currentRoom = computed(() => rooms.value.find(r => r.id === activeRoomId.value))
const roomSelected = computed(() => activeRoomId.value && rooms.value.length)

const onTableClick = (table: AvailableTable) => {
  router.push(`/waiter/${props.event?.id}/mastertable/${table?.master_table_id}/table/${table.table_id}/menu/${props.event.menu_id}${queryToPass}`)
}

const extraTableClick = () => {
  router.push(`/waiter/${props.event?.id}/mastertable/0/table/0/menu/${props.event.menu_id}`)
}

function reloadTableHandlerasync() {
  clearTimeout(reloadTimeout)
  reloadTimeout = setTimeout(async () => {
    await getTables()
    snackbarStore.show("Tavoli aggiornati")
  }, 300)
}

async function getTables() {
  const layout: RestaurantLayout = await axios.GetWaiterLayout(props.event.id)
  rooms.value = layout.rooms || []
  tables.value = layout.tables
  if (tables.value.find(t => t.room_id === 0)) {
    rooms.value.push({
      id: 0,
      name: 'Extra'
    } as Room)
  }
}

async function handleReconnection() {
  if (is) {
    is.emit('join', 'waiter')
    await getTables()
  }
}

async function init() {
  if (props.event && props.event.id) {
    loading.value = true
    await getTables()
    if (rooms.value.length) {
      activeRoomId.value = rooms.value[0].id
    }
    if (is) {
      is.emit('join', 'waiter')
      is.on('reload-table', reloadTableHandlerasync)
      is.on('connect', handleReconnection)
    }
    loading.value = false
  }
}

watch(() => props.event, init, { immediate: true })

onUnmounted(() => {
  clearTimeout(reloadTimeout)
  if (is) {
    is.emit('leave', 'waiter')
    is.off('reload-table', reloadTableHandlerasync)
    is.off('connect', handleReconnection)
  }
})
</script>

<template>
  <main>
    <v-skeleton-loader v-if="loading" type="card"></v-skeleton-loader>
    <v-container v-else-if="!props.event?.id">
      <NoEvent></NoEvent>
    </v-container>
    <v-container v-else style="margin: 0; padding: 0; min-width: 100%; max-height: calc(100vh - 64px);">
      <RoomTabs v-model="activeRoomId" :rooms="rooms" :editing="false" />

      <RestaurantMap :room="currentRoom" :tables="tables" :zoom="zoomLevel" :selected-table-id="selectedTableId"
        :editable="false" @click-table="onTableClick" />

      <v-fab @click="extraTableClick()" v-if="roomSelected !== undefined" prepend-icon="mdi-plus" app text="Extra"
        appear style="position: fixed; right: 15px; bottom: 15px;" location="bottom right"></v-fab>
    </v-container>
  </main>
</template>

<style scoped>
.v-card {
  text-align: center;
  font-size: large;
}
</style>