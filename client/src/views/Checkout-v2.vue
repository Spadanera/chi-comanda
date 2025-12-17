<script setup lang="ts">
import type { Table, SubType, RestaurantLayout, Room, MasterTable, User } from "../../../models/src"
import { ref, computed, onUnmounted, watch } from "vue"
import Axios from '@/services/client'
import { SnackbarStore } from '@/stores'
import CheckoutOrder from "@/components/CheckoutOrder.vue"
import CheckoutTableSelection from "@/components/CheckoutTableSelection.vue"
import RoomTabs from '@/components/RoomTabs.vue'
import RestaurantMap from "@/components/RestaurantMap.vue"
import CheckoutClosed from "@/components/Checkout-Closed.vue"
import { useDisplay } from 'vuetify'

const { smAndUp } = useDisplay()

const props = defineProps(['is', 'event'])

const axios = new Axios()
const is = props.is
const user = defineModel<User>()
const snackbarStore = SnackbarStore()

const emit = defineEmits(['login', 'reload'])

const loading = ref<boolean>(false)
const tables = ref<MasterTable[]>([])
const selectedTable = ref<Table[]>([])
const tableSheet = ref<boolean>(false)
const types = ref<SubType[]>([])
const drawer = ref<boolean>(smAndUp.value ? true : false)

const activeRoomId = ref<number>()
const rooms = ref<Room[]>([])
const selectedTableId = ref<number>(0)
const zoomLevel = ref(1)
let reloadTimeout: ReturnType<typeof setTimeout>

const currentRoom = computed(() => rooms.value.find(r => r.id === activeRoomId.value))

const onTableClick = async (table: Table) => {
  if (table.table_id) {
    await selectTable(table)
    drawer.value = true
  }
}

const selectTable = async (table: Table) => {
  const res = await axios.GetByTableId(table.table_id, props.event.id)
  if (res) {
    selectedTableId.value = table.table_id
    selectedTable.value[0] = {
      ...table,
      ...res
    } as Table
  }
}

const reloadTableHandlerasync = () => {
  clearTimeout(reloadTimeout)
  reloadTimeout = setTimeout(async () => {
    await getTables()
    snackbarStore.show("Tavoli aggiornati")
  }, 300)
}

const getTables = async (table_id?: number) => {
  const layout: RestaurantLayout = await axios.GetWaiterLayout(props.event.id)
  rooms.value = layout.rooms || []
  tables.value = layout.tables

  for (let i = rooms.value.length - 1; i >= 0; i--) {
    if (rooms.value[i].id === 0 || rooms.value[i].id === -1) {
      rooms.value.splice(i, 1)
    }
  }

  if (tables.value.find(t => t.room_id === 0)) {
    rooms.value.push({
      id: 0,
      name: 'Extra'
    } as Room)
  }

  rooms.value.push({
    id: -1,
    name: 'Chiusi'
  } as Room)

  if (table_id) {
    selectedTableId.value = table_id
  }

  if (selectedTableId.value) {
    const tb = tables.value.find(t => t.table_id === selectedTableId.value)
    if (tb) {
      activeRoomId.value = tb.room_id
      selectTable(tb)
      if (table_id) {
        drawer.value = true
      }
    } else {
      selectedTableId.value = 0
      selectedTable.value = []
      if (!smAndUp.value) {
        drawer.value = false
      }
    }
  }
}

const newOrderHandler = () => {
  getTables()
}

const itemRemovedHandler = () => {
  getTables()
}

const orderCompletedHandler = () => {
  getTables()
}

const handleReconnection = async () => {
  if (is) {
    is.emit('join', 'checkout')
    is.on('reload-table', reloadTableHandlerasync)
    await getTables()
  }
}

const init = async () => {
  if (props.event && props.event.id) {
    loading.value = true
    types.value = await axios.GetSubTypes()
    await getTables()

    is.emit('join', 'checkout')
    is.on('new-order', newOrderHandler)
    is.on('item-removed', itemRemovedHandler)
    is.on('order-completed', orderCompletedHandler)
    is.on('connect', handleReconnection)
    loading.value = false
  }
}

watch(() => props.event, init, { immediate: true })

watch(() => activeRoomId.value, () => { 
  selectedTable.value = []
  selectedTableId.value = 0
}, { immediate: true })

onUnmounted(() => {
  if (is) {
    is.emit('leave', 'checkout')
    is.off('new-order', newOrderHandler)
    is.off('item-removed', itemRemovedHandler)
    is.off('order-completed', orderCompletedHandler)
    is.off('connect', handleReconnection)
  }
})
</script>

<template>
  <v-navigation-drawer v-if="props.event?.id && activeRoomId > -1" v-model="drawer" mobile-breakpoint="sm" :width="450" location="right">
    <CheckoutOrder v-if="selectedTable.length" :event="props.event" :roomid="activeRoomId" v-model:selected-table="selectedTable"
      @get-tables="getTables" @change-table-sheet="tableSheet = true" v-model:drawer="drawer" :navigation="true" />
    <v-alert type="info" variant="tonal" class="ma-auto" v-else>Nessun Tavolo Selezionato</v-alert>
  </v-navigation-drawer>
  <v-skeleton-loader type="card" v-if="loading"></v-skeleton-loader>
  <v-container v-else-if="!props.event?.id">
    <NoEvent></NoEvent>
  </v-container>
  <v-container v-else style="padding: 0;">
    <RoomTabs v-model="activeRoomId" :rooms="rooms" :editing="false" />

    <RestaurantMap v-if="activeRoomId > -1" :highlight-selection="true" :room="currentRoom" :tables="tables"
      :zoom="zoomLevel" :selected-table-id="selectedTableId" :editable="false" @click-table="onTableClick" />
    <CheckoutClosed @get-tables="getTables" :event="props.event" v-else></CheckoutClosed>
  </v-container>
  <CheckoutTableSelection v-model="tableSheet" :event="props.event" :selected-table="selectedTable"
    @changed="getTables" />
  <v-fab v-if="props.event?.id" to="/waiter?origin=/checkout" text="Ordine" prepend-icon="mdi-plus"
    location="bottom right" app extended appear></v-fab>
</template>