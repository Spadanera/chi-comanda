<script setup lang="ts">
import { type Order, type Item, type SubType, type User } from "../../../models/src"
import { ref, onMounted, computed, onUnmounted } from "vue"
import Axios from '@/services/client'
import { SnackbarStore } from '@/stores'
import { groupItems, copy, sortOrder } from "@/services/utils"
import ItemList from "@/components/ItemList.vue"
import Avatar from "@/components/Avatar.vue"
import fileAudio from '@/assets/nuovo-ordine.wav'
import fileAudio1 from '@/assets/nuovo-ordine-1.ogg'
import fileAudio2 from '@/assets/nuovo-ordine-2.ogg'
import fileAudio3 from '@/assets/nuovo-ordine-3.ogg'
import fileAudio4 from '@/assets/nuovo-ordine-4.mp3'

const axios = new Axios()
var interval: number
const user = defineModel<User>()
const snackbarStore = SnackbarStore()
const types = ref<SubType[]>([])

const emit = defineEmits(['login', 'reload'])

const props = defineProps(['destinations', 'pagetitle', 'minutetoalert', 'is', 'event'])

const event = props.event
const loading = ref<boolean>(true)
const orders = ref<Order[]>([])
const confirm = ref<boolean>(false)
const deleteItemId = ref<number>(0)
const selectedOrder = ref<Order[]>([])
const confirm2 = ref<boolean>(false)
const drawer = ref<boolean>(true)
const audio = ref([]);
const origin = window.location.pathname
const is = props.is

const itemsToDo = computed(() => {
  if (selectedOrder.value.length) {
    return groupItems(selectedOrder.value[0].items.filter((i: Item) => !i.done))
  }
  else {
    return []
  }
})
const itemsDone = computed(() => {
  if (selectedOrder.value.length) {
    return groupItems(selectedOrder.value[0].items.filter((i: Item) => i.done))
  }
  else {
    return []
  }
})
const subTypesCount = computed(() => {
  let result: any = []
  types.value.forEach((type: SubType) => {
    let count = getSubTypeCount(selectedOrder.value[0], [type.name])
    if (count > 0) result.push({
      type: type.name,
      icon: type.icon,
      count
    })
  })
  return result
})
const orderedOrders = computed(() => orders.value.sort(sortOrder))

function getSubTypeCount(order: Order, subtype: string[]) {
  if (order && order.items) {
    return order.items.reduce((a: number, i: Item) => a += subtype.includes(i.sub_type) ? 1 : 0, 0)
  }
  return 0
}

async function doneItem(item_ids: number[], multiple: boolean = false) {
  if (!multiple) {
    const id = item_ids.pop()
    const _item = selectedOrder.value[0].items.find((i: Item) => i.id === id)
    _item.done = true
    try {
      await axios.UpdateItem(_item)
    } catch (error) {
      _item.done = false
    }
  }
  else {
    for (let j = 0; j < item_ids.length; j++) {
      const _item = selectedOrder.value[0].items.find((i: Item) => i.id === item_ids[j])
      _item.done = true
      try {
        await axios.UpdateItem(_item)
      } catch (error) {
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
    await axios.UpdateItem(item)
  } catch (error) {
    item.done = true
  }
}

async function deleteItemConfirm(item_id: number) {
  deleteItemId.value = item_id;
  confirm2.value = true
}

async function deleteItem() {
  await axios.DeleteItem(deleteItemId.value)
  orders.value.forEach((order: Order) => {
    order.items = copy<Item[]>(order.items.filter((i: Item) => i.id !== deleteItemId.value))
  })
  confirm2.value = false
}

async function completeOrder() {
  await axios.CompleteOrder(selectedOrder.value[0].id || 0, {
    event_id: event?.id || 0,
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
  snackbarStore.show("Ordine completato", 3000, 'bottom')
}

async function getOrders() {
  orders.value = await axios.GetOrdersInEvent(event?.id || 0, props.destinations)
  calculateMinPassed()
  if (orders.value.length && !orders.value[0].done) {
    if (selectedOrder.value.length === 0) {
      selectedOrder.value = [orders.value[0]]
    }
    else {
      selectedOrder.value = [orders.value.find((o: Order) => o.id === selectedOrder.value[0].id)]
    }
  }
  else {
    selectedOrder.value = []
  }
}

function getMinutesPassed(datetimeString: string): number {
  try {
    const [datePart, timePart] = datetimeString.split(/T| /);
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes, seconds] = timePart.split('.')[0].split(':').map(Number);


    const then = new Date(year, month - 1, day, hours, minutes, seconds);

    const now = new Date().toLocaleString("en-US", { timeZone: "Europe/Rome" });
    const nowItaly = new Date(now);

    const differenceMs = nowItaly.getTime() - then.getTime();

    const minutesPassed = Math.floor(differenceMs / (1000 * 60));

    return minutesPassed;
  } catch (error) {
    return 0
  }
}

function calculateMinPassed() {
  orders.value.forEach((o: Order) => {
    if (!o.done) {
      if (o.order_date !== '2024-01-01T00:00:00.000Z') {
        o.minPassed = getMinutesPassed(o.order_date)
      }
      else {
        o.minPassed = -1
      }
    }
  })
}

function newOrderHandler(data: Order) {
  console.log('new order', data);
  data.items = data.items?.filter((i: Item) => parseInt(props.destinations) === i.destination_id)
  if (data.items?.length && orders.value.find((o: Order) => o.id === data.id) === undefined) {
    orders.value.push(data)
    calculateMinPassed()
    if (!selectedOrder.value.length) {
      selectedOrder.value.push(data)
    }

    if (!data.items[0].done) {
      snackbarStore.show("Nuovo ordine", -1, 'bottom', 'success')
      let audioToPlay = audio.value[Math.floor(Math.random() * audio.value.length)]
      audioToPlay.play();
    }
  }
}

function orderCompletedHandler() {
  getOrders()
}

function itemUpdatedHandler(data: Item) {
  const _order = orders.value.find((o: Order) => o.id = data.order_id)
  if (_order) {
    const _item = _order.items.find((i: Item) => i.id === data.id)
    if (_item) {
      _item.done = data.done
    }
  }
}

function reloadTablehandler() {
  getOrders()
}

function itemRemovedHandler(data: number) {
  const order = orders.value.find((o: Order) => {
    if (o.items.find((i: Item) => i.id === data)) {
      return true
    }
  })
  const _items = copy<Item[]>(order.items.filter((i: Item) => i.id !== data))
  order.items = _items
  if (_items.length === 0) {
    if (order.id === selectedOrder.value[0].id) {
      selectedOrder.value = []
    }
    orders.value = copy<Order[]>(orders.value.filter((o: Order) => o.id !== order.id))
  }
}

onMounted(async () => {
  loading.value = true
  audio.value = [
    new Audio(fileAudio),
    new Audio(fileAudio1),
    new Audio(fileAudio2),
    new Audio(fileAudio3),
    new Audio(fileAudio4),
  ]
  types.value = await axios.GetSubTypes()
  if (event && event.id) {
    await getOrders()
    is.emit('join', 'bartender')
    console.log('join bartender');

    is.on('new-order', newOrderHandler)
    is.on('order-completed', orderCompletedHandler)
    is.on('item-updated', itemUpdatedHandler)
    is.on('reload-table', reloadTablehandler)
    is.on('item-removed', itemRemovedHandler)

    interval = window.setInterval(calculateMinPassed, 1000 * 60)
  }
  loading.value = false
})

onUnmounted(() => {
  window.clearInterval(interval)
  console.log('unmounted bartender');
  if (is) {
    console.log('leave bartender');
    is.emit('leave', 'bartender')

    is.off('new-order', newOrderHandler)
    is.off('order-completed', orderCompletedHandler)
    is.off('item-updated', itemUpdatedHandler)
    is.off('reload-table', reloadTablehandler)
    is.off('item-removed', itemRemovedHandler)
  }
})
</script>

<template>
  <v-navigation-drawer v-model="drawer" mobile-breakpoint="sm" v-if="event?.id">
    <RouterLink :to="`/waiter?origin=${origin}`">
      <v-btn style="margin-top: 8px; margin-left: 15px;">Nuovo Ordine</v-btn>
    </RouterLink>
    <v-list v-model:selected="selectedOrder" lines="two">
      <v-list-item :key="order.id" :value="order" v-for="order in orderedOrders"
        :style="{ opacity: !order.done ? 'inherit' : 0.3 }">
        <v-list-item-title>
          <span :class="{ done: order.done }">Tavolo {{ order.table_name }}</span>
          <v-btn variant="plain" v-if="!order.done && order.minPassed >= 0"
            :class="{ 'text-danger': order.minPassed >= minutetoalert, 'font-weight-bold': order.minPassed > 14 }">
            {{ order.minPassed }} <span style="text-transform: lowercase;">m</span>
          </v-btn>
        </v-list-item-title>
        <template v-for="type in types">
          <v-btn readonly size="small" density="compact" variant="plain" v-if="getSubTypeCount(order, [type.name]) > 0">
            <v-icon>{{ type.icon }}</v-icon> {{ getSubTypeCount(order, [type.name]) }}
          </v-btn>
        </template>
      </v-list-item>
    </v-list>
  </v-navigation-drawer>
  <v-skeleton-loader type="card" v-if="loading"></v-skeleton-loader>
  <v-container v-else-if="!event?.id">
    <h3>{{ props.pagetitle }}</h3>
    <p>Nessun evento attivo</p>
  </v-container>
  <template v-else>
    <v-container>
      <h3>{{ props.pagetitle }} <span v-if="selectedOrder.length"> - Tavolo {{ selectedOrder[0].table_name }}</span>
      </h3>
      <v-chip v-if="selectedOrder.length">
        <Avatar :user="selectedOrder[0].user" alt start></Avatar>
        {{ selectedOrder[0].user.username }}
      </v-chip>
    </v-container>
    <ItemList :quantitybefore="true" :showtype="true" subheader="DA FARE" v-model="itemsToDo" :shownote="true">
      <template v-slot:prequantity="slotProps">
        <v-btn icon="mdi-delete" v-if="!slotProps.item.paid" @click="deleteItemConfirm(slotProps.item.id)"
          variant="plain"></v-btn>
        <v-btn variant="plain" v-if="slotProps.item.quantity > 1" icon="mdi-check-all"
          @click="doneItem(slotProps.item.grouped_ids, true)"></v-btn>
        <v-btn variant="plain" icon="mdi-check" @click="doneItem(slotProps.item.grouped_ids)"></v-btn>
      </template>
      <template v-slot:postquantity="slotProps">
      </template>
    </ItemList>
    <v-divider></v-divider>
    <ItemList :quantitybefore="true" subheader="COMPLETATI" v-model="itemsDone" :done="true" shownote>
      <template v-slot:postquantity="slotProps">
        <v-btn variant="plain" icon="mdi-arrow-up-thin" @click="rollbackItem(slotProps.item)"></v-btn>
      </template>
    </ItemList>
    <v-bottom-navigation>
      <v-btn icon="mdi-menu" @click="drawer = !drawer" id="drawer-button">

      </v-btn>
      <template v-for="type in subTypesCount">
        <v-btn v-if="type.type !== 'Fuori Menu'" min-width="50" readonly size="x-small" density="compact"
          variant="plain">
          <v-icon>{{ type.icon }}</v-icon> {{ type.count }}
        </v-btn>
      </template>
      <v-spacer></v-spacer>
      <v-btn class="show-xs" variant="plain" @click="confirm = true"
        v-if="selectedOrder.length && !selectedOrder[0].done">
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