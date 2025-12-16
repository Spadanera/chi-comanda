<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import type { MasterTable, RestaurantLayout, Room, TableUpdatePayload, Event } from '../../../models/src'
import RestaurantMap from '@/components/RestaurantMap.vue'
import RoomTabs from '@/components/RoomTabs.vue'
import RoomDialog from '@/components/RoomDialog.vue'
import TableDialog from '@/components/TableDialog.vue'
import { useDisplay } from 'vuetify'

const { smAndUp } = useDisplay()

import Axios from '@/services/client'
import { SnackbarStore } from '@/stores'

const props = defineProps<{
    event?: Event,
    editRoom?: boolean,
}>()

const axios = new Axios()
const snackbarStore = SnackbarStore()

const rooms = ref<Room[]>([])
const tables = ref<MasterTable[]>([])
const editing = ref<boolean>(false)

const activeRoomId = ref<number>()
const selectedTableId = ref<number>(0)
const zoomLevel = ref(1)
const deleteConfirmDialog = ref(false)

const roomDialog = ref(false)
const isEditingRoom = ref(false)
const tableDialog = ref(false)

const tempRoom = reactive<Room>({ name: '', width: 10, height: 8 } as Room)
const tempTable = reactive<MasterTable>({
    name: '', default_seats: 0, x: 0, y: 0, width: 0, height: 0, shape: 'rect'
} as MasterTable)

const currentRoom = computed(() => rooms.value.find(r => r.id === activeRoomId.value))
const roomSelected = computed(() => activeRoomId.value && rooms.value.length)

const openRoomDialog = (room?: Room) => {
    if (room) {
        isEditingRoom.value = true
        Object.assign(tempRoom, room)
    } else {
        isEditingRoom.value = false
        Object.assign(tempRoom, {
            id: Date.now() * -1,
            name: '',
            width: 10,
            height: 8
        })
    }
    roomDialog.value = true
}

const onSaveRoom = (roomData: Room) => {
    if (isEditingRoom.value) {
        const index = rooms.value.findIndex(r => r.id === roomData.id)
        if (index !== -1) rooms.value[index] = roomData
    } else {
        rooms.value.push(roomData)
        activeRoomId.value = roomData.id
    }
    editing.value = true
    roomDialog.value = false
}

const deleteRoom = () => {
    rooms.value = rooms.value.filter(r => r.id !== activeRoomId.value)
    tables.value = tables.value.filter(t => t.room_id !== activeRoomId.value)
    if (rooms.value.length) {
        activeRoomId.value = rooms.value[0].id
    }
    deleteConfirmDialog.value = false
    editing.value = true
}

const addTable = () => {
    if (!activeRoomId.value) return
    editing.value = true

    const newTableData: MasterTable = {
        id: Date.now() * -1,
        room_id: activeRoomId.value,
        name: ``,
        master_table_name: ``,
        default_seats: 4,
        x: 50,
        y: 50,
        width: 100,
        height: 100,
        shape: 'rect',
        status: 'ACTIVE'
    } as MasterTable

    onTableClick(newTableData)
}

const onTableClick = (table: MasterTable) => {
    selectedTableId.value = table.id
    Object.assign(tempTable, table)
    tableDialog.value = true
}

const onSaveTable = (tableData: MasterTable) => {
    editing.value = true
    const index = tables.value.findIndex(t => t.id === tableData.id)
    if (index !== -1) {
        tables.value[index] = tableData
    } else {
        tables.value.push(tableData)
        // Aggiorniamo l'ID selezionato se era un nuovo tavolo
        selectedTableId.value = tableData.id
    }
    tableDialog.value = false
}

const onDeleteTable = (tableId: number) => {
    tables.value = tables.value.filter(t => t.id !== tableId)
    tableDialog.value = false
    selectedTableId.value = 0
    editing.value = true
}

const onTableUpdate = (payload: TableUpdatePayload) => {
    editing.value = true
    const index = tables.value.findIndex(t => t.id === payload.id)
    if (index !== -1) {
        tables.value[index].x = payload.x
        tables.value[index].y = payload.y
    }
}

const saveLayout = () => {
    const layout: RestaurantLayout = { rooms: rooms.value, tables: tables.value } as RestaurantLayout

    if (props.event) {
        axios.SaveLayoutInEvent(layout, props.event.id)
    } else {
        axios.SaveLayout(layout)
    }
    editing.value = false
    snackbarStore.show("Salvataggio effettuato", 3000, 'bottom', 'success')
}

const getLayout = async () => {
    let layout
    if (props.event) {
        layout = await axios.GetWaiterLayout(props.event.id)
    } else {
        layout = await axios.GetLayout()
    }
    rooms.value = layout.rooms || []
    tables.value = layout.tables || []
    editing.value = false
}

const zoomIn = () => {
    zoomLevel.value = Math.min(2.0, zoomLevel.value + 0.05)
}

const zoomOut = () => {
    zoomLevel.value = Math.max(0.3, zoomLevel.value - 0.05)
}

onMounted(async () => {
    await getLayout()
    if (rooms.value.length) {
        activeRoomId.value = rooms.value[0].id
    }
})

defineExpose({
    getLayout
});
</script>

<template>
    <v-container fluid class="bg-grey-lighten-4 pa-0" style="height: calc(100vh - 64px) !important">
        <v-row no-gutters class="fill-height">
            <v-col cols="12" class="d-flex flex-column relative overflow-hidden fill-height">
                <v-toolbar density="compact" color="white" class="border-b pr-4" style="z-index: 10">
                    <v-btn-group class="ml-1" variant="text" v-if="props.editRoom">
                        <v-btn prepend-icon="mdi-plus" @click="openRoomDialog()">Stanza</v-btn>
                    </v-btn-group>

                    <div v-if="roomSelected && (smAndUp || !editing)" class="d-flex align-center"
                        style="width: 200px; padding-left: 10px;">
                        <v-icon icon="mdi-magnify-minus-outline" size="small" class="mr-2" @click="zoomOut"></v-icon>
                        <v-slider v-model="zoomLevel" :min="0.3" :max="2.0" :step="0.05" hide-details
                            density="compact"></v-slider>
                        <v-icon icon="mdi-magnify-plus-outline" size="small" class="ml-2" @click="zoomIn"></v-icon>
                        <span v-show="smAndUp" class="text-caption ml-2" style="width: 40px">{{ Math.round(zoomLevel *
                            100) }}%</span>
                    </div>

                    <v-spacer></v-spacer>
                    <v-btn variant="plain" prepend-icon="mdi-undo" v-if="editing" @click="getLayout">Annulla</v-btn>
                    <v-btn color="success" variant="elevated" prepend-icon="mdi-content-save" v-if="editing"
                        @click="saveLayout">Salva</v-btn>

                    <template v-slot:extension>
                        <RoomTabs v-model="activeRoomId" :editing="props.editRoom" :rooms="rooms"
                            @edit="openRoomDialog($event)" @delete="deleteConfirmDialog = true" />
                    </template>
                </v-toolbar>

                <RestaurantMap :room="currentRoom" :tables="tables" :zoom="zoomLevel"
                    :selected-table-id="selectedTableId" :editable="true" @click-table="onTableClick"
                    @update-table="onTableUpdate" />
            </v-col>
        </v-row>

        <v-fab @click="addTable()" v-if="roomSelected" text="Tavolo" prepend-icon="mdi-plus" location="bottom right" app
            extended appear style="position: fixed; right: 15px; bottom: 15px;"></v-fab>

        <RoomDialog v-model="roomDialog" :room="tempRoom" :is-editing="isEditingRoom" @save="onSaveRoom" />

        <TableDialog v-model="tableDialog" :table="tempTable" @save="onSaveTable" @delete="onDeleteTable" />

        <Confirm v-model="deleteConfirmDialog">
            <template v-slot:action>
                <v-btn text="Conferma" color="red" variant="plain" @click="deleteRoom"></v-btn>
            </template>
        </Confirm>
    </v-container>
</template>