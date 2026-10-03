<script setup lang="ts">
import MenuList from '@/components/MenuList.vue';
import TypeList from '@/components/TypeList.vue';
import { onMounted, ref } from 'vue';

const props = defineProps(['event'])

const tab = ref<string>('MENU')
const menuList = ref<InstanceType<typeof MenuList>>()

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
            <MenuList ref="menuList"></MenuList>
        </v-tabs-window-item>
        <v-tabs-window-item value="TYPES">
            <TypeList></TypeList>
        </v-tabs-window-item>
    </v-tabs-window>
    <!-- Outside the tab window, whose transitions clip fixed children; categories have their own buttons -->
    <v-fab class="fab-clear" v-if="tab === 'MENU'" @click="menuList?.openDialog()" icon="mdi-plus" app
        style="position: fixed; right: 15px; bottom: 15px;" location="bottom right"></v-fab>
</template>
