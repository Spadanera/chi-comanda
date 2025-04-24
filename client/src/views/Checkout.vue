<script setup lang="ts">
import { type Table, type Item, type SubType, type CompleteOrderInput, type MasterTable, type User } from "../../../models/src"
import { ref, onMounted, computed, onUnmounted } from "vue"
import Axios from '@/services/client'
import { SnackbarStore } from '@/stores'
import { copy, sortItem, sortTables } from "@/services/utils"
import { RouterLink } from 'vue-router'
import ItemList from "@/components/ItemList.vue"

const props = defineProps(['is', 'event'])

const axios = new Axios()
const is = props.is
const event = props.event
const user = defineModel<User>()
const snackbarStore = SnackbarStore()

const emit = defineEmits(['login', 'reload'])

const loading = ref<boolean>(true)
const tables = ref<Table[]>([])
const selectedTable = ref<Table[]>([])
const confirm = ref<boolean>(false)
const deleteItemId = ref<number>(0)
const drawer = ref<boolean>(true)
const itemToBePaid = ref<number[]>([])
const tableSheet = ref<boolean>(false)
const freeTables = ref<MasterTable[]>([])
const discount = ref<boolean>(false)
const realPaid = ref<number>(null)
const partialPaid = ref<boolean>(false)
const dialogPay = ref<boolean>(false)
const types = ref<SubType[]>([])

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
const discounts = computed(() => {
  return [
    {
      discount: "10%",
      discountAmount: Math.round((partialPaid.value ? itemToBePaidBill.value : tableTotalOrder.value) * 0.9)
    },
    {
      discount: "15%",
      discountAmount: Math.round((partialPaid.value ? itemToBePaidBill.value : tableTotalOrder.value) * 0.85)
    },
    {
      discount: "20%",
      discountAmount: Math.round((partialPaid.value ? itemToBePaidBill.value : tableTotalOrder.value) * 0.8)
    },
    {
      discount: "30%",
      discountAmount: Math.round((partialPaid.value ? itemToBePaidBill.value : tableTotalOrder.value) * 0.7)
    },
    {
      discount: "50%",
      discountAmount: Math.round((partialPaid.value ? itemToBePaidBill.value : tableTotalOrder.value) * 0.5)
    }
  ]
})

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
  confirm.value = true
}

async function deleteItem() {
  await axios.DeleteItem(deleteItemId.value)
  tables.value.forEach((table: Table) => {
    table.items = table.items.filter((i: Item) => i.id !== deleteItemId.value)
  })
  confirm.value = false
}


async function completeTable() {
  if (discount.value) {
    if (!realPaid.value) {
      return
    }
    const discountAmout = tableTotalOrder.value - realPaid.value
    await axios.InsertDiscount(event.id, selectedTable.value[0].id, discountAmout)
  }
  await axios.CompleteTable(selectedTable.value[0].id)
  await getTables()
  if (tables.value.length && tables.value[0].status === 'ACTIVE') {
    selectedTable.value = [tables.value[0]]
  }
  else {
    selectedTable.value = []
  }
  snackbarStore.show("Tavolo chiuso", 3000, 'bottom', 'success')
  dialogPay.value = false
}

async function paySelectedItem() {
  if (discount.value) {
    if (!realPaid.value) {
      return
    }
    const discountAmout = itemToBePaidBill.value - realPaid.value
    await axios.InsertDiscount(event.id, selectedTable.value[0].id, discountAmout)
  }
  await axios.PaySelectedItem(selectedTable.value[0].id, itemToBePaid.value)
  await getTables()
  itemToBePaid.value = []

  dialogPay.value = false
}

async function getTables() {
  const _tables = await axios.GetTablesInEvent(event?.id || 0)
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
      selectedTable.value = [tables.value.find((t: Table) => t.id === selectedTable.value[0].id)]
    }
  }
  else {
    selectedTable.value = []
  }
}

async function changeTableSheet() {
  freeTables.value = await axios.GetFreeTables(event.id)
  tableSheet.value = true
}

async function changeTable(table_id: number) {
  await axios.ChangeTable(selectedTable.value[0].id, table_id)
  await getTables()
  tableSheet.value = false
}

function pay(partial: boolean) {
  partialPaid.value = partial
  discount.value = false
  realPaid.value = partial ? itemToBePaidBill.value : tableTotalOrder.value
  dialogPay.value = true
}

function newOrderHandler(data: Table) {
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

onMounted(async () => {
  loading.value = true
  types.value = await axios.GetSubTypes()
  if (event && event.id) {
    await getTables()

    is.emit('join', 'checkout')
    is.on('new-order', newOrderHandler)
    is.on('item-removed', itemRemovedHandler)
    is.on('order-completed', orderCompletedHandler)
  }
  loading.value = false
})

onUnmounted(() => {
  if (is) {
    is.emit('leave', 'checkout')
    is.off('new-order', newOrderHandler)
    is.off('item-removed', itemRemovedHandler)
    is.off('order-completed', orderCompletedHandler)
  }
})
</script>

<template>
  <v-navigation-drawer v-if="event?.id" v-model="drawer" mobile-breakpoint="sm">
    <RouterLink to="/waiter?origin=/checkout">
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
            <v-icon>{{ type.icon }}</v-icon> {{ getSubTypeCount(table, [type.name]) }}
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
    <v-container>
      <h3>Cassa</h3>
      <v-btn @click="changeTableSheet()" style="position: absolute; top: 74px; right: 25px;"
        v-if="selectedTable.length">Tavolo {{ selectedTable[0].name }}</v-btn>
    </v-container>
    <ItemList :shownote="true" style="margin-top: 2px;" :showtype="true" subheader="DA PAGARE"
      v-model="computedSelectedTable.itemsToDo">
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
        <v-btn variant="plain" v-if="slotProps.item.sub_type !== 'Sconto'" icon="mdi-arrow-up-thin"
          @click="rollbackItem(slotProps.item)"></v-btn>
        <v-btn variant="plain" v-else icon="mdi-window-close" @click="deleteItemConfirm(slotProps.item.id)"></v-btn>
      </template>
    </ItemList>
    <v-bottom-navigation>
      <v-btn icon="mdi-menu" @click="drawer = !drawer" id="drawer-button"></v-btn>
      <v-btn variant="plain" readonly v-if="selectedTable.length">
        Totale: {{ tableTotalOrder }} €
      </v-btn>
      <v-spacer></v-spacer>
      <v-btn variant="plain" @click="pay(true)" v-if="itemToBePaid.length">PARZIALE {{ itemToBePaidBill
        }}
        €</v-btn>
      <v-btn class="show-xs" variant="plain" @click="pay(false)" v-if="selectedTable.length && !selectedTable[0].paid"
        :readonly="onGoing">
        <span :style="{ opacity: onGoing ? 0.2 : 'inherit' }">CHIUDI TAVOLO</span>
      </v-btn>
      <v-btn :style="{ opacity: onGoing ? 0.2 : 'inherit' }" icon="mdi-close-box" class="hide-xs" variant="plain"
        @click="pay(false)" :readonly="onGoing" v-if="selectedTable.length && !selectedTable[0].paid">

      </v-btn>
    </v-bottom-navigation>
    <v-dialog v-model="dialogPay" width="400">
      <v-card>
        <v-card-title v-if="partialPaid">
          Pagare elementi selezionati
        </v-card-title>
        <v-card-title v-else>
          Paga l'intero conto
        </v-card-title>
        <v-card-subtitle v-if="!partialPaid">
          A seguito del pagamento il tavolo verrà chiuso
        </v-card-subtitle>
        <v-card-text>
          <v-row v-if="partialPaid">
            <v-col style="font-size: x-large;">
              Da pagare: {{ itemToBePaidBill }} €
            </v-col>
          </v-row>
          <v-row v-else>
            <v-col style="font-size: x-large;">
              Da pagare: {{ tableTotalOrder }} €
            </v-col>
          </v-row>
          <v-row>
            <v-checkbox v-model="discount" label="Applicare sconto"></v-checkbox>
          </v-row>
          <v-row v-if="discount">
            <v-text-field :max="partialPaid ? itemToBePaidBill : tableTotalOrder" append-inner-icon="mdi-currency-eur"
              v-model.number="realPaid" label="Quanto vuoi far pagere" type="number"></v-text-field>
          </v-row>
          <v-row v-if="discount">
            <v-table style="width: 100%;" density="compact">
              <thead>
                <td>Sconto</td>
                <td>Da pagare</td>
              </thead>
              <tbody style="cursor: pointer">
                <tr v-ripple @click="realPaid = disc.discountAmount" v-for="disc in discounts">
                  <td>{{ disc.discount }}</td>
                  <td>{{ disc.discountAmount }} €</td>
                </tr>
              </tbody>
            </v-table>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="plain" @click="dialogPay = false">ANNULLA</v-btn>
          <v-spacer></v-spacer>
          <v-btn v-if="partialPaid" variant="plain" @click="paySelectedItem">CONFERMA</v-btn>
          <v-btn v-else variant="plain" @click="completeTable">CONFERMA</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <Confirm v-model="confirm">
      <template v-slot:action>
        <v-btn text="Conferma" variant="plain" @click="deleteItem"></v-btn>
      </template>
    </Confirm>
  </div>
  <v-bottom-sheet scrollable v-model="tableSheet">
    <v-card class="table-selection">
      <v-card-title>
        Seleziona il nuovo tavolo
      </v-card-title>
      <v-card-text>
        <v-row>
          <v-col v-for="table in freeTables" cols="4">
            <v-card @click="changeTable(table.table_id)" height="50px" style="padding-top: 10px;">
              {{ table.table_name }}
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn @click="tableSheet = false">ANNULLA</v-btn>
      </v-card-actions>
    </v-card>
  </v-bottom-sheet>
</template>

<style scoped>
@media only screen and (min-width: 576px) {
  #drawer-button {
    display: none;
  }
}

.table-selection .v-card {
  text-align: center;
  font-size: large;
}
</style>