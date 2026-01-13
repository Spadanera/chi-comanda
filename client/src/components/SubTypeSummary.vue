<script setup lang="ts">
import { computed } from 'vue'
import { type Item, type SubType } from "../../../models/src"

const props = defineProps<{
    items: Item[]
    types: SubType[]
}>()

const counts = computed(() => {
    if (!props.items || !props.types) return []

    return props.types
        .filter(t => t.name !== 'Fuori Menu')
        .map(t => {
            const count = props.items.reduce((acc, item) =>
                acc + (item.sub_type === t.name ? 1 : 0), 0)
            return {
                count,
                icon: t.icon,
                name: t.name
            }
        })
        .filter(t => t.count > 0)
})
</script>

<template>
    <v-btn v-for="type in counts" :key="type.name" readonly size="x-small" density="compact"
        variant="plain">
        <v-icon start>{{ type.icon }}</v-icon>
        {{ type.count }}
    </v-btn>
</template>