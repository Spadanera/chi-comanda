<script lang="ts">
import type { SubType } from "../../../models/src"
let cachedTypes: SubType[] | null = null
</script>

<script setup lang="ts">
import type { Table, Item } from "../../../models/src"
import { ref, computed, watch } from "vue"
import Axios from '@/services/client'
import { useDisplay } from 'vuetify'

const { smAndUp } = useDisplay()

const props = defineProps(['event', 'tables'])

const axios = new Axios()

const emit = defineEmits(['clickTable'])

const loading = ref<boolean>(false)
const types = ref<SubType[]>([])

const sortedTables = computed(() => props.tables?.filter((t: Table) => t.room_id === -1))

const tablesWithCounts = computed(() => {
  if (!sortedTables.value) return []
  return sortedTables.value.map((table: Table) => {
    const counts = types.value.reduce((acc, type) => {
      const count = table.items?.reduce((sum, item) => sum + (item.sub_type === type.name ? 1 : 0), 0) || 0
      if (count > 0) acc[type.name] = count
      return acc
    }, {} as Record<string, number>)
    return { ...table, counts }
  })
})

const onClickTable = (table: Table) => emit('clickTable', table)

async function init() {
  if (cachedTypes) {
    types.value = cachedTypes
    return
  }

  if (props.event && props.event.id) {
    loading.value = true
    const res = await axios.GetSubTypes()
    cachedTypes = res
    types.value = res

    loading.value = false
  }
}

watch(() => props.event, init, { immediate: true })

</script>

<template>
  <v-list lines="two">
    <v-list-item :key="table.id" v-for="(table) in tablesWithCounts" :value="table" @click="onClickTable(table)">
      <v-list-item-title>
        <span style="padding-left: 10px">{{ table.table_name }}</span>
      </v-list-item-title>
      <template v-for="type in types">
        <v-btn readonly size="small" density="compact" variant="plain" v-if="table.counts[type.name]">
          <v-icon>{{ type.icon }}</v-icon> {{ table.counts[type.name] }}
        </v-btn>
      </template>
      <template v-slot:append>
        Totale: {{table.items.reduce((acc: number, i: Item) => acc + i.price, 0)}} €
      </template>
    </v-list-item>
  </v-list>
</template>

<style scoped>
.v-fab {
  height: 48px !important;
  position: absolute;
  bottom: 10px;
  left: 10px;
}
</style>