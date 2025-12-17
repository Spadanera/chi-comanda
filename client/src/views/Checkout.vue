<script setup lang="ts">
import { type Table, type Item, type SubType, type CompleteOrderInput, type User } from "../../../models/src"
import { ref, computed, onUnmounted, watch } from "vue"
import Axios from '@/services/client'
import { SnackbarStore } from '@/stores'
import { copy, sortTables } from "@/services/utils"
import { RouterLink } from 'vue-router'
import CheckoutOrder from "@/components/CheckoutOrder.vue"
import CheckoutTableSelection from "@/components/CheckoutTableSelection.vue"

const props = defineProps(['is', 'event'])

const axios = new Axios()
const is = props.is
const user = defineModel<User>()
const snackbarStore = SnackbarStore()

const emit = defineEmits(['login', 'reload'])

const loading = ref<boolean>(false)
const tables = ref<Table[]>([])
const selectedTable = ref<Table[]>([])
const tableSheet = ref<boolean>(false)
const types = ref<SubType[]>([])
const drawer = ref<boolean>(true)

const sortedTables = computed(() => tables.value.sort(sortTables))

function getSubTypeCount(table: Table, subtype: string[]) {
  if (table && table.items) {
    return table.items.reduce((a: number, i: Item) => a += subtype.includes(i.sub_type) ? 1 : 0, 0)
  }
  return 0
}

async function getTables() {
  const _tables = await axios.GetTablesInEvent(props.event?.id || 0)
  _tables.forEach((t: Table) => {
    if (!t.items) {
      t.items = []
    }
  })
  tables.value = _tables
  if (tables.value.length && tables.value[0].status === 'ACTIVE') {
    if (selectedTable.value.length === 0) {
      selectedTable.value = [tables.value[0]]
    } else {
      const foundTable = tables.value.find((t: Table) => t.id === selectedTable.value[0].id)
      if (foundTable) {
        selectedTable.value = [foundTable]
      } else {
        selectedTable.value = [tables.value[0]]
      }
    }
  }
  else {
    selectedTable.value = []
  }
}

function newOrderHandler(data: Table) {
  const table = tables.value.find((t: Table) => t.id === data.id)
  if (table) {
    data.items.forEach((item: Item) => {
      if (!table.items.find((i: Item) => i.id === item.id)) {
        table.items.push(item)
      }
    })
  }
  else {
    tables.value.push(data)
    snackbarStore.show("Nuovo tavolo")
  }
}

function itemRemovedHandler(data: number) {
  const table = tables.value.find((o: Table) => {
    if (o.items.find((i: Item) => i.id === data)) {
      return true
    }
  })
  const _items = copy<Item[]>(table.items.filter((i: Item) => i.id !== data))
  table.items = _items
}

function orderCompletedHandler(data: CompleteOrderInput) {
  const table = tables.value.find((t: Table) => t.id === data.table_id)
  if (table) {
    table.items.forEach((i: Item) => {
      if (data.order_id === i.order_id) {
        i.done = true
      }
    })
  }
}

async function handleReconnection() {
  if (is) {
    is.emit('join', 'checkout')
    await getTables()
  }
}

async function init() {
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
  <v-navigation-drawer v-if="props.event?.id" v-model="drawer" mobile-breakpoint="sm">
    <RouterLink to="/waiter?origin=/checkout">
      <v-btn style="margin-top: 8px; margin-left: 15px;">Nuovo Ordine</v-btn>
    </RouterLink>
    <v-list v-model:selected="selectedTable" lines="two">
      <v-list-item :key="table.id" v-for="(table, i) in sortedTables" :value="table"
        :style="{ opacity: table.status === 'CLOSED' ? 0.3 : 'inherit' }">
        <v-list-item-title>
          <span :class="{ done: table.paid }">{{ table.name }}</span>
        </v-list-item-title>
        <template v-for="type in types">
          <v-btn readonly size="small" density="compact" variant="plain" v-if="getSubTypeCount(table, [type.name]) > 0">
            <v-icon>{{ type.icon }}</v-icon> {{ getSubTypeCount(table, [type.name]) }}
          </v-btn>
        </template>
      </v-list-item>
    </v-list>
  </v-navigation-drawer>
  <v-skeleton-loader type="card" v-if="loading"></v-skeleton-loader>
  <v-container v-else-if="!props.event?.id">
    <NoEvent></NoEvent>
  </v-container>
  <CheckoutOrder v-else :event="props.event" v-model:selected-table="selectedTable" @get-tables="getTables"
    @change-table-sheet="tableSheet = true" v-model:drawer="drawer" />
  <CheckoutTableSelection v-model="tableSheet" :event="props.event" :selected-table="selectedTable"
    @changed="getTables" />
</template>