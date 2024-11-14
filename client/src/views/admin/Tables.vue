<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { type MasterTable } from "../../../../models/src"
import Axios from '@/services/client'
import { SnackbarStore } from '@/stores'
import { sortAvailableTable, copy, requiredRule } from '@/services/utils'
const axios = new Axios()
const snackbarStore = SnackbarStore()

const loading = ref<boolean>(false)
const dialog = ref<boolean>(false)
const confirm = ref<boolean>(false)
const selectedTable = ref<MasterTable>(null)
const tables = ref<MasterTable[]>([])
const form = ref(null)

function openDialog(table: MasterTable) {
  selectedTable.value = copy<MasterTable>(table)
  dialog.value = true
}

async function updateTable(del: boolean = false) {
  if (del) {
    selectedTable.value.status = 'DELETED'
  }
  await axios.EditMasterTables(selectedTable.value)
  dialog.value = false
  confirm.value = false
  getAllMasterTable()
  snackbarStore.show(del ? "Tavolo eliminato" : "Tavolo aggiornato")
}

async function createTable() {
  const { valid } = await form.value?.validate()
  if (valid) {
    selectedTable.value.status = 'ACTIVE'
    await axios.CreateMasterTables(selectedTable.value)
    dialog.value = false
    getAllMasterTable()
    snackbarStore.show("Tavolo creato")
  }
}

async function getAllMasterTable() {
  loading.value = true
  tables.value = (await axios.GetAllMasterTables()).sort(sortAvailableTable)
  loading.value = false
}

onMounted(async () => {
  await getAllMasterTable()
})
</script>
<template>
  <v-container>
    <h4>Elenco Tavoli</h4>
  </v-container>
  <v-container>
    <v-skeleton-loader v-if="loading" type="card"></v-skeleton-loader>
    <v-row v-else>
      <v-col v-for="table in tables" cols="4">
        <v-card height="50px" style="padding-top: 10px;" @click="openDialog(table)">
          {{ table.name }}
        </v-card>
        <v-card-subtitle v-if="table.inUse" style="margin-top: -22px;">
          in uso
        </v-card-subtitle>
      </v-col>
    </v-row>
    <v-fab icon="mdi-plus" app style="position: fixed; right: 10px; bottom: 10px;" location="bottom right" @click="openDialog({
      status: 'ACTIVE'
    } as MasterTable)"></v-fab>
    <v-dialog v-model="dialog" width="380px">
      <v-card>
        <v-card-title v-if="selectedTable.id">
          Modifica tavolo
        </v-card-title>
        <v-card-title v-else>
          Crea nuovo tavolo
        </v-card-title>
        <v-card-text>
          <v-form @submit.prevent ref="form">
            <v-text-field v-model="selectedTable.name" label="Nome Tavolo" clearable :rules="[requiredRule]"></v-text-field>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="plain" @click="dialog = false">ANNULLA</v-btn>
          <v-btn color="red" v-if="selectedTable.id && !selectedTable.inUse" variant="plain" @click="confirm = true">ELIMINA</v-btn>
          <v-btn v-if="selectedTable.id" variant="plain" @click="updateTable()" type="submit">AGGIORNA</v-btn>
          <v-btn v-else variant="plain" @click="createTable">CONFERMA</v-btn>
        </v-card-actions>
      </v-card>
      <Confirm v-model="confirm">
        <template v-slot:action>
          <v-btn text="Conferma" variant="plain" @click="updateTable(true)"></v-btn>
        </template>
      </Confirm>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.v-card {
  text-align: center;
  font-size: large;
}
</style>