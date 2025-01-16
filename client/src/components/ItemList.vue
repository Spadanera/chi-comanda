<script setup lang="ts">
const props = defineProps(['subheader', 'done', 'delete', 'quantitybefore', 'showtype', 'shownote'])
const items = defineModel({ default: [] })
</script>

<template>
    <v-list>
        <v-list-subheader v-if="subheader">{{ subheader }}</v-list-subheader>
        <template v-for="(item, i) in items">
            <v-list-subheader v-if="props.showtype && i === 0">{{ item.sub_type }}</v-list-subheader>
            <v-list-item :lines="item.note ? 'two' : 'one'" density="compact">
                <v-list-item-title>
                    <span :class="{ done: done && item.sub_type !== 'Sconto' }">{{ item.name }}</span>
                </v-list-item-title>
                <v-list-item-subtitle v-if="item.sub_type !== 'Sconto' && !props.showtype">
                    <span :class="{ done: done }"><span v-if="item.type">{{ item.type }} - </span>{{ item.sub_type }}</span>
                </v-list-item-subtitle>
                <v-list-item-subtitle v-if="props.shownote && item.note" style="font-weight: bold; font-size: 400; color: red; opacity: 1; line-clamp: none;">
                    <span :class="{ done: done }">{{ item.note }}</span>
                </v-list-item-subtitle>
                <v-list-item-subtitle v-if="item.sub_type === 'Sconto'">
                    {{ item.price * -1 }} €
                </v-list-item-subtitle>
                <template v-slot:prepend>
                    <v-btn min-width="12" variant="plain" v-if="quantitybefore" :class="{ done: done }">{{ item.quantity
                        }}</v-btn>
                    <v-icon :icon="item.icon"></v-icon>
                </template>
                <template v-slot:append>
                    <slot :item="item" name="prequantity"></slot>
                    <span v-if="!quantitybefore" :class="{ done: done }">{{ item.quantity }}</span>
                    <slot :item="item" name="postquantity"></slot>
                </template>
            </v-list-item>
            <v-list-subheader
                v-if="props.showtype && i < (items.length - 1) && item.sub_type !== items[i + 1].sub_type">{{ items[i + 1].sub_type }}</v-list-subheader>
        </template>
    </v-list>
</template>