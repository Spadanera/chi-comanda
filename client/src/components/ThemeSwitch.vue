<script setup lang="ts">
import { ThemeStore, type ThemePreference } from '@/stores'

defineProps<{ labels?: boolean }>()
const themeStore = ThemeStore()

const options: { value: ThemePreference, icon: string, title: string }[] = [
    { value: 'light', icon: 'mdi-weather-sunny', title: 'Chiaro' },
    { value: 'dark', icon: 'mdi-weather-night', title: 'Scuro' },
    { value: 'auto', icon: 'mdi-theme-light-dark', title: 'Automatico' },
]
</script>

<template>
    <v-btn-toggle :model-value="themeStore.preference" @update:model-value="themeStore.setPreference" mandatory
        density="compact" variant="outlined" divided color="primary" aria-label="Tema">
        <v-btn v-for="option in options" :key="option.value" :value="option.value" :icon="!labels"
            :prepend-icon="labels ? option.icon : undefined" :title="option.title" :aria-label="option.title" size="small">
            <v-icon v-if="!labels" :icon="option.icon"></v-icon>
            <template v-else>{{ option.title }}</template>
        </v-btn>
    </v-btn-toggle>
</template>
