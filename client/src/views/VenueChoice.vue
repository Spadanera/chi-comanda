<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import router from '@/router'
import api from '@/services/client'
import { UserStore } from '@/stores'
import { roleLabels } from '@/services/utils'
import Confirm from '@/components/Confirm.vue'
import { venueQueue } from '@/services/outbox'

const emit = defineEmits(['reload'])
const route = useRoute()
const userStore = UserStore()
const venues = computed(() => userStore.user.venues)

/** Venue chosen while orders of the current one still wait to be sent. */
const leaving = ref<number>()
const confirmLeave = computed({
    get: () => leaving.value !== undefined,
    set: value => { if (!value) leaving.value = undefined },
})

async function choose(venueId: number, confirmed = false) {
    if (!confirmed && venueId !== userStore.user.venueId && venueQueue.value.length) {
        leaving.value = venueId
        return
    }
    leaving.value = undefined
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
        <Confirm v-model="confirmLeave"
            :text="`${venueQueue.length === 1 ? 'Un ordine di questo locale non è ancora partito' : `${venueQueue.length} ordini di questo locale non sono ancora partiti`}: restano su questo dispositivo e partiranno quando tornerai qui. Cambiare locale?`">
            <template v-slot:action>
                <v-btn text="Cambia" variant="plain" @click="choose(leaving!, true)"></v-btn>
            </template>
        </Confirm>
    </v-container>
</template>
