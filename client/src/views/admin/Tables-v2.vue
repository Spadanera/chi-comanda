<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import type { MasterTable, RestaurantLayout, Room, TableUpdatePayload } from '../../../../models/src'
import RestaurantMap from '../../components/RestaurantMap.vue'
import Axios from '@/services/client'
import { SnackbarStore } from '@/stores'

const axios = new Axios()
const snackbarStore = SnackbarStore()

// --- DATA ---
const rooms = ref<Room[]>([])

const tables = ref<MasterTable[]>([])

const editing = ref<boolean>(false)

const activeRoomId = ref<number>()
const selectedTableId = ref<number>(0)
const zoomLevel = ref(1)
const deleteConfirmDialog = ref(false)

// --- DIALOG STATE ---
const roomDialog = ref(false)
const isEditingRoom = ref(false)
const newTable = ref<MasterTable>(null)
const roomForm = reactive({ name: '', width: 10, height: 8 } as Room)

const tableDialog = ref(false)
const tableForm = reactive<MasterTable>({
    name: '', default_seats: 0, x: 0, y: 0, width: 0, height: 0, shape: 'rect'
} as MasterTable)

// --- COMPUTED ---
const currentRoom = computed(() => rooms.value.find(r => r.id === activeRoomId.value))
const roomTables = computed(() => tables.value.filter(t => t.room_id === activeRoomId.value))
const roomSelected = computed(() => activeRoomId.value && rooms.value.length)

// --- ROOM LOGIC ---
const openRoomDialog = (room?: Room) => {
    if (room) {
        isEditingRoom.value = true
        Object.assign(roomForm, room)
    } else {
        isEditingRoom.value = false
        roomForm.id = Date.now() * -1
        roomForm.name = ''
        roomForm.width = 10
        roomForm.height = 8
    }
    roomDialog.value = true
}

const saveRoom = () => {
    if (isEditingRoom.value) {
        const index = rooms.value.findIndex(r => r.id === roomForm.id)
        if (index !== -1) rooms.value[index] = { ...roomForm }
    } else {
        rooms.value.push({ ...roomForm })
        activeRoomId.value = roomForm.id
    }
    roomDialog.value = false
    editing.value = true
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

// --- TABLE LOGIC ---
const addTable = () => {
    editing.value = true
    if (!activeRoomId.value) return

    newTable.value = {
        id: Date.now() * -1,
        room_id: activeRoomId.value,
        name: `T${roomTables.value.length + 1}`,
        default_seats: 4,
        x: 50,
        y: 50,
        width: 100,
        height: 100,
        shape: 'rect',
        status: 'ACTIVE'
    } as MasterTable

    selectedTableId.value = newTable.value.id
    onTableClick(newTable.value)
}

const onTableClick = (table: MasterTable) => {
    selectedTableId.value = table.id
    Object.assign(tableForm, table)
    tableDialog.value = true
}

const onTableUpdate = (payload: TableUpdatePayload) => {
    editing.value = true
    const index = tables.value.findIndex(t => t.id === payload.id)
    if (index !== -1) {
        tables.value[index].x = payload.x
        tables.value[index].y = payload.y
    }
}

const saveTableConfig = () => {
    editing.value = true
    const index = tables.value.findIndex(t => t.id === tableForm.id)
    if (index !== -1) {
        tables.value[index] = { ...tableForm }
    }
    else {
        tables.value.push(newTable.value)
    }
    tableDialog.value = false
}

const deleteTable = () => {
    tables.value = tables.value.filter(t => t.id !== tableForm.id)
    tableDialog.value = false
    selectedTableId.value = null
    editing.value = true
}

const saveLayout = () => {
    axios.SaveLayout({ rooms: rooms.value, tables: tables.value } as RestaurantLayout)
    editing.value = false
    snackbarStore.show("Salvataggio effettuato", 3000, 'bottom', 'success')
}

const getLayout = async () => {
    const layout = await axios.GetLayout()
    Object.assign(rooms.value, layout.rooms)
    Object.assign(tables.value, layout.tables)
    editing.value = false
}

onMounted(async () => {
    await getLayout()
    if (rooms.value.length) {
        activeRoomId.value = rooms.value[0].id
    }
})
</script>

<template>
    <v-container fluid class="bg-grey-lighten-4 pa-0" style="height: calc(100vh - 64px) !important">
        <v-row no-gutters class="fill-height">
            <v-col cols="12" class="d-flex flex-column relative overflow-hidden fill-height">
                <v-toolbar density="compact" color="white" class="border-b pr-4" style="z-index: 10">
                    <v-btn-group class="ml-1" variant="text">
                        <v-btn prepend-icon="mdi-plus" @click="openRoomDialog()">Nuovo Stanza</v-btn>
                        <v-btn v-if="roomSelected" prepend-icon="mdi-plus" @click="addTable()">Nuovo Tavolo</v-btn>
                    </v-btn-group>

                    <div v-if="roomSelected" class="d-flex align-center" style="width: 200px">
                        <v-icon icon="mdi-magnify-minus-outline" size="small" class="mr-2"></v-icon>
                        <v-slider v-model="zoomLevel" :min="0.3" :max="2.0" :step="0.1" hide-details
                            density="compact"></v-slider>
                        <v-icon icon="mdi-magnify-plus-outline" size="small" class="ml-2"></v-icon>
                        <span class="text-caption ml-2" style="width: 40px">{{ Math.round(zoomLevel * 100) }}%</span>
                    </div>

                    <v-spacer></v-spacer>
                    <v-btn variant="plain" prepend-icon="mdi-undo" v-if="editing" @click="getLayout">Annulla</v-btn>
                    <v-btn color="success" variant="elevated" prepend-icon="mdi-content-save" v-if="editing"
                        @click="saveLayout">Salva</v-btn>

                    <template v-slot:extension>
                        <div class="d-flex align-center w-100">

                            <v-tabs v-model="activeRoomId" align-tabs="start" class="flex-grow-1">
                                <v-tab v-for="room in rooms" :key="room.id" :text="room.name" :value="room.id"></v-tab>
                            </v-tabs>

                            <div class="d-flex px-2 ga-2" v-if="roomSelected">
                                <v-btn icon="mdi-pencil" size="small" variant="text"
                                    @click="openRoomDialog(rooms.find(r => r.id === activeRoomId))"
                                    title="Modifica"></v-btn>
                                <v-btn icon="mdi-delete" size="small" variant="text" color="error"
                                    @click="deleteConfirmDialog = true" title="Elimina"></v-btn>
                            </div>

                        </div>
                    </template>
                </v-toolbar>

                <RestaurantMap :room="currentRoom" :tables="tables" :zoom="zoomLevel"
                    :selected-table-id="selectedTableId" :editable="true" @click-table="onTableClick"
                    @update-table="onTableUpdate" />
            </v-col>
        </v-row>

        <v-dialog v-model="roomDialog" max-width="400">
            <v-card>
                <v-card-title>{{ isEditingRoom ? 'Modifica Sala' : 'Nuova Sala' }}</v-card-title>
                <v-card-text>
                    <v-form @submit.prevent="saveRoom">
                        <v-text-field v-model="roomForm.name" label="Nome Sala" autofocus></v-text-field>
                        <v-row>
                            <v-col cols="6">
                                <v-text-field v-model.number="roomForm.width" type="number" suffix="m"
                                    label="Larghezza"></v-text-field>
                            </v-col>
                            <v-col cols="6">
                                <v-text-field v-model.number="roomForm.height" type="number" suffix="m"
                                    label="Altezza"></v-text-field>
                            </v-col>
                        </v-row>
                    </v-form>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn color="grey" variant="text" @click="roomDialog = false">Annulla</v-btn>
                    <v-btn color="primary" @click="saveRoom">Salva</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-dialog v-model="tableDialog" max-width="400">
            <v-card>
                <v-card-title>Configura Tavolo</v-card-title>
                <v-card-text>
                    <v-text-field v-model="tableForm.name" label="Etichetta"></v-text-field>
                    <v-text-field v-model.number="tableForm.default_seats" type="number" label="Posti"></v-text-field>
                    <v-row>
                        <v-col cols="6">
                            <v-text-field v-model.number="tableForm.width" type="number" suffix="cm"
                                label="Larghezza"></v-text-field>
                        </v-col>
                        <v-col cols="6">
                            <v-text-field v-model.number="tableForm.height" type="number" suffix="cm"
                                label="Altezza"></v-text-field>
                        </v-col>
                        <v-select label="Forma"
                            :items="[{ title: 'Rettangolare', value: 'rect' }, { title: 'Ovale', value: 'circle' }]"
                            v-model="tableForm.shape">

                        </v-select>
                    </v-row>
                </v-card-text>
                <v-card-actions>
                    <v-btn color="error" variant="text" @click="deleteTable">Elimina</v-btn>
                    <v-spacer></v-spacer>
                    <v-btn color="grey" variant="text" @click="tableDialog = false">Annulla</v-btn>
                    <v-btn color="primary" @click="saveTableConfig">OK</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
        <Confirm v-model="deleteConfirmDialog">
            <template v-slot:action>
                <v-btn text="Conferma" color="red" variant="plain" @click="deleteRoom"></v-btn>
            </template>
        </Confirm>
    </v-container>
</template>