<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { type Menu } from '../../../models/src';
import { copy, requiredRule } from '@/services/utils';
import Axios from '@/services/client'
import { RouterLink } from 'vue-router';

const menu = ref<Menu[]>([])
const axios = new Axios()
const confirmDeleteMenu = ref<boolean>(false)
const selectedMenu = ref<Menu>(null)
const dialog = ref<boolean>(null)
const form = ref(null)
const copyFromOtherMenu = ref(null)

async function getMenu() {
    menu.value = await axios.GetAllMenu()
}

async function deleteMenuConfirm(menu: Menu) {
    selectedMenu.value = menu
    confirmDeleteMenu.value = true
}

async function deleteMenu() {
    await axios.DeleteMenu(selectedMenu.value.id)
    await getMenu()
    confirmDeleteMenu.value = false
}

async function createMenu() {
    const { valid } = await form.value?.validate()
    if (valid) {
        await axios.CreateMenu(selectedMenu.value)
        await getMenu()
        dialog.value = false
    }
}

async function editMenu() {
    const { valid } = await form.value?.validate()
    if (valid) {
        await axios.EditMenu(selectedMenu.value)
        await getMenu()
        dialog.value = false
    }
}

function openDialog(menu?: Menu) {
    copyFromOtherMenu.value = false
    if (menu) {
        selectedMenu.value = copy<Menu>(menu)
    }
    else {
        selectedMenu.value = {
            status: 'ACTIVE'
        } as Menu
    }
    dialog.value = true
}

onMounted(async () => {
    await getMenu()
})
</script>
<template>
    <v-container>
        <v-row>
            <v-col v-for="m in menu" sm="6" cols="12" lg="4">
                <v-card :title="m.name">
                    <v-card-subtitle v-if="m.canDelete > 0">
                        Sono presenti eventi attivi o pianificati collegati a questo menu
                    </v-card-subtitle>
                    <v-card-actions>
                        <v-btn @click="deleteMenuConfirm(m)" :readonly="m.canDelete > 0" :disabled="m.canDelete > 0" color="red"
                            text="ELIMINA" variant="plain"></v-btn>
                        <v-btn text="MODIFICA" @click="openDialog(m)" variant="plain"></v-btn>
                        <RouterLink :to="`items/${m.id}/${m.name}`">
                            <v-btn text="ESPLORA" variant="plain"></v-btn>
                        </RouterLink>
                    </v-card-actions>
                </v-card>
            </v-col>
        </v-row>
    </v-container>
    <v-fab @click="openDialog()" icon="mdi-plus" app style="position: fixed; right: 15px; bottom: 15px;"
        location="bottom right"></v-fab>
    <v-dialog v-model="dialog" width="380px">
        <v-card>
            <v-card-title v-if="selectedMenu.id">
                Modifica Menu
            </v-card-title>
            <v-card-title v-else>
                Crea nuovo Menu
            </v-card-title>
            <v-card-text>
                <v-form @submit.prevent ref="form">
                    <v-text-field label="Nome" :rules="[requiredRule]" v-model="selectedMenu.name"></v-text-field>
                    <v-row v-if="!selectedMenu.id">
                        <v-col>
                            <v-switch color="green" label="Copia da un altro menu" v-model="copyFromOtherMenu"
                                :rules="[]"></v-switch>
                        </v-col>
                    </v-row>
                    <v-select v-if="copyFromOtherMenu" label="Menu" :items="menu" v-model="selectedMenu.from_id" item-value="id" item-title="name" :rules="[requiredRule]"></v-select>
                </v-form>
            </v-card-text>
            <v-card-actions>
                <v-btn variant="plain" @click="dialog = false">ANNULLA</v-btn>
                <v-btn v-if="!selectedMenu.id" variant="plain" @click="createMenu">CONFERMA</v-btn>
                <v-btn v-else variant="plain" @click="editMenu">CONFERMA</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
    <Confirm v-model="confirmDeleteMenu">
        <template v-slot:action>
            <v-btn text="Conferma" variant="plain" @click="deleteMenu"></v-btn>
        </template>
    </Confirm>
</template>
