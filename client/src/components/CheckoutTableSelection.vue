<script setup lang="ts">
import { type AvailableTable, type Table } from "../../../models/src"
import { ref, watch } from "vue"
import api from '@/services/client'

const props = defineProps(['event', 'selectedTable'])
const model = defineModel<boolean>()
const emit = defineEmits(['changed'])

const freeTables = ref<AvailableTable[]>([])

watch(model, async (val) => {
    if (val && props.event?.id) {
        freeTables.value = await api.GetFreeTables(props.event.id)
    }
})

async function changeTable(table_id: number) {
    if (props.selectedTable && props.selectedTable.length) {
        await api.ChangeTable(props.selectedTable[0].id, table_id)
        emit('changed')
        model.value = false
    }
}
</script>

<template>
    <v-bottom-sheet scrollable v-model="model">
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
                <v-btn @click="model = false">ANNULLA</v-btn>
            </v-card-actions>
        </v-card>
    </v-bottom-sheet>
</template>

<style scoped>
.table-selection .v-card {
    text-align: center;
    font-size: large;
}
</style>