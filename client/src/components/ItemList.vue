<script setup lang="ts">
import { getIcon } from "@/services/utils"
const props = defineProps(['subheader', 'done', 'delete', 'quantitybefore', 'showtype'])
const items = defineModel({ default: [] })
</script>

<template>
    <v-list>
        <v-list-subheader v-if="subheader">{{ subheader }}</v-list-subheader>
        <template v-for="(item, i) in items">
            <v-list-subheader v-if="props.showtype && i === 0">{{ item.sub_type }}</v-list-subheader>
            <v-list-item :lines="item.note ? 'three' : 'one'" density="compact">
                <v-list-item-title>
                    <span :class="{ done: done && item.sub_type !== 'Sconto' }">{{ item.name }}</span>
                </v-list-item-title>
                <v-list-item-subtitle v-if="item.sub_type !== 'Sconto'">
                    <span :class="{ done: done }">{{ item.type }} - {{ item.sub_type }}</span><br />
                    <span :class="{ done: done }" v-if="item.note">{{ item.note }}</span>
                </v-list-item-subtitle>
                <v-list-item-subtitle v-else>
                    {{ item.price * -1 }} €
                </v-list-item-subtitle>
                <template v-slot:prepend>
                    <v-btn min-width="12" variant="plain" v-if="quantitybefore" :class="{ done: done }">{{ item.quantity
                        }}</v-btn>
                    <v-icon :icon="getIcon(item.sub_type)"></v-icon>
                </template>
                <template v-slot:append>
                    <slot :item="item" name="prequantity"></slot>
                    <span v-if="!quantitybefore" :class="{ done: done }">{{ item.quantity }}</span>
                    <slot :item="item" name="postquantity"></slot>
                </template>
            </v-list-item>
            <v-list-subheader
                v-if="props.showtype && i < (items.length - 1) && item.sub_type !== items[i + 1].sub_type">{{ items[i
                    + 1].sub_type }}</v-list-subheader>
        </template>
    </v-list>
</template>