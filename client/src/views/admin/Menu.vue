<script setup lang="ts">
import MenuList from '@/components/MenuList.vue';
import TypeList from '@/components/TypeList.vue';
import { onMounted, ref } from 'vue';

const tab = ref<string>(null)

onMounted(() => {
})
</script>
<template>
    <v-tabs v-model="tab" grow>
        <v-tab value="MENU">Menu</v-tab>
        <v-tab value="TYPES">Categorie</v-tab>
    </v-tabs>
    <v-tabs-window v-model="tab">
        <v-tabs-window-item value="MENU">
            <MenuList></MenuList>
        </v-tabs-window-item>
        <v-tabs-window-item value="TYPES">
            <TypeList></TypeList>
        </v-tabs-window-item>
    </v-tabs-window>
</template>
