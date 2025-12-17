<script setup lang="ts">
import type { Table, Item, SubType } from "../../../models/src"
import { ref, computed, onUnmounted, watch } from "vue"
import Axios from '@/services/client'
import { sortTables } from "@/services/utils"
import CheckoutOrder from "@/components/CheckoutOrder.vue"
import { useDisplay } from 'vuetify'

const { smAndUp } = useDisplay()

const props = defineProps(['event'])

const axios = new Axios()

const emit = defineEmits(['getTables'])

const loading = ref<boolean>(false)
const tables = ref<Table[]>([])
const selectedTable = ref<Table[]>([])
const tableSheet = ref<boolean>(false)
const types = ref<SubType[]>([])
const drawer = ref<boolean>(true)

const sortedTables = computed(() => tables.value.sort(sortTables))

function getSubTypeCount(table: Table, subtype: string[]) {
  if (table && table.items) {
    return table.items.reduce((a: number, i: Item) => a += subtype.includes(i.sub_type) ? 1 : 0, 0)
  }
  return 0
}

async function getTables(table_id?: number) {
  const _tables = (await axios.GetTablesInEvent(props.event?.id || 0)).filter(t => t.status === 'CLOSED')
  _tables.forEach((t: Table) => {
    if (!t.items) {
      t.items = []
    }
  })
  const tableDiff: boolean = tables.value.length > _tables.length
  tables.value = _tables
  if (tables.value.length) {
    if (selectedTable.value.length === 0) {
      selectedTable.value = [tables.value[0]]
    } else {
      const foundTable = tables.value.find((t: Table) => t.id === selectedTable.value[0].id)
      if (foundTable) {
        selectedTable.value = [foundTable]
      } else {
        selectedTable.value = [tables.value[0]]
      }
    }
  }
  else {
    selectedTable.value = []
  }

  if (tableDiff) {
    emit('getTables', table_id)
  }
}

async function init() {
  if (props.event && props.event.id) {
    loading.value = true
    types.value = await axios.GetSubTypes()
    await getTables()

    loading.value = false
  }
}

watch(() => props.event, init, { immediate: true })

watch(() => selectedTable.value, () => {
  if (!smAndUp.value) {
    drawer.value = false
  }
}, { immediate: true, deep: true })

onUnmounted(() => {

})
</script>

<template>
  <v-navigation-drawer v-if="props.event?.id" v-model="drawer" mobile-breakpoint="sm" location="right" :width="450">
    <v-list v-model:selected="selectedTable" lines="two" mandatory>
      <v-list-subheader>Tavoli Chiusi</v-list-subheader>
      <v-list-item :key="table.id" v-for="(table, i) in sortedTables" :value="table">
        <v-list-item-title>
          <span>{{ table.name }}</span>
        </v-list-item-title>
        <template v-for="type in types">
          <v-btn readonly size="small" density="compact" variant="plain" v-if="getSubTypeCount(table, [type.name]) > 0">
            <v-icon>{{ type.icon }}</v-icon> {{ getSubTypeCount(table, [type.name]) }}
          </v-btn>
        </template>
      </v-list-item>
    </v-list>
    <v-fab @click="drawer = !drawer" height="48px" icon="mdi-undo" location="bottom left" variant="flat"></v-fab>
  </v-navigation-drawer>
  <v-skeleton-loader type="card" v-if="loading"></v-skeleton-loader>
  <v-container v-else-if="!props.event?.id">
    <NoEvent></NoEvent>
  </v-container>
  <CheckoutOrder :roomid="-1" v-else-if="tables.length" :event="props.event" v-model:selected-table="selectedTable"
    @get-tables="getTables" @change-table-sheet="tableSheet = true" v-model:drawer="drawer" />
  <v-alert type="info" variant="tonal" class="ma-auto" v-else>Nessun Tavolo Chiuso</v-alert>
</template>

<style scoped>
  .v-fab {
    height: 48px !important;
    position: absolute;
    bottom: 10px;
    left: 10px;
  }
</style>