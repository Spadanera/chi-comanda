<script setup lang="ts">
import { type Event, type Table, type MasterItem, type Item, ItemTypes as types, type CompleteOrderInput } from "../../../models/src"
import { ref, onMounted, computed, onBeforeUnmount } from "vue"
import router from '@/router'
import Axios from '@/services/client'
import { SnackbarStore, type IUser } from '@/stores'
import { copy, getIcon, sortItem, sortTables } from "@/services/utils"
import ItemList from "@/components/ItemList.vue"
import { io } from 'socket.io-client'
import { RouterLink } from 'vue-router';

const axios = new Axios()
var is: any
const user = defineModel<IUser>()
const snackbarStore = SnackbarStore()

const emit = defineEmits(['login', 'reload'])

const loading = ref<boolean>(true)
const event = ref<Event>()
const tables = ref<Table[]>([])
const selectedTable = ref<Table[]>([])
const confirm = ref<boolean>(false)
const confirm2 = ref<boolean>(false)
const confirm3 = ref<boolean>(false)
const deleteItemId = ref<number>(0)
const drawer = ref<boolean>(true)
const itemToBePaid = ref<number[]>([])

const computedSelectedTable = computed(() => {
  let result = copy<Table>((selectedTable.value.length ? selectedTable.value[0] : { items: [] }) as Table)
  if (!result.items) {
    result.items = []
  }
  result.itemsToDo = result.items.filter((i: Item) => !i.paid).sort(sortItem)
  result.itemsDone = result.items.filter((i: Item) => i.paid).sort(sortItem)
  return result
})
const tableTotalOrder = computed(() => {
  if (computedSelectedTable.value.items) {
    return computedSelectedTable.value.items.reduce((a: number, i: Item) => a += i.paid ? 0 : i.price, 0)
  }
  else return 0
})
const sortedTables = computed(() => tables.value.sort(sortTables))
const itemToBePaidBill = computed(() => { 
  if (selectedTable.value.length && selectedTable.value[0].items) {
    return selectedTable.value[0].items.filter((i: Item) => itemToBePaid.value.includes(i.id || 0)).reduce((a: number, i: Item) => a += i.price, 0)
  }
  else {
    return 0
  }
})
const onGoing = computed(() => selectedTable.value[0].items.filter((i: Item) => !i.done).length ? true : false)

function getSubTypeCount(table: Table, subtype: string[]) {
  if (table && table.items) {
    return table.items.reduce((a: number, i: Item) => a += subtype.includes(i.sub_type) ? 1 : 0, 0)
  }
  return 0
}

async function rollbackItem(item: Item) {
  item.paid = false
  await axios.UpdateItem(item)
  selectedTable.value[0].items.find((i: Item) => i.master_item_id === item.master_item_id && i.note === item.note && i.paid).paid = false
}

async function deleteItemConfirm(item_id: number) {
  deleteItemId.value = item_id;
  confirm3.value = true
}

async function deleteItem() {
  await axios.DeleteItem(deleteItemId.value)
  tables.value.forEach((table: Table) => {
    table.items = table.items.filter((i: Item) => i.id !== deleteItemId.value)
  })
  confirm3.value = false
}


async function completeTable() {
  await axios.CompleteTable(selectedTable.value[0].id)
  confirm.value = false
  await getTables()
  if (tables.value.length && tables.value[0].status === 'ACTIVE') {
    selectedTable.value = [tables.value[0]]
  }
  else {
    selectedTable.value = []
  }
  snackbarStore.show("Tavolo chiuso", 3000, 'bottom', 'success')
}

async function paySelectedItem() {
  await axios.PaySelectedItem(selectedTable.value[0].id, itemToBePaid.value)
  itemToBePaid.value.forEach(i => {
    selectedTable.value[0].items.find((_i: Item) => _i.id === i).paid = true
  });
  itemToBePaid.value = []

  confirm2.value = false
}

async function getTables() {
  loading.value = true
  const _tables = await axios.GetTablesInEvent(event.value?.id || 0)
  _tables.forEach((t: Table) => {
    if (!t.items) {
      t.items = []
    }
  })
  tables.value = _tables
  if (tables.value.length && tables.value[0].status === 'ACTIVE') {
    selectedTable.value = [tables.value[0]]
  }
  else {
    selectedTable.value = []
  }
  loading.value = false
}

onMounted(async () => {
  event.value = await axios.GetOnGoingEvent()
  await getTables()

  is = io(window.location.origin, {
    path: "/socket/socket.io",
    transports: ['websocket']
  })

  is.on('connect', () => {
    is.emit('join', 'checkout')
  })

  is.on('disconnect', () => {

  })

  is.on('connect_error', (err: any) => {
    snackbarStore.show("Errore nella connessione, prova a ricaricare la pagina", -1, 'top', 'error', true)
    is.emit('end')
  })

  is.on('new-order', (data: Table) => {
    const table = tables.value.find((t: Table) => t.id === data.id)
    if (table) {
      data.items.forEach((item: Item) => {
        if (!table.items.find((i: Item) => i.id === item.id)) {
          table.items.push(item)
        }
      });
    }
    else {
      tables.value.push(data)
      snackbarStore.show("Nuovo tavolo")
    }
  })

  is.on('item-removed', (data: number) => {
    const table = tables.value.find((o: Table) => {
      if (o.items.find((i: Item) => i.id === data)) {
        return true
      }
    })
    const _items = copy<Item[]>(table.items.filter((i: Item) => i.id !== data))
    table.items = _items
  })

  is.on('order-completed', (data: CompleteOrderInput) => {
    const table = tables.value.find((t: Table) => t.id === data.table_id)
    table.items.forEach((i: Item) => {
      if (data.order_id === i.order_id) {
        i.done = true
      }
    })
  })
})

onBeforeUnmount(() => {
  is.emit('end')
})
</script>

<template>
  <v-navigation-drawer v-model="drawer" mobile-breakpoint="sm">
    <RouterLink to="/waiter?origin=checkout">
      <v-btn style="margin-top: 8px; margin-left: 15px;">Nuovo Ordine</v-btn>
    </RouterLink>
    <v-list v-model:selected="selectedTable" lines="two">
      <v-list-item :key="table.id" v-for="(table, i) in sortedTables" :value="table"
        :style="{ opacity: table.status === 'CLOSED' ? 0.3 : 'inherit' }">
        <v-list-item-title>
          <span :class="{ done: table.paid }">Tavolo {{ table.name }}</span>
        </v-list-item-title>
        <template v-for="type in types">
          <v-btn readonly size="small" density="compact" variant="plain" v-if="getSubTypeCount(table, [type.name]) > 0">
            <v-icon>{{ getIcon(type.name) }}</v-icon> {{ getSubTypeCount(table, [type.name]) }}
          </v-btn>
        </template>
      </v-list-item>
    </v-list>
  </v-navigation-drawer>
  <v-skeleton-loader type="card" v-if="loading"></v-skeleton-loader>
  <v-container v-else-if="!event?.id">
    <h3>Cassa</h3>
    <p>Nessun evento attivo</p>
  </v-container>
  <div v-else>
    <h3 style="padding-left: 15px; padding-top: 14px;">Cassa</h3>
    <h5 style="padding-left: 15px; padding-top: 0;" v-if="selectedTable.length">Tavolo {{ selectedTable[0].name }}</h5>
    <ItemList :showtype="true" subheader="DA PAGARE" v-model="computedSelectedTable.itemsToDo">
      <template v-slot:prequantity="slotProps">
        <v-btn icon="mdi-delete" @click="deleteItemConfirm(slotProps.item.id)" variant="plain"></v-btn>
      </template>
      <template v-slot:postquantity="slotProps">
        <v-checkbox v-model="itemToBePaid" :value="slotProps.item.id"></v-checkbox>
      </template>
    </ItemList>
    <v-divider></v-divider>
    <ItemList subheader="PAGATI" v-model="computedSelectedTable.itemsDone" :done="true">
      <template v-slot:postquantity="slotProps">
        <v-btn variant="plain" icon="mdi-arrow-up-thin" @click="rollbackItem(slotProps.item)"></v-btn>
      </template>
    </ItemList>
    <v-bottom-navigation>
      <v-btn icon="mdi-menu" @click="drawer = !drawer" id="drawer-button"></v-btn>
      <v-btn variant="plain" readonly v-if="selectedTable.length">
        Totale: {{ tableTotalOrder }} €
      </v-btn>
      <v-spacer></v-spacer>
      <v-btn variant="plain" @click="confirm2 = true" v-if="itemToBePaid.length">PARZIALE {{ itemToBePaidBill
        }}
        €</v-btn>
      <v-btn class="show-xs" variant="plain" @click="confirm = true"
        v-if="selectedTable.length && !selectedTable[0].paid" :readonly="onGoing">
        <span :style="{ opacity: onGoing ? 0.2 : 'inherit' }">CHIUDI TAVOLO</span>
      </v-btn>
      <v-btn icon="mdi-close-box" class="hide-xs" variant="plain" @click="confirm = true" :readonly="onGoing"
        v-if="selectedTable.length && !selectedTable[0].paid">

      </v-btn>
    </v-bottom-navigation>
    <Confirm v-model="confirm" text="Sei sicuro chiudere il tavolo e pagare tutti gli elementi rimanenti?">
      <template v-slot:action>
        <v-btn text="Conferma" variant="plain" @click="completeTable"></v-btn>
      </template>
    </Confirm>
    <Confirm v-model="confirm2" text="Sei sicuro di procedere con il pagamento degli elementi selezionati?">
      <template v-slot:action>
        <v-btn text="Conferma" variant="plain" @click="paySelectedItem"></v-btn>
      </template>
    </Confirm>
    <Confirm v-model="confirm3">
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