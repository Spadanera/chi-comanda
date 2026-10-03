<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import router from '@/router'
import api from '@/services/client'
import { UserStore } from '@/stores'
import { roleLabels } from '@/services/utils'

const emit = defineEmits(['reload'])
const route = useRoute()
const userStore = UserStore()
const venues = computed(() => userStore.user.venues)

async function choose(venueId: number) {
    if (venueId !== userStore.user.venueId) {
        await api.SwitchVenue(venueId)
    }
    // App reloads the ongoing event of the venue
    emit('reload')
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : '/'
    router.push(redirect)
}
</script>

<template>
    <v-container>
        <template v-if="venues.length">
            <h2 class="text-h6 mb-4">In quale locale lavori?</h2>
            <v-row>
                <v-col cols="12" md="4" v-for="venue in venues" :key="venue.id">
                    <v-card hover @click="choose(venue.id)" :color="venue.id === userStore.user.venueId ? 'primary' : undefined"
                        :variant="venue.id === userStore.user.venueId ? 'tonal' : 'elevated'">
                        <v-card-title>{{ venue.name }}</v-card-title>
                        <v-card-text v-if="venue.roles.length">{{ roleLabels(venue.roles) }}</v-card-text>
                    </v-card>
                </v-col>
            </v-row>
        </template>
        <v-alert v-else type="info" variant="tonal">
            Non lavori ancora in nessun locale: chiedi a chi gestisce il locale di invitarti.
        </v-alert>
        <div v-if="userStore.user.superuser" class="mt-6">
            <RouterLink to="/platform" style="text-decoration: none;">
                <v-btn variant="text" prepend-icon="mdi-domain">Piattaforma</v-btn>
            </RouterLink>
        </div>
    </v-container>
</template>
