<script setup lang="ts">
import { computed } from 'vue'
import type { Room } from '../../../models/src'

const props = defineProps<{
    rooms: Room[]
    editing: boolean
    modelValue?: number
}>()

const emit = defineEmits<{
    (e: 'update:modelValue', value: number): void
    (e: 'edit', room: Room): void
    (e: 'delete'): void
}>()

const activeTab = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val!)
})

const currentRoom = computed(() => props.rooms.find(r => r.id === props.modelValue))
</script>

<template>
    <div class="d-flex align-center w-100">

        <v-tabs v-model="activeTab" align-tabs="start" class="flex-grow-1">
            <v-tab v-for="room in rooms" :key="room.id" :value="room.id">
                <v-badge v-if="room.activeTableCount" :content="room.activeTableCount" color="error" offset-y="-3"
                    offset-x="-10" class="small-badge">
                    {{ room.name }}
                </v-badge>

                <span v-else>{{ room.name }}</span>
            </v-tab>
        </v-tabs>

        <div class="d-flex px-2 ga-2" v-if="currentRoom && editing">
            <v-btn icon="mdi-pencil" size="small" variant="text" @click="emit('edit', currentRoom)"
                title="Modifica"></v-btn>
            <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="emit('delete')"
                title="Elimina"></v-btn>
        </div>

    </div>
</template>

<style scoped>
.small-badge :deep(.v-badge__badge) {
    transform: scale(0.8);
    transform-origin: center;
}
</style>