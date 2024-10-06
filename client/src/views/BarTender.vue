<script setup lang="ts">
import { Event, Order, MasterItem, Item, ItemTypes as types } from "../../../models/src"
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

const props = defineProps(['destinations'])

const loading = ref<boolean>(true)
const sheet = ref(false)
const event = ref<Event>({})
const orders = ref<Order[]>([])
const selectedOrder = ref<Order[]>([])
const confirm = ref<boolean>(false)
const drawer = ref<boolean>()

const ordersToDo = computed(() => orders.value.filter(o => !o.done && o.items && o.items.length))
const computedSelectedOrder = computed(() => {
  let result = copy(selectedOrder.value.length ? selectedOrder.value[0] : { items: [] })
  if (!result.items) {
    result.items = []
  }
  result.itemsToDo = groupItems(result.items.filter(i => !i.done))
  result.itemsDone = groupItems(result.items.filter(i => i.done))
  return result
})
const subTypesCount = computed(() => {
  let result = []
  types.forEach(type => {
    let count = getSubTypeCount(selectedOrder.value[0], type)
    if (count > 0) result.push({
      type,
      count
    })
  })
  return result
})

function getSubTypeCount(order: Order, subtype: string[]) {
  if (order && order.items) {
    return order.items.reduce((a, i) => a += subtype.includes(i.sub_type) ? 1 : 0, 0)
  }
  return 0
}

async function doneItem(item: Item) {
  item.done = true
  await axios.UpdateItem(item)
  selectedOrder.value[0].items.find(i => i.master_item_id === item.master_item_id && i.note === item.note && !i.done).done = true

  if (computedSelectedOrder.value.itemsToDo.length === 0) {
    completeOrder()
  }
}

async function rollbackItem(item: Item) {
  item.done = false
  await axios.UpdateItem(item)
  selectedOrder.value[0].items.find(i => i.master_item_id === item.master_item_id && i.note === item.note && i.done).done = false
}

async function completeOrder() {
  await axios.CompleteOrder(selectedOrder.value[0].id, selectedOrder.value[0].items.map(i => i.id))
  confirm.value = false
  await getOrders()
  if (ordersToDo.value.length) {
    selectedOrder.value = [ordersToDo.value[0]]
  }
  else {
    selectedOrder.value = []
  }
  snackbarStore.show("Ordine completato")
}

async function getOrders() {
  orders.value = await axios.GetOrdersInEvent(event.value.id, props.destinations)
  if (ordersToDo.value.length) {
    selectedOrder.value = [ordersToDo.value[0]]
  }
  else {
    selectedOrder.value = []
  }
}

onMounted(async () => {
  event.value = await axios.GetOnGoingEvent()
  await getOrders()
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

  is.on('new-order', (data) => {
    orders.value.push(data)
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
    <v-list v-model:selected="selectedOrder" lines="two">
      <v-list-item :key="order.id" :value="order" v-for="order in ordersToDo">
        <v-list-item-title>
          Tavolo {{ order.table_name }}
        </v-list-item-title>
        <template v-for="type in types">
          <v-btn readonly size="small" density="compact" variant="plain" v-if="getSubTypeCount(order, type) > 0">
            <v-icon>{{ getIcon(type) }}</v-icon> {{ getSubTypeCount(order, type) }}
          </v-btn>
        </template>
      </v-list-item>
    </v-list>
  </v-navigation-drawer>
  <div>
    <ItemList subheader="DA FARE" :items="computedSelectedOrder.itemsToDo">
      <template v-slot:postquantity="slotProps">
        <v-btn variant="plain" icon="mdi-check" @click="doneItem(slotProps.item)"></v-btn>
      </template>
    </ItemList>
    <ItemList subheader="COMPLETATI" :items="computedSelectedOrder.itemsDone" :done="true">
      <template v-slot:postquantity="slotProps">
        <v-btn variant="plain" icon="mdi-keyboard-backspace" @click="rollbackItem(slotProps.item)"></v-btn>
      </template>
    </ItemList>
    <v-bottom-navigation>
      <v-btn icon="mdi-menu" @click="drawer = !drawer" id="drawer-button">

      </v-btn>
      <v-btn v-for="type in subTypesCount" readonly size="small" density="compact" variant="plain">
        <v-icon>{{ getIcon(type.type) }}</v-icon> {{ type.count }}
      </v-btn>
      <v-spacer></v-spacer>
      <v-btn variant="plain" @click="confirm = true" v-if="selectedOrder.length">
        COMPLETA ORDINE
      </v-btn>
    </v-bottom-navigation>
    <Confirm v-model="confirm">
      <v-slot>
        <v-btn text="Conferma" variant="plain" @click="completeOrder"></v-btn>
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