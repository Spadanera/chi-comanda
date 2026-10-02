<script setup lang="ts">
import { onMounted } from 'vue';
import type { User } from '../../../models/src'
import api from '@/services/client'

const props = defineProps<{
    user: User,
    size?: string,
    alt?: boolean,
    start?: boolean
}>()

onMounted(async () => {
    props.user.avatar = await api.GetUserAvatar(props.user.id)
})
</script>

<template>
    <v-avatar :color="user.avatar ? 'default' : 'red'" :size="size" :start="start" v-if="user.username">
        <v-img v-if="user.avatar" :alt="user.username" :src="user.avatar"></v-img>
        <span v-else-if="user.username && alt">{{ user.username[0] }}</span>
    </v-avatar>
</template>