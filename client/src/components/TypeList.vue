<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { type SubType, type Type } from '../../../models/src';
import { copy, requiredRule, icons } from '@/services/utils';
import Axios from '@/services/client'

const axios = new Axios()
const dialogType = ref<boolean>(null)
const confirmDelete = ref<boolean>(null)
const form = ref(null)
const types = ref<Type[]>([])
const subTypes = ref<SubType[]>([])
const selectedType = ref<Type | SubType>(null)

function openDialog(type?: Type | SubType) {
    selectedType.value = copy<Type | SubType>(type)
    dialogType.value = true
}

async function createType() {
    const { valid } = await form.value?.validate()
    if (valid) {
        if (selectedType.value.type_id) {
            await axios.CreateSubType(selectedType.value)
            await getSubTypes()
        }
        else {
            await axios.CreateType(selectedType.value)
            await getTypes()
        }
        dialogType.value = false
    }
}

async function editType() {
    const { valid } = await form.value?.validate()
    if (valid) {
        if (selectedType.value.type_id) {
            await axios.EditSubType(selectedType.value)
            await getSubTypes()
        }
        else {
            await axios.EditType(selectedType.value)
            await getTypes()
        }
        dialogType.value = false
    }
}

async function deleteTypeConfirm() {
    confirmDelete.value = true
}

async function deleteType() {
    if (selectedType.value.type_id) {
        await axios.DeleteSubType(selectedType.value.id)
        await getSubTypes()
    }
    else {
        await axios.DeleteType(selectedType.value.id)
        await getTypes()
    }
    confirmDelete.value = false
    dialogType.value = false
}

async function getTypes() {
    types.value = await axios.GetTypes()
}

async function getSubTypes() {
    subTypes.value = await axios.GetSubTypes()
}

onMounted(async () => {
    await getTypes()
    await getSubTypes()
})
</script>
<template>
    <div>
        <h4 style="margin: 10px; text-align: center;">Categorie</h4>
        <v-table density="compact">
            <thead>
                <tr>
                    <th class="text-left">
                        Nome
                    </th>
                    <th class="text-left">
                        Icona
                    </th>
                    <th class="text-left">
                        # Sotto-Categorie
                    </th>
                </tr>
            </thead>
            <tbody style="cursor: pointer;">
                <tr v-for="type in types" :key="type.id" @click="openDialog(type)">
                    <td>{{ type.name }}</td>
                    <td>
                        <v-icon>{{ type.icon }}</v-icon>
                    </td>
                    <td>{{ type.numProducts }}</td>
                </tr>
            </tbody>
        </v-table>
        <v-fab @click="openDialog({ name: '' } as Type)" icon="mdi-plus" absolute offset
            location="bottom right" style="margin-right: 10px;"></v-fab>
    </div>
    <div style="margin-bottom: 30px;" v-if="types.length">
        <h4 style="margin: 30px 10px 10px 10px; text-align: center;">Sotto-Categorie</h4>
        <v-table density="compact">
            <thead>
                <tr>
                    <th class="text-left">
                        Nome
                    </th>
                    <th class="text-left">
                        Icona
                    </th>
                    <th class="text-left">
                        Categoria
                    </th>
                    <th class="text-left">
                        # Prodotti
                    </th>
                </tr>
            </thead>
            <tbody style="cursor: pointer;">
                <tr v-for="subType in subTypes" :key="subType.id" @click="openDialog(subType)">
                    <td>{{ subType.name }}</td>
                    <td>
                        <v-icon>{{ subType.icon }}</v-icon>
                    </td>
                    <td>{{ subType.type }}</td>
                    <td>{{ subType.numProducts }}</td>
                </tr>
            </tbody>
        </v-table>
        <v-fab @click="openDialog({ name: '', isSub: true } as SubType)" icon="mdi-plus" absolute offset
            location="bottom right" style="margin-right: 10px;"></v-fab>
    </div>
    <v-dialog v-model="dialogType" width="380px">
        <v-card>
            <v-card-title v-if="selectedType.id">
                Modifica {{ (!selectedType.isSub || selectedType.type_id) ? 'Categoria' : 'Sotto-Categoria' }}
            </v-card-title>
            <v-card-title v-else>
                Crea Nuova {{ (!selectedType.isSub || selectedType.type_id) ? 'Categoria' : 'Sotto-Categoria' }}
            </v-card-title>
            <v-card-text>
                <v-form @submit.prevent ref="form">
                    <v-text-field label="Nome" :rules="[requiredRule]" v-model="selectedType.name"></v-text-field>
                    <v-select label="Categoria" :items="types" item-value="id" item-title="name" :rules="[requiredRule]"
                        v-if="selectedType.isSub || selectedType.type_id" v-model="selectedType.type_id"></v-select>
                    <v-select :append-inner-icon="selectedType.icon" label="Icona" :items="icons" v-model="selectedType.icon" :rules="[requiredRule]">
                        <template v-slot:item="{ props, item }">
                            <v-list-item v-bind="props" :title="item.raw">
                                <template v-slot:prepend>
                                    <v-icon>{{ item.raw }}</v-icon>
                                </template>
                            </v-list-item>
                        </template>
                    </v-select>
                </v-form>
            </v-card-text>
            <v-card-actions>
                <v-btn variant="plain" @click="dialogType = false">ANNULLA</v-btn>
                <v-btn v-if="selectedType.id && selectedType.numProducts === 0" variant="plain" @click="deleteTypeConfirm" color="red">ELIMINA</v-btn>
                <v-btn v-if="!selectedType.id" variant="plain" @click="createType">CONFERMA</v-btn>
                <v-btn v-else variant="plain" @click="editType">CONFERMA</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
    <Confirm v-model="confirmDelete">
        <template v-slot:action>
            <v-btn text="Conferma" variant="plain" @click="deleteType"></v-btn>
        </template>
    </Confirm>
</template>
