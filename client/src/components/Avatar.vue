<script setup lang="ts">
import type { User } from '../../../models/src';

const props = defineProps<{
    user: User,
    size?: string,
    alt?: boolean,
    start?: boolean
}>()
</script>

<template>
    <v-avatar :color="user.avatar ? 'default' : 'red'" :size="size" :start="start" v-if="user.username">
        <v-img v-if="user.avatar" :alt="user.username" :src="user.avatar"></v-img>
        <span v-else-if="user.username && alt">{{ user.username[0] }}</span>
    </v-avatar>
</template>