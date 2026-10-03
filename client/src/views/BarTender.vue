<script setup lang="ts">
import { type Order, type Item, type SubType, type User } from "../../../models/src"
import { ref, onMounted, computed, onUnmounted, watch } from "vue"
import { minutesSinceItalianTime, Roles } from '@/services/utils'
import api from '@/services/client'
import { SnackbarStore } from '@/stores'
import { groupItems, copy, sortOrder } from "@/services/utils"
import ItemList from "@/components/ItemList.vue"
import SubTypeSummary from "@/components/SubTypeSummary.vue"
import fileAudio from '@/assets/nuovo-ordine.wav'
import fileAudio1 from '@/assets/nuovo-ordine-1.ogg'
import fileAudio2 from '@/assets/nuovo-ordine-2.ogg'
import fileAudio3 from '@/assets/nuovo-ordine-3.ogg'
import fileAudio4 from '@/assets/nuovo-ordine-4.mp3'
import { useSocket, joinRoom, leaveRoom, onResync } from '@/composables/useSocket'

const socket = useSocket()
let interval: number
let reloadTimeout: ReturnType<typeof setTimeout>
const user = defineModel<User>()
const snackbarStore = SnackbarStore()
const types = ref<SubType[]>([])

const emit = defineEmits(['login', 'reload'])

const props = defineProps(['destinations', 'pagetitle', 'minutetoalert', 'event'])

const loading = ref<boolean>(false)
const orders = ref<Order[]>([])
const confirm = ref<boolean>(false)
const deleteItemId = ref<number>(0)
const selectedOrder = ref<Order[]>([])
const confirm2 = ref<boolean>(false)
const drawer = ref<boolean>(true)
const audio = ref([])
const readonly = ref(false)
const origin = window.location.pathname

const itemsToDo = computed(() => {
  if (selectedOrder.value.length) {
    return groupItems(selectedOrder.value[0].items.filter((i: Item) => !i.done))
  }
  return []
})
const itemsDone = computed(() => {
  if (selectedOrder.value.length) {
    return groupItems(selectedOrder.value[0].items.filter((i: Item) => i.done))
  }
  return []
})

const orderedOrders = computed(() => orders.value.sort(sortOrder))

async function doneItem(item_ids: number[], multiple: boolean = false) {
  if (!multiple) {
    const id = item_ids.pop()
    const _item = selectedOrder.value[0].items.find((i: Item) => i.id === id)
    _item.done = true
    try {
      await api.UpdateItem(_item)
    } catch {
      _item.done = false
    }
  } else {
    for (let j = 0; j < item_ids.length; j++) {
      const _item = selectedOrder.value[0].items.find((i: Item) => i.id === item_ids[j])
      _item.done = true
      try {
        await api.UpdateItem(_item)
      } catch {
        _item.done = false
      }
    }
  }
  if (itemsToDo.value.length === 0) {
    await completeOrder()
  }
}

async function rollbackItem(item: Item) {
  item.done = false
  try {
    await api.UpdateItem(item)
  } catch {
    item.done = true
  }
}

async function deleteItemConfirm(item_id: number) {
  deleteItemId.value = item_id
  confirm2.value = true
}

async function deleteItem() {
  await api.DeleteItem(deleteItemId.value)
  orders.value.forEach((order: Order) => {
    order.items = copy<Item[]>(order.items.filter((i: Item) => i.id !== deleteItemId.value))
  })
  confirm2.value = false
}

async function completeOrder() {
  await api.CompleteOrder(selectedOrder.value[0].id || 0, {
    event_id: props.event?.id || 0,
    table_id: selectedOrder.value[0].table_id || 0,
    item_ids: selectedOrder.value[0].items?.map(i => i.id) || []
  })
  confirm.value = false
  await getOrders()
  if (orders.value.length && !orders.value[0].done) {
    selectedOrder.value = [orders.value[0]]
  } else {
    selectedOrder.value = []
  }
  snackbarStore.show("Ordine completato", 3000, 'bottom')
}

async function getOrders() {
  orders.value = await api.GetOrdersInEvent(props.event?.id || 0, props.destinations)
  calculateMinPassed()
  if (orders.value.length && !orders.value[0].done) {
    if (selectedOrder.value.length === 0) {
      selectedOrder.value = [orders.value[0]]
    } else {
      selectedOrder.value = [orders.value.find((o: Order) => o.id === selectedOrder.value[0].id)]
    }
  } else {
    selectedOrder.value = []
  }
}

function calculateMinPassed() {
  orders.value.forEach((o: Order) => {
    if (!o.done) {
      o.minPassed = minutesSinceItalianTime(o.order_date)
    }
  })
}

function newOrderHandler(data: Order) {
  data.items = data.items?.filter((i: Item) => parseInt(props.destinations) === i.destination_id)
  if (data.items?.length && orders.value.find((o: Order) => o.id === data.id) === undefined) {
    orders.value.push(data)
    calculateMinPassed()
    if (!selectedOrder.value.length) {
      selectedOrder.value.push(data)
    }
    if (!data.items[0].done) {
      snackbarStore.show("Nuovo ordine", -1, 'bottom', 'success')
      const audioToPlay = audio.value[Math.floor(Math.random() * audio.value.length)]
      audioToPlay.play()
    }
  }
}

function orderCompletedHandler() {
  getOrders()
}

function itemUpdatedHandler(data: Item) {
  const _order = orders.value.find((o: Order) => o.id === data.order_id)
  if (_order) {
    const _item = _order.items.find((i: Item) => i.id === data.id)
    if (_item) {
      _item.done = data.done
    }
  }
}

function reloadTableHandler() {
  clearTimeout(reloadTimeout)
  reloadTimeout = setTimeout(() => { getOrders() }, 300)
}

function itemRemovedHandler(data: number) {
  const order = orders.value.find((o: Order) => o.items.find((i: Item) => i.id === data))
  if (order) {
    const _items = copy<Item[]>(order.items.filter((i: Item) => i.id !== data))
    order.items = _items
    if (_items.length === 0) {
      if (selectedOrder.value.length && order.id === selectedOrder.value[0].id) {
        selectedOrder.value = []
      }
      orders.value = copy<Order[]>(orders.value.filter((o: Order) => o.id !== order.id))
    }
  }
}

/** Whole state of the screen: on entering, on a new event and whenever the connection comes back. */
async function init() {
  if (!props.event?.id) return
  if (!types.value.length) loading.value = true
  try {
    types.value = await api.GetSubTypes()
    await getOrders()
  } finally {
    loading.value = false
  }
}

let stopResync: () => void
onMounted(() => {
  joinRoom('bartender')
  socket.on('new-order', newOrderHandler)
  socket.on('order-completed', orderCompletedHandler)
  socket.on('item-updated', itemUpdatedHandler)
  socket.on('reload-table', reloadTableHandler)
  socket.on('item-removed', itemRemovedHandler)
  stopResync = onResync(init)
  interval = window.setInterval(calculateMinPassed, 1000 * 60)

  readonly.value = !user.value?.roles?.includes(Roles.bartender) && !user.value?.roles?.includes(Roles.superuser)
  audio.value = [
    new Audio(fileAudio),
    new Audio(fileAudio1),
    new Audio(fileAudio2),
    new Audio(fileAudio3),
    new Audio(fileAudio4),
  ]
})

watch(() => props.event, init, { immediate: true })

onUnmounted(() => {
  window.clearInterval(interval)
  clearTimeout(reloadTimeout)
  leaveRoom('bartender')
  socket.off('new-order', newOrderHandler)
  socket.off('order-completed', orderCompletedHandler)
  socket.off('item-updated', itemUpdatedHandler)
  socket.off('reload-table', reloadTableHandler)
  socket.off('item-removed', itemRemovedHandler)
  stopResync()
})
</script>

<template>
  <v-navigation-drawer v-model="drawer" mobile-breakpoint="sm" v-if="props.event?.id">
    <RouterLink :to="`/waiter?origin=${origin}`">
      <v-btn style="margin-top: 8px; margin-left: 15px;">Nuovo Ordine</v-btn>
    </RouterLink>
    <v-list v-model:selected="selectedOrder" lines="two">
      <v-list-item :key="order.id" :value="order" v-for="order in orderedOrders"
        :style="{ opacity: !order.done ? 'inherit' : 0.3 }">
        <v-list-item-title>
          <span :class="{ done: order.done }">{{ order.table_name }}</span>
          <v-btn variant="plain" v-if="!order.done && order.minPassed >= 0"
            :class="{ 'text-danger': order.minPassed >= minutetoalert, 'font-weight-bold': order.minPassed > 14 }">
            {{ order.minPassed }} <span style="text-transform: lowercase;">m</span>
          </v-btn>
        </v-list-item-title>
        <SubTypeSummary :items="order.items" :types="types" />
      </v-list-item>
    </v-list>
  </v-navigation-drawer>

  <v-skeleton-loader type="card" v-if="loading"></v-skeleton-loader>

  <v-container v-else-if="!props.event?.id">
    <NoEvent></NoEvent>
  </v-container>

  <template v-else>
    <v-container>
      <h3>{{ selectedOrder[0]?.table_name }}</h3>
      <v-chip v-if="selectedOrder.length" style="margin: 10px 0 0 0;">
        Effettuato da: {{ selectedOrder[0]?.user.username }}
      </v-chip>
    </v-container>

    <ItemList :quantitybefore="true" :showtype="true" subheader="DA FARE" v-model="itemsToDo" :shownote="true">
      <template v-slot:prequantity="slotProps">
        <v-btn icon="mdi-delete" v-if="!slotProps.item.paid && !readonly" @click="deleteItemConfirm(slotProps.item.id)"
          variant="plain"></v-btn>
        <v-btn variant="plain" v-if="slotProps.item.quantity > 1 && !readonly" icon="mdi-check-all"
          @click="doneItem(slotProps.item.grouped_ids, true)"></v-btn>
        <v-btn variant="plain" v-if="!readonly" icon="mdi-check" @click="doneItem(slotProps.item.grouped_ids)"></v-btn>
      </template>
    </ItemList>

    <v-divider></v-divider>

    <ItemList :quantitybefore="true" subheader="COMPLETATI" v-model="itemsDone" :done="true" shownote>
      <template v-slot:postquantity="slotProps">
        <v-btn variant="plain" v-if="!readonly" icon="mdi-arrow-up-thin" @click="rollbackItem(slotProps.item)"></v-btn>
      </template>
    </ItemList>

    <v-bottom-navigation>
      <v-btn icon="mdi-menu" @click="drawer = !drawer" id="drawer-button"></v-btn>
      <SubTypeSummary v-if="selectedOrder.length" :items="selectedOrder[0].items" :types="types" />
      <v-spacer></v-spacer>
      <v-btn class="show-xs" variant="plain" @click="confirm = true"
        v-if="selectedOrder.length && !selectedOrder[0].done && !readonly">
        COMPLETA
      </v-btn>
      <v-btn class="hide-xs" icon="mdi-check-all" variant="plain" @click="confirm = true"
        v-if="selectedOrder.length && !selectedOrder[0].done"></v-btn>
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
  </template>
</template>

<style scoped>
@media only screen and (min-width: 576px) {
  #drawer-button {
    display: none;
  }
}
</style>
