<script setup lang="ts">
import { Event, Table, MasterItem, Item, ItemTypes as types } from "../../../models/src"
import { ref, onMounted, computed, onBeforeUnmount } from "vue"
import router from '@/router'
import Axios from '@/services/client'
import { SnackbarStore } from '@/stores'
import { sortItem, groupItems, copy, getIcon } from "@/services/utils"
import ItemList from "@/components/ItemList.vue"
import { io } from 'socket.io-client'

const axios = new Axios()
var is
const user = defineModel<IUser>()
const snackbarStore = new SnackbarStore()

const emit = defineEmits(['reload'])

const loading = ref<boolean>(true)
const sheet = ref(false)
const event = ref<Event>({})
const tables = ref<Table[]>([])
const selectedTable = ref<Table[]>([])
const confirm = ref<boolean>(false)
const drawer = ref<boolean>()

const tablesToDo = computed(() => tables.value.filter(o => !o.paid && o.items && o.items.length))
const computedSelectedTable = computed(() => {
  let result = copy(selectedTable.value.length ? selectedTable.value[0] : { items: [] })
  if (!result.items) {
    result.items = []
  }
  result.itemsToDo = groupItems(result.items.filter(i => !i.paid))
  result.itemsDone = groupItems(result.items.filter(i => i.paid))
  return result
})
const subTypesCount = computed(() => {
  let result = []
  types.forEach(type => {
    let count = getSubTypeCount(selectedTable.value[0], type)
    if (count > 0) result.push({
      type,
      count
    })
  })
  return result
})
const tableTotalOrder = computed(() => {
  if (computedSelectedTable.value.items) {
    return computedSelectedTable.value.items.reduce((a, i) => a += i.price, 0)
  }
  else return 0
})
const tableTotalOrderPaid = computed(() => {
  if (computedSelectedTable.value.items) {
    return computedSelectedTable.value.items.reduce((a, i) => a += i.paid ? i.price : 0, 0)
  }
  else return 0
})

function getSubTypeCount(table: Table, subtype: string[]) {
  if (table && table.items) {
    return table.items.reduce((a, i) => a += subtype.includes(i.sub_type) ? 1 : 0, 0)
  }
  return 0
}

async function doneItem(item: Item) {
  item.paid = true
  await axios.UpdateItem(item)
  selectedTable.value[0].items.find(i => i.master_item_id === item.master_item_id && i.note === item.note && !i.paid).paid = true

  if (computedSelectedTable.value.itemsToDo.length === 0) {
    completeTable()
  }
}

async function rollbackItem(item: Item) {
  item.paid = false
  await axios.UpdateItem(item)
  selectedTable.value[0].items.find(i => i.master_item_id === item.master_item_id && i.note === item.note && i.paid).paid = false
}

async function completeTable() {
  await axios.CompleteTable(selectedTable.value[0].id)
  confirm.value = false
  await getTables()
  if (tablesToDo.value.length) {
    selectedTable.value = [tablesToDo.value[0]]
  }
  else {
    selectedTable.value = []
  }
  snackbarStore.show("Tavolo chius")
}

async function getTables() {
  tables.value = await axios.GetTablesInEvent(event.value.id)
  if (tablesToDo.value.length) {
    selectedTable.value = [tablesToDo.value[0]]
  }
  else {
    selectedTable.value = []
  }
}

onMounted(async () => {
  event.value = await axios.GetOnGoingEvent()
  await getTables()
  loading.value = false

  is = io(window.location.origin, {
    path: "/socket/socket.io"
  })

  is.on('connect', () => {
    console.log('a user connected')
    is.emit('join', 'bar')
  })

  is.on('disconnect', () => {
    console.log('user disconnected')
  })

  is.on('connect_error', (err) => {
    console.log('connect_error', err.message)
  })

  is.on('new-item', (data) => {
    tables.value.push(data)
    snackbarStore.show("Nuovo ordine")
  })
})

onBeforeUnmount(() => {
  console.log('unmount')
  is.emit('end')
})
</script>

<template>
  <v-navigation-drawer v-model="drawer" mobile-breakpoint="sm">
    <v-list v-model:selected="selectedTable" lines="two">
      <v-list-item :key="table.id" :value="table" v-for="table in tablesToDo">
        <v-list-item-title>
          Tavolo {{ table.table_name }}
        </v-list-item-title>
        <template v-for="type in types">
          <v-btn readonly size="small" density="compact" variant="plain" v-if="getSubTypeCount(table, type) > 0">
            <v-icon>{{ getIcon(type) }}</v-icon> {{ getSubTypeCount(table, type) }}
          </v-btn>
        </template>
      </v-list-item>
    </v-list>
  </v-navigation-drawer>
  <div>
    <ItemList subheader="DA PAGERE" :items="computedSelectedTable.itemsToDo">
      <template v-slot:postquantity="slotProps">
        <v-btn variant="plain" icon="mdi-check" @click="doneItem(slotProps.item)"></v-btn>
      </template>
    </ItemList>
    <ItemList subheader="PAGATI" :items="computedSelectedTable.itemsDone" :done="true">
      <template v-slot:postquantity="slotProps">
        <v-btn variant="plain" icon="mdi-keyboard-backspace" @click="rollbackItem(slotProps.item)"></v-btn>
      </template>
    </ItemList>
    <v-bottom-navigation>
      <v-btn icon="mdi-menu" @click="drawer = !drawer" id="drawer-button"></v-btn>
      <v-btn variant="plain" readonly v-if="selectedTable.length">
        Totale: {{ tableTotalOrder }} €
      </v-btn>
      <v-btn variant="plain" readonly v-if="selectedTable.length">
        Totale: {{ tableTotalOrderPaid }} €
      </v-btn>
      <v-spacer></v-spacer>
      <v-btn variant="plain" @click="confirm = true" v-if="selectedTable.length">
        CHIUDI TAVOLO
      </v-btn>
    </v-bottom-navigation>
    <Confirm v-model="confirm">
      <v-slot>
        <v-btn text="Conferma" variant="plain" @click="completeTable"></v-btn>
      </v-slot>
    </Confirm>
  </div>
</template>

<style scoped>
@media only screen and (min-width: 576px) {
  #drawer-button {
    display: none;
  }
}
</style>