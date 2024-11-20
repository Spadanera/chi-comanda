<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { type Event, type Item, type Table, type SubType, type Type } from "../../../models/src"
import { groupItems } from "@/services/utils"
import Axios from '@/services/client'
import ItemList from '@/components/ItemList.vue'

const selectedEvent = defineModel<Event>()
const axios = new Axios()
const emit = defineEmits(['close'])
const selectedTable = ref<Table[]>([{
    items: []
}] as Table[])
const tab = ref<number>(0)
const subTypes = ref<SubType[]>([])
const types = ref<Type[]>([])

const items = computed<Item[]>(() => {
    const _items: Item[] = []
    if (selectedEvent.value && selectedEvent.value.tables) {
        selectedEvent.value.tables.forEach((t: Table) => {
            _items.push(...t.items)
        })
    }
    return _items
})

const typeItems = computed<{ subheader: string, items: Item[] }[]>(() => {
    let result: { subheader: string, items: Item[] }[] = []
    types.value.forEach((t: Type) => {
        result.push({
            subheader: t.name,
            items: groupItems(items.value.filter((i: Item) => i.type === t.name))
        })
    })
    return result
})

function getSubTypeCount(table: Table, subtype: string[]) {
    if (table && table.items) {
        return table.items.reduce((a: number, i: Item) => a += subtype.includes(i.sub_type) ? 1 : 0, 0)
    }
    return 0
}

onMounted(async () => {
    subTypes.value = await axios.GetSubTypes()
    types.value = await axios.GetTypes()
    if (selectedEvent.value && selectedEvent.value.tables && selectedEvent.value.tables.length) {
        selectedTable.value[0] = selectedEvent.value.tables[0]
    }
})
</script>
<template>
    <v-card>
        <v-card-title>
            {{ selectedEvent.date.toString().split('T')[0] }}
        </v-card-title>
        <v-card-subtitle>
            {{ selectedEvent.name }}
            <v-tabs v-model="tab">
                <v-tab>Consumazioni</v-tab>
                <v-tab>Tavoli</v-tab>
            </v-tabs>
        </v-card-subtitle>
        <v-card-text style="padding-left: 0; padding-right: 0">
            <v-tabs-window v-model="tab">
                <v-tabs-window-item>
                    <v-row>
                        <v-col style="padding: 0" sm="6" cols="12" v-for="typeItem in typeItems">
                            <ItemList v-if="typeItem.items.length" :quantitybefore="true" v-model="typeItem.items"
                                :subheader="typeItem.subheader"></ItemList>
                        </v-col>
                    </v-row>
                </v-tabs-window-item>
                <v-tabs-window-item>
                    <v-row no-gutters>
                        <v-col cols="5" class="scroll-col">
                            <v-list v-model:selected="selectedTable" lines="two">
                                <v-list-item :key="table.id" v-for="table in selectedEvent.tables" :value="table"
                                    :style="{ opacity: table.status === 'CLOSED' ? 0.3 : 'inherit' }">
                                    <v-list-item-title>
                                        <span :class="{ done: table.paid }">Tavolo {{ table.name }}</span>
                                    </v-list-item-title>
                                    <template v-for="type in subTypes">
                                        <v-btn readonly size="small" density="compact" variant="plain"
                                            v-if="getSubTypeCount(table, [type.name]) > 0">
                                            <v-icon>{{ type.icon }}</v-icon> {{ getSubTypeCount(table,
                                                [type.name])
                                            }}
                                        </v-btn>
                                    </template>
                                </v-list-item>
                            </v-list>
                        </v-col>
                        <v-col cols="7" class="scroll-col">
                            <ItemList :subheader="`Totale: ${selectedTable[0].revenue} €`" :quantitybefore="true"
                                v-model="selectedTable[0].items"></ItemList>
                        </v-col>
                    </v-row>
                </v-tabs-window-item>
            </v-tabs-window>
        </v-card-text>
        <v-card-actions class="inner-elevation">
            <v-btn readonly size="small" density="compact" variant="plain">
                <v-icon>mdi-table-furniture</v-icon> {{ selectedEvent.tableCount }}
            </v-btn>
            <v-btn readonly size="small" density="compact" variant="plain">
                <v-icon>mdi-currency-eur</v-icon> {{ selectedEvent.revenue }}
            </v-btn>
            <v-btn readonly size="small" density="compact" variant="plain">
                <v-icon>mdi-cart-percent</v-icon> {{ selectedEvent.discount * -1 }} €
            </v-btn>

            <v-spacer></v-spacer>
            <v-btn text="Chiudi" variant="plain" @click="emit('close')"></v-btn>
        </v-card-actions>
    </v-card>
</template>
<style scoped>
.scroll-col {
    max-height: 500px;
    overflow-y: auto;
}
</style>