<script setup lang="ts">
import { type Order, type MasterItem, type Item, ItemTypes as types, type Type } from "../../../models/src"
import { ref, onMounted, computed } from "vue"
import router from '@/router'
import Axios from '@/services/client'
import { SnackbarStore, type IUser } from '@/stores'
import { groupItems, copy, sortItem } from "@/services/utils"
import ItemList from "@/components/ItemList.vue"
import { useRoute } from 'vue-router'

const route = useRoute()
const origin = route.query.origin ? `/${route.query.origin}` : '/waiter'
const axios = new Axios()
const user = defineModel<IUser>()
const snackbarStore = SnackbarStore()

const emit = defineEmits(['login', 'reload'])

const props = defineProps(['event_id', 'table_id', 'master_table_id'])

const loading = ref<boolean>(true)
const dialog = ref<boolean>(false)
const dialogTable = ref<boolean>(false)
const tableName = ref<string>('')
const dialogItem = ref<Item>()
const master_items = ref<MasterItem[]>([])
const sheet = ref(false)
const orderItems = ref<Item[]>([])
const filter = ref<string>('')
const table_name = ref<string>('')

const orderTotal = computed(() => orderItems.value.reduce((a: number, i: Item) => a += i.price, 0))
const foodTotal = computed(() => orderItems.value.filter((i: Item) => i.type === 'Cibo').length)
const beverageTotal = computed(() => orderItems.value.filter((i: Item) => i.type === 'Bevanda').length)
const computedItems = computed(() => master_items.value.filter((i: MasterItem) => (filter.value === '' || filter.value === null || i.name.toLowerCase().indexOf(filter.value.toLowerCase()) > - 1)))
const groupedOrderItems = computed(() => {
  return groupItems(orderItems.value)
})

function filterItems(type: Type) {
  return computedItems.value.filter((i: MasterItem) => i.sub_type === type.name).sort(sortItem)
}

function addItemToOrder(item: Item) {
  item.table_id = props.table_id
  item.master_item_id = item.id
  orderItems.value.push(copy<Item>(item))
  snackbarStore.show(`${item.name} aggiunto`, 2000, 'top')
}

function addItemWithNote() {
  dialogItem.value.table_id = props.table_id
  dialogItem.value.master_item_id = dialogItem.value.id
  orderItems.value.push(copy<Item>(dialogItem.value))
  dialog.value = false
  snackbarStore.show(`${dialogItem.value.name} aggiunto`)
}

function changeItemQuantity(item: Item, quantity: number) {
  if (quantity === 1) {
    delete item.quantity
    orderItems.value.push(item)
  }
  if (quantity === -1) {
    for (let i = 0; i < orderItems.value.length; i++) {
      if (orderItems.value[i].master_item_id == item.master_item_id && orderItems.value[i].note === item.note && orderItems.value[i].name === item.name) {
        orderItems.value.splice(i, 1);
        break;
      }
    }
  }
}

function openNoteDialog(item: Item, premium: boolean = false) {
  dialogItem.value = copy<Item>(item)
  if (premium) {
    dialogItem.value.price = 9
    dialogItem.value.name = `${item.name} - PREMIUM`
  }
  dialog.value = true
}

async function sendOrder() {
  const _order: Order = {
    event_id: parseInt(props.event_id),
    master_table_id: parseInt(props.master_table_id),
    table_id: parseInt(props.table_id),
    items: orderItems.value,
    table_name: table_name.value
  } as Order
  await axios.CreateOrder(_order)
  snackbarStore.show("Ordine inviato con successo", 3000, 'top', 'success')
  router.push(origin)
}

async function setTableName() {
  table_name.value = tableName.value
  dialogTable.value = false
}

onMounted(async () => {
  master_items.value = await axios.GetAvailableMasterItems()
  if (parseInt(props.table_id)) {
    table_name.value = (await axios.GetTable(props.table_id)).name
  }
  else if (parseInt(props.master_table_id)) {
    table_name.value = (await axios.GetMasterTable(props.master_table_id)).name
  }
  else {
    dialogTable.value = true
  }
  loading.value = false
})
</script>

<template>
  <v-skeleton-loader v-if="loading" type="list-item-three-line"></v-skeleton-loader>
  <div v-else>
    <v-text-field :clearable="true" v-model="filter" label="Cerca"></v-text-field>
    <v-list>
      <template v-for="type in types">
        <v-list-subheader style="margin-top: 10px" inset>{{ type.name }}</v-list-subheader>
        <template v-for="item in filterItems(type)">
          <v-list-item>
            <v-list-item-title>
              {{ item.name }}
            </v-list-item-title>
            <template v-slot:append>
              <v-btn icon="mdi-star-circle" v-if="item.sub_type === 'Cocktail'" variant="text"
                @click="openNoteDialog(item, true)"></v-btn>
              <v-btn icon="mdi-pencil" variant="text" @click="openNoteDialog(item, false)"></v-btn>
              <v-btn icon="mdi-plus" variant="text" @click="addItemToOrder(item)"></v-btn>
            </template>
          </v-list-item>
          <v-divider></v-divider>
        </template>
      </template>
    </v-list>
    <v-bottom-sheet v-model="sheet" scrollable>
      <v-card :title="`Ordine Tavolo ${table_name}`" style="padding-bottom: 50px">
        <ItemList v-model="groupedOrderItems">
          <template v-slot:prequantity="slotProps">
            <v-btn variant="plain" icon="mdi-minus" @click="changeItemQuantity(slotProps.item, -1)"></v-btn>
          </template>
          <template v-slot:postquantity="slotProps">
            <v-btn variant="plain" icon="mdi-plus" @click="changeItemQuantity(slotProps.item, 1)"></v-btn>
          </template>
        </ItemList>
      </v-card>
      <v-bottom-navigation :name="'inner-button-nav-bar'">
        <v-btn style="font-size: x-large;" icon="mdi-arrow-down" variant="plain" @click="sheet = !sheet"></v-btn>
        <v-spacer></v-spacer>
        <v-btn style="font-size: x-large;" icon="mdi-send" variant="plain" @click="sendOrder">

        </v-btn>
      </v-bottom-navigation>
    </v-bottom-sheet>
  </div>
  <v-dialog v-model="dialogTable" max-width="600">
    <v-card>
      <v-card-title>
        Indica il nome del tavolo
      </v-card-title>
      <v-card-text>
        <v-row dense>
          <v-col cols="12">
            <v-text-field v-model="tableName" label="Nome Tavolo" required :autofocus="true"></v-text-field>
          </v-col>
        </v-row>
      </v-card-text>

      <v-divider></v-divider>

      <v-card-actions>
        <v-spacer></v-spacer>
        <RouterLink to="/waiter">
          <v-btn text="Annulla" variant="plain"></v-btn>
        </RouterLink>

        <v-btn :disabled="tableName === ''" color="primary" text="Salva" variant="tonal" @click="setTableName"></v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  <v-dialog v-model="dialog" max-width="600">
    <v-card>
      <v-card-title>
        {{ dialogItem.name }}
      </v-card-title>
      <v-card-text>
        <v-row dense>
          <v-col cols="12">
            <v-textarea v-model="dialogItem.note" label="Nota" required :autofocus="true"
              :clearable="true"></v-textarea>
          </v-col>
        </v-row>
      </v-card-text>

      <v-divider></v-divider>

      <v-card-actions>
        <v-spacer></v-spacer>

        <v-btn text="Annulla" variant="plain" @click="dialog = false"></v-btn>

        <v-btn color="primary" text="Aggiungi" variant="tonal" @click="addItemWithNote"></v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  <v-bottom-navigation :name="'outer-button-nav-bar'" elevation="24">
    <RouterLink to="/waiter">
      <v-btn density="compact" style="text-decoration: none">
        <v-icon>mdi-arrow-left</v-icon>
      </v-btn>
    </RouterLink>
    <v-btn density="compact" readonly>
      <v-icon>mdi-beer</v-icon>
      <span>{{ beverageTotal }}</span>
    </v-btn>
    <v-btn density="compact" readonly>
      <v-icon>mdi-hamburger</v-icon>
      <span>{{ foodTotal }}</span>
    </v-btn>
    <v-btn density="compact" readonly>
      <v-icon>mdi-currency-eur</v-icon>
      <span>{{ orderTotal }}</span>
    </v-btn>
    <v-spacer></v-spacer>
    <v-btn class="hide-xs" v-show="orderTotal > 0" @click="sheet = !sheet">
      <v-icon>mdi-list-box</v-icon>
    </v-btn>
    <v-btn class="show-xs" v-show="orderTotal > 0" @click="sheet = !sheet" variant="plain">
      INVIA ORDINE
    </v-btn>
  </v-bottom-navigation>
</template>

<style scoped></style>