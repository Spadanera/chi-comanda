<script setup lang="ts">
import { type Audit } from "../../../../models/src";
import { onMounted, ref } from 'vue';
import Axios from '@/services/client'

const axios = new Axios()

const itemsPerPage = ref<number>(25)
const totalItems = ref<number>(0)
const loading = ref<boolean>(false)
const serverItems = ref<Audit[]>([])
const search = ref<string>('')

const headers = [
    { title: 'Utente', key: 'username' },
    { title: 'Metodo', key: 'method' },
    { title: 'Percorso', key: 'path' },
    { title: 'Date e Ora', key: 'dateTime' },
    { title: 'Dati', key: 'data' },
]

async function loadItems(input: { page: number, itemsPerPage: number, sortBy: { key: string, order: 'asc' | 'desc' }[] }) {
    if (!input.sortBy.length) {
        input.sortBy.push({
            key: 'dateTime',
            order: 'desc'
        })
    }
    loading.value = true
    const result = await axios.GetAudit(input.page, input.itemsPerPage, input.sortBy[0].key, input.sortBy[0].order)
    serverItems.value = result.data
    totalItems.value = result.totalCount
    loading.value = false
}

function formatTimestamp(timestamp: string) {
    const date = new Date(timestamp);

    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2)
    const day = ('0' + date.getDate()).slice(-2)
    const hours = ('0' + date.getHours()).slice(-2)
    const minutes = ('0' + date.getMinutes()).slice(-2)
    const seconds = ('0' + date.getSeconds()).slice(-2)

    const formattedDateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    return formattedDateTime;
}

onMounted(() => {
})
</script>
<template>
    <v-data-table-server class="audit-page" v-model:items-per-page="itemsPerPage" :headers="headers"
        :items="serverItems" :items-length="totalItems" :loading="loading" :search="search" item-value="name"
        @update:options="loadItems" fixed-header fixed-footer height="100%">
        <template v-slot:item.dateTime="{ item }">
            {{ formatTimestamp(item.dateTime) }}
        </template>
        <template v-slot:item.data="{ item }">
            <div class="text-truncate" style="max-width: 300px;">
                {{ item.data }}
            </div>
        </template>
    </v-data-table-server>
</template>
