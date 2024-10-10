<script setup lang="ts">
import { type Event, type Order, type Item, ItemTypes as types, type Type } from "../../../models/src"
import { ref, onMounted, computed, onBeforeUnmount } from "vue"
import Axios from '@/services/client'
import { SnackbarStore, type IUser } from '@/stores'
import { groupItems, copy, getIcon } from "@/services/utils"
import ItemList from "@/components/ItemList.vue"
import { io } from 'socket.io-client'
import fileAudio from '@/assets/nuovo-ordine.wav'

const axios = new Axios()
var is: any
const user = defineModel<IUser>()
const snackbarStore = SnackbarStore()

const emit = defineEmits(['login', 'reload'])

const props = defineProps(['destinations'])

const loading = ref<boolean>(true)
const sheet = ref(false)
const event = ref<Event>()
const orders = ref<Order[]>([])
const confirm = ref<boolean>(false)
const deleteItemId = ref<number>(0)
const selectedOrder = ref<Order[]>([])
const confirm2 = ref<boolean>(false)
const drawer = ref<boolean>()
const audio = ref(null);

// console.log(fileAudio)


const computedSelectedOrder = computed(() => {
  let result = copy<Order>((selectedOrder.value.length ? selectedOrder.value[0] : { items: [] }) as Order)
  if (!result.items) {
    result.items = []
  }
  result.itemsToDo = groupItems(result.items.filter((i: Item) => !i.done))
  result.itemsDone = groupItems(result.items.filter((i: Item) => i.done))
  return result
})
const subTypesCount = computed(() => {
  let result: any = []
  types.forEach((type: Type) => {
    let count = getSubTypeCount(selectedOrder.value[0], [type.name])
    if (count > 0) result.push({
      type: type.name,
      count
    })
  })
  return result
})

function getSubTypeCount(order: Order, subtype: string[]) {
  if (order && order.items) {
    return order.items.reduce((a: number, i: Item) => a += subtype.includes(i.sub_type) ? 1 : 0, 0)
  }
  return 0
}

async function doneItem(item: Item) {
  item.done = true
  await axios.UpdateItem(item)
  selectedOrder.value[0].items.find((i: Item) => i.master_item_id === item.master_item_id && i.note === item.note && i.name === item.name && !i.done).done = true

  if (computedSelectedOrder.value.itemsToDo.length === 0) {
    completeOrder()
  }
}

async function rollbackItem(item: Item) {
  item.done = false
  await axios.UpdateItem(item)
  if (selectedOrder && selectedOrder.value && selectedOrder.value.length) {
    selectedOrder.value[0].items.find((i: Item) => i.master_item_id === item.master_item_id && i.note === item.note && i.name === item.name && i.done).done = false
  }
}

async function deleteItemConfirm(item_id: number) {
  deleteItemId.value = item_id;
  confirm2.value = true
}

async function deleteItem() {
  await axios.DeleteItem(deleteItemId.value)
  orders.value.forEach((order: Order) => {
    order.items = order.items.filter((i: Item) => i.id !== deleteItemId.value)
  })
  confirm2.value = false
}

async function completeOrder() {
  await axios.CompleteOrder(selectedOrder.value[0].id || 0, {
    event_id: event.value?.id || 0,
    table_id: selectedOrder.value[0].table_id || 0,
    item_ids: selectedOrder.value[0].items?.map(i => i.id) || []
  })
  confirm.value = false
  await getOrders()
  if (orders.value.length && !orders.value[0].done) {
    selectedOrder.value = [orders.value[0]]
  }
  else {
    selectedOrder.value = []
  }
  snackbarStore.show("Ordine completato", 3000, 'bottom', 'success')
}

async function getOrders() {
  loading.value = true
  orders.value = await axios.GetOrdersInEvent(event.value?.id || 0, props.destinations)
  if (orders.value.length && !orders.value[0].done) {
    selectedOrder.value = [orders.value[0]]
  }
  else {
    selectedOrder.value = []
  }
  loading.value = false
}

onMounted(async () => {
  audio.value = new Audio(fileAudio)
  event.value = await axios.GetOnGoingEvent()
  await getOrders()

  is = io(window.location.origin, {
    path: "/socket/socket.io"
  })

  is.on('connect', () => {
    is.emit('join', 'bar')
  })

  is.on('disconnect', () => {

  })

  is.on('connect_error', (err: any) => {
    snackbarStore.show("Errore nella connessione, prova a ricaricare la pagina", -1, 'top', 'error', true)
  })

  is.on('new-order', (data: Order) => {
    orders.value.push(data)
    snackbarStore.show("Nuovo ordine", -1, 'bottom', 'success')
    audio.value.play();
  })
})

onBeforeUnmount(() => {
  is.emit('end')
})
</script>

<template>
  <v-navigation-drawer v-model="drawer" mobile-breakpoint="sm">
    <v-list v-model:selected="selectedOrder" lines="two">
      <v-list-item :key="order.id" :value="order" v-for="order in orders">
        <v-list-item-title>
          <span :class="{ done: order.done }">Tavolo {{ order.table_name }}</span>
        </v-list-item-title>
        <template v-for="type in types">
          <v-btn readonly size="small" density="compact" variant="plain" v-if="getSubTypeCount(order, [type.name]) > 0">
            <v-icon>{{ getIcon(type.name) }}</v-icon> {{ getSubTypeCount(order, [type.name]) }}
          </v-btn>
        </template>
      </v-list-item>
    </v-list>
  </v-navigation-drawer>
  <v-skeleton-loader type="card" v-if="loading"></v-skeleton-loader>
  <p v-else-if="!event?.id">Nessun evento attivo</p>
  <div v-else>
    <ItemList subheader="DA FARE" v-model="computedSelectedOrder.itemsToDo">
      <template v-slot:prequantity="slotProps">
        <v-btn icon="mdi-delete" @click="deleteItemConfirm(slotProps.item.id)" variant="plain"></v-btn>
      </template>
      <template v-slot:postquantity="slotProps">
        <v-btn variant="plain" icon="mdi-check" @click="doneItem(slotProps.item)"></v-btn>
      </template>
    </ItemList>
    <ItemList subheader="COMPLETATI" v-model="computedSelectedOrder.itemsDone" :done="true">
      <template v-slot:postquantity="slotProps">
        <v-btn variant="plain" icon="mdi-arrow-up-thin" @click="rollbackItem(slotProps.item)"></v-btn>
      </template>
    </ItemList>
    <v-bottom-navigation>
      <v-btn icon="mdi-menu" @click="drawer = !drawer" id="drawer-button">

      </v-btn>
      <v-btn v-for="type in subTypesCount" readonly size="small" density="compact" variant="plain">
        <v-icon>{{ getIcon(type.type) }}</v-icon> {{ type.count }}
      </v-btn>
      <v-spacer></v-spacer>
      <v-btn class="show-xs" variant="plain" @click="confirm = true"
        v-if="selectedOrder.length && !selectedOrder[0].done">
        COMPLETA ORDINE
      </v-btn>
      <v-btn class="hide-xs" icon="mdi-check-all" variant="plain" @click="confirm = true"
        v-if="selectedOrder.length"></v-btn>
    </v-bottom-navigation>
    <Confirm v-model="confirm">
      <template v-slot:action>
        <v-btn text="Conferma" variant="plain" @click="completeOrder"></v-btn>
      </template>
    </Confirm>
    <Confirm v-model="confirm2">
      <template v-slot:action>
        <v-btn text="Conferma" variant="plain" @click="deleteItem"></v-btn>
      </template>
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