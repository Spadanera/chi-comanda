<script setup lang="ts">
import { type Audit, type User } from "../../../../models/src";
import { onMounted, ref } from 'vue';
import Axios from '@/services/client'
import Avatar from "@/components/Avatar.vue";

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

function formatJson(json: string) {
    try {
        return JSON.stringify(json, null, 2);
    } catch (error) {
        console.error("Invalid JSON:", error);
        return json;
    }
}

onMounted(() => {
})
</script>
<template>
    <v-data-table-server class="audit-page" v-model:items-per-page="itemsPerPage" :headers="headers"
        :items="serverItems" :items-length="totalItems" :loading="loading" :search="search" item.key="id"
        @update:options="loadItems" fixed-header fixed-footer height="100%" show-expand>
        <template v-slot:item.data-table-expand="{ internalItem, isExpanded, toggleExpand }">
            <v-btn :append-icon="isExpanded(internalItem) ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                :text="isExpanded(internalItem) ? 'Chiudi' : 'Maggiori informazioni'" class="text-none" color="medium-emphasis"
                size="small" variant="text" slim @click="toggleExpand(internalItem)"></v-btn>
        </template>

        <template v-slot:expanded-row="{ columns, item }">
            <tr>
                <td :colspan="columns.length" class="py-2">
                    <pre>{{ formatJson(item.data) }}</pre>
                </td>
            </tr>
        </template>
        <template v-slot:item.username="{ item }">
            <Avatar :user="{ id: item.user_id, username: item.username } as User" alt start size="small"></Avatar>
            {{ item.username }}
        </template>
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
