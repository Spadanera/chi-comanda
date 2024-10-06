<script setup lang="ts">
import { getIcon } from "@/services/utils"
const props = defineProps(['items', 'subheader'])
</script>

<template>
    <v-list>
        <v-list-subheader v-if="subheader">{{ subheader }}</v-list-subheader>
        <v-list-item :lines="item.note ? 'three' : 'one'" v-for="item in items"
            :title="item.name">
            <v-list-item-subtitle>
                {{ item.type }} - {{ item.sub_type }}<br />
                <span v-if="item.note">{{ item.note }}</span>
            </v-list-item-subtitle>
            <template v-slot:prepend>
                <v-icon :icon="getIcon(item.sub_type)"></v-icon>
            </template>
            <template v-slot:append>
                <slot :item="item" name="prequantity"></slot>
                <span>{{ item.quantity }}</span>
                <slot :item="item" name="postquantity"></slot>
            </template>
        </v-list-item>
    </v-list>
</template>
