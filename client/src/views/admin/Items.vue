<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { type MasterItem, type SubType, type Destination } from "../../../../models/src"
import Axios from '@/services/client'
import { SnackbarStore } from '@/stores'
import { sortItem, copy, requiredRule } from '@/services/utils'
import { RouterLink } from 'vue-router'
const axios = new Axios()
const snackbarStore = SnackbarStore()
const props = defineProps(['menu_id', 'menu_name'])

const loading = ref<boolean>(false)
const dialog = ref<boolean>(false)
const confirm = ref<boolean>(false)
const selectedItem = ref<MasterItem>(null)
const items = ref<MasterItem[]>([])
const filter = ref<string>('')
const form = ref(null)
const destinations = ref<Destination[]>([])
const types = ref<SubType[]>([])

const filteredItems = computed(() => items.value.filter((i: MasterItem) => !filter.value || new RegExp(filter.value, 'i').test(i.name)).sort(sortItem))

function openDialog(item: MasterItem) {
  selectedItem.value = copy<MasterItem>(item)
  dialog.value = true
}

async function updateTableItem(item: MasterItem) {
  selectedItem.value = item
  await updateItem()
  await getMasterItems()
}

async function updateItem(del: boolean = false) {
  const { valid } = await form.value?.validate()
  if (valid) {
    setType()
    if (del) {
      selectedItem.value.status = 'DELETED'
    }
    await axios.EditMasterItems(selectedItem.value)
    dialog.value = false
    confirm.value = false
    getMasterItems()
    snackbarStore.show(del ? "Elemento eliminato" : "Elemento aggiornato")
  }
}

async function createItem() {
  const { valid } = await form.value?.validate()
  if (valid) {
    setType()
    await axios.CreateMasterItems(selectedItem.value)
    dialog.value = false
    getMasterItems()
    snackbarStore.show("Tavolo creato")
  }
}

async function getMasterItems() {
  loading.value = true
  items.value = await axios.GetAllMasterItems(props.menu_id)
  loading.value = false
}

function setType() {
  selectedItem.value.type = types.value.find((t: SubType) => t.id === selectedItem.value.sub_type_id).type
}

onMounted(async () => {
  types.value = await axios.GetSubTypes()
  destinations.value = await axios.GetDestinations()
  await getMasterItems()
  destinations.value = await axios.GetDestinations()
})
</script>

<template>
  <div>
    <v-skeleton-loader v-if="loading" type="list-item-three-line"></v-skeleton-loader>
    <div v-else>
      <v-toolbar>
        <v-toolbar-title>
          {{ menu_name }}
        </v-toolbar-title>
        <v-spacer></v-spacer>
        <RouterLink to="/admin/menu">
          <v-btn icon="mdi-arrow-left"></v-btn>
        </RouterLink>
      </v-toolbar>
      <v-text-field :clearable="true" v-model="filter" label="Cerca"></v-text-field>
      <v-table density="compact">
        <thead>
          <tr>
            <th class="text-left">
              Nome
            </th>
            <th class="text-left">
              Categoria
            </th>
            <th class="text-left">
              Sottocategoria
            </th>
            <th class="text-left">
              Prezzo
            </th>
            <th class="text-left">
              Destinazione
            </th>
            <th class="text-left">
              Disponibile
            </th>
          </tr>
        </thead>
        <tbody style="cursor: pointer;">
          <tr v-for="item in filteredItems" :key="item.id" @click="openDialog(item)">
            <td>{{ item.name }}</td>
            <td>{{ item.type }}</td>
            <td>{{ item.sub_type }}</td>
            <td>{{ item.price }} €</td>
            <td>{{ item.destination }}</td>
            <td>
              <v-switch color="green" :false-value="0" :true-value="1" v-model:model-value="item.available"
                @change.stop="updateTableItem(item)"></v-switch>
            </td>
          </tr>
        </tbody>
      </v-table>
      <v-dialog v-model="dialog" width="400px">
        <v-card>
          <v-card-title v-if="selectedItem.id">
            Modifica elemento
          </v-card-title>
          <v-card-title v-else>
            Crea nuovo elemento
          </v-card-title>
          <v-card-text>
            <v-form ref="form" @submit.prevent>
              <v-row>
                <v-col cols="12">
                  <v-text-field v-model="selectedItem.name" label="Nome" :rules="[requiredRule]"></v-text-field>
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="selectedItem.price" label="Prezzo" type="number" :rules="[requiredRule]"
                    append-inner-icon="mdi-currency-eur"></v-text-field>
                </v-col>
                <v-col>
                  <v-switch color="green" label="Disponibile" :false-value="0" :true-value="1"
                    v-model:model-value="selectedItem.available"></v-switch>
                </v-col>
                <v-col cols="12">
                  <v-select :items="types" label="Categoria" item-value="id" item-title="name" v-model="selectedItem.sub_type_id"
                    :rules="[requiredRule]">
                    <template v-slot:item="{ props, item }">
                      <v-list-item v-bind="props" :subtitle="item.raw.type" :title="item.raw.name"></v-list-item>
                    </template>
                  </v-select>
                </v-col>
                <v-col cols="12">
                  <v-select :items="destinations" label="Destinazione" item-value="id" item-title="name"
                    :rules="[requiredRule]" v-model="selectedItem.destination_id">
                    <template v-slot:item="{ props, item }">
                      <v-list-item v-bind="props" :title="item.raw.name"></v-list-item>
                    </template>
                  </v-select>
                </v-col>
              </v-row>
            </v-form>
          </v-card-text>
          <v-card-actions>
            <v-btn variant="plain" @click="dialog = false">ANNULLA</v-btn>
            <v-btn color="red" v-if="selectedItem.id" variant="plain" @click="confirm = true">ELIMINA</v-btn>
            <v-btn v-if="selectedItem.id" variant="plain" @click="updateItem()">AGGIORNA</v-btn>
            <v-btn v-else variant="plain" @click="createItem">CONFERMA</v-btn>
          </v-card-actions>
        </v-card>
        <Confirm v-model="confirm">
          <template v-slot:action>
            <v-btn text="Conferma" variant="plain" @click="updateItem(true)"></v-btn>
          </template>
        </Confirm>
      </v-dialog>
    </div>
    <v-fab icon="mdi-plus" app style="position: fixed; right: 10px; bottom: 10px;" location="bottom right" @click="openDialog({
      status: 'ACTIVE',
      menu_id: menu_id,
      available: 1
    } as MasterItem)"></v-fab>
  </div>
</template>
