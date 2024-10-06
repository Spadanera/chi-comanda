<script setup lang="ts">
import { Order, MasterItem, Item } from "@models"
import { ref, onMounted, computed } from "vue"
import router from '@/router'
import Axios from '@/services/client'
import { SnackbarStore } from '@/stores'

const axios = new Axios()
const user = defineModel<IUser>()
const snackbarStore = new SnackbarStore()

const emit = defineEmits(['reload'])

const props = defineProps(['event_id', 'table_id', 'master_table_id'])

const loading = ref<boolean>(true)
const dialog = ref<boolean>(false)
const dialogItem = ref<Item>({})
const master_items = ref<MasterItem>([])
const sheet = ref(false)
const types = ref([
  "SOFT-DRINK",
  "COCKTAIL",
  "BEER",
  "SPIRIT",
  "PIADINA",
  "EXTRA"
])
const orderItems = ref<Item>([])
const filter = ref<string>('')
const table_name = ref<string>('')

const orderTotal = computed(() => orderItems.value.reduce((a, v) => a += v.price, 0))
const foodTotal = computed(() => orderItems.value.filter(i => i.type === 'FOOD').length)
const beverageTotal = computed(() => orderItems.value.filter(i => i.type === 'BEVERAGE').length)
const computedItems = computed(() => master_items.value.filter(i => (filter.value === '' || filter.value === null || i.name.toLowerCase().indexOf(filter.value.toLowerCase()) > - 1)))
const groupedOrderItems = computed(() => {
  return orderItems.value.reduce((a, i) => {
    let found = a.find(_i => (i.id === _i.id && i.note === _i.note))
    if (found) {
      found.quantity++
    }
    else {
      i.quantity = 1
      a.push(i)
    }
    return a.sort((a, b) => {
      if (a.type < b.type) {
        return -1
      }
      if (a.type > b.type) {
        return 1
      }
      if (a.name < b.name) {
        return -1
      }
      if (a.name > b.name) {
        return 1
      }
    })
  }, [])
})

function filterItems(sub_type) {
  return computedItems.value.filter(i => i.sub_type === sub_type)
}

function addItemToOrder(item: Item) {
  item.table_id = props.table_id
  item.master_item_id = item.id
  orderItems.value.push(JSON.parse(JSON.stringify(item)))
  snackbarStore.show(`${item.name} aggiunto`, 2000, 'top')
}

function addItemWithNote() {
  dialogItem.value.table_id = props.table_id
  dialogItem.value.master_item_id = dialogItem.value.id
  orderItems.value.push(JSON.parse(JSON.stringify(dialogItem.value)))
  dialog.value = false
  snackbarStore.show(`${dialogItem.value.name} aggiunto`, 2000, 'top')
}

function changeItemQuantity(item, quantity) {
  if (quantity === 1) {
    delete item.quantity
    orderItems.value.push(item)
  }
  if (quantity === -1) {
    for (let i = 0; i < orderItems.value.length; i++) {
      if (orderItems.value[i].id == item.id && orderItems.value[i].note === item.note) {
        orderItems.value.splice(i, 1);
        break;
      }
    }
  }
}

function openNoteDialog(item: Item) {
  dialogItem.value = JSON.parse(JSON.stringify(item))
  dialog.value = true
}

async function sendOrder() {
  await axios.CreateOrder({
    event_id: props.event_id,
    master_table_id: props.master_table_id,
    table_id: props.table_id,
    items: orderItems.value
  })
  snackbarStore.show("Ordine inviato con successo")
  router.push('/waiter')
}

onMounted(async () => {
  master_items.value = await axios.GetAllMasterItems()
  table_name.value = (await axios.GetMasterTable(props.master_table_id)).name
  loading.value = false
})
</script>

<template>
  <v-skeleton-loader v-if="loading" :loading="loading" type="list-item-three-line"></v-skeleton-loader>
  <div>
    <v-text-field :clearable="true" v-model="filter" label="Cerca"></v-text-field>
    <v-list>
      <template v-for="type in types">
        <v-list-subheader inset>{{ type }}</v-list-subheader>
        <v-list-item elevation="4" v-for="item in filterItems(type)">
          <v-list-item-title>
            {{ item.name }}
          </v-list-item-title>
          <template v-slot:append>
            <v-btn icon="mdi-pencil" variant="text" @click="openNoteDialog(item)"></v-btn>
            <v-btn icon="mdi-plus" variant="text" @click="addItemToOrder(item)"></v-btn>
          </template>
        </v-list-item>
      </template>
    </v-list>
    <v-bottom-sheet v-model="sheet">
      <v-card title="Ordine" style="padding-bottom: 50px">
        <v-list>
          <v-list-item :lines="item.note ? 'two' : 'one'" v-for="item in groupedOrderItems" :title="item.name">
            <v-list-item-subtitle>
              {{ item.type }}<span v-if="item.note"> - {{ item.note }}</span>
            </v-list-item-subtitle>
            <template v-slot:append>
              <v-btn variant="plain" icon="mdi-minus" @click="changeItemQuantity(item, -1)"></v-btn>
              <span>{{ item.quantity }}</span>
              <v-btn variant="plain" icon="mdi-plus" @click="changeItemQuantity(item, 1)"></v-btn>
            </template>
          </v-list-item>
        </v-list>
      </v-card>
      <v-bottom-navigation :name="'inner-button-nav-bar'">
        <v-btn style="font-size: x-large;" text="Annulla" variant="plain" @click="sheet = !sheet"></v-btn>
        <v-spacer></v-spacer>
        <v-btn style="font-size: x-large;" text="Invia" variant="plain" @click="sendOrder"></v-btn>
      </v-bottom-navigation>
    </v-bottom-sheet>
  </div>
  <v-dialog v-model="dialog" max-width="600">
    <v-card>
      <v-card-title>
        {{ dialogItem.name }} - Aggiungi nota
      </v-card-title>
      <v-card-text>
        <v-row dense>
          <v-col cols="12" md="4" sm="6">
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
    <v-btn value="cibo">
      <v-icon>mdi-hamburger</v-icon>

      <span>{{ foodTotal }}</span>
    </v-btn>

    <v-btn value="bevande">
      <v-icon>mdi-beer</v-icon>

      <span>{{ beverageTotal }}</span>
    </v-btn>

    <v-btn value="totale">
      <v-icon>mdi-currency-eur</v-icon>

      <span>{{ orderTotal }}</span>
    </v-btn>
    <v-spacer></v-spacer>
    <v-btn v-if="orderTotal > 0" style="font-size: x-large;" text="Rivedi" variant="plain" @click="sheet = !sheet"></v-btn>
  </v-bottom-navigation>
</template>

<style scoped></style>