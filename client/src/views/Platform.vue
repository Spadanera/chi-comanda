<script setup lang="ts">
import { onMounted, ref } from 'vue'
import api from '@/services/client'
import { requiredRule } from '@/services/utils'
import { SnackbarStore, UserStore } from '@/stores'
import type { Feature, User, VenueSummary } from '../../../models/src'

/** The installation's venues and every account, for the platform's superuser. */

const FEATURE_LABELS: Record<Feature, string> = {
    'payments': 'Pagamenti elettronici',
    'push': 'Notifiche push',
    'google-login': 'Accesso con Google',
    'broadcast': 'Messaggi allo staff',
    'minimum-consumption': 'Consumazione minima',
    'premium': 'Cocktail PREMIUM',
}
/** Google login is the installation's: it comes before choosing a venue. */
const ALL_FEATURES = (Object.keys(FEATURE_LABELS) as Feature[]).filter(f => f !== 'google-login')

const snackbarStore = SnackbarStore()
const userStore = UserStore()
const tab = ref('venues')
const venues = ref<VenueSummary[]>([])
const users = ref<User[]>([])

const dialog = ref(false)
const form = ref()
const editing = ref<VenueSummary | null>(null)
const name = ref('')
const adminEmail = ref('')
/** Every function of the installation, or only the chosen ones. */
const allFeatures = ref(true)
const features = ref<Feature[]>([])

async function load() {
    [venues.value, users.value] = await Promise.all([api.GetVenues(), api.GetPlatformUsers()])
}

function openDialog(venue?: VenueSummary) {
    editing.value = venue || null
    name.value = venue?.name || ''
    adminEmail.value = ''
    allFeatures.value = !venue?.features
    features.value = venue?.features ? [...venue.features] : [...ALL_FEATURES]
    dialog.value = true
}

async function save() {
    const { valid } = await form.value?.validate()
    if (!valid) return
    const chosen = allFeatures.value ? null : features.value
    if (editing.value) {
        await api.UpdateVenue(editing.value.id, { name: name.value, features: chosen })
    } else {
        await api.CreateVenue({ name: name.value, features: chosen, admin_email: adminEmail.value || undefined })
        snackbarStore.show(adminEmail.value ? 'Locale creato, invito inviato' : 'Locale creato', 3000, 'bottom', 'success')
    }
    dialog.value = false
    await load()
    // The superuser can enter the new venue right away
    await userStore.checkAuthentication()
}

async function toggleVenue(venue: VenueSummary) {
    await api.UpdateVenue(venue.id, { status: venue.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' })
    await load()
    await userStore.checkAuthentication()
}

async function toggleBlocked(user: User) {
    await api.SetUserStatus(user.id!, user.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE')
    await load()
}

async function toggleSuperuser(user: User) {
    await api.SetSuperuser(user.id!, !user.superuser)
    await load()
}

onMounted(load)
</script>

<template>
    <v-container>
        <v-tabs v-model="tab">
            <v-tab value="venues">Locali</v-tab>
            <v-tab value="users">Utenti</v-tab>
        </v-tabs>

        <v-window v-model="tab" class="mt-4">
            <v-window-item value="venues">
                <v-btn prepend-icon="mdi-plus" @click="openDialog()" class="mb-4">Nuovo locale</v-btn>
                <v-list>
                    <v-list-item v-for="venue in venues" :key="venue.id" @click="openDialog(venue)"
                        :title="venue.name" :subtitle="`${venue.members} persone · ${venue.features ? venue.features.map(f => FEATURE_LABELS[f]).join(', ') || 'nessuna funzione' : 'tutte le funzioni'}`">
                        <template v-slot:append>
                            <v-switch hide-details color="primary" :model-value="venue.status === 'ACTIVE'"
                                :label="venue.status === 'ACTIVE' ? 'Attivo' : 'Disattivato'" @click.stop="toggleVenue(venue)"></v-switch>
                        </template>
                    </v-list-item>
                </v-list>
            </v-window-item>

            <v-window-item value="users">
                <v-list>
                    <v-list-item v-for="user in users" :key="user.id" :title="user.username || user.email"
                        :subtitle="user.venues?.map(v => `${v.name}: ${v.roles.join(', ')}`).join(' · ') || (user.status ? 'nessun locale' : 'invito in attesa')">
                        <template v-slot:append>
                            <v-switch hide-details color="primary" class="mr-4" label="Superuser" :model-value="!!user.superuser"
                                :disabled="user.id === userStore.user.id" @click.stop="toggleSuperuser(user)"></v-switch>
                            <v-switch v-if="user.status" hide-details color="primary" label="Attivo" :model-value="user.status === 'ACTIVE'"
                                :disabled="user.id === userStore.user.id" @click.stop="toggleBlocked(user)"></v-switch>
                        </template>
                    </v-list-item>
                </v-list>
            </v-window-item>
        </v-window>

        <v-dialog v-model="dialog" max-width="500">
            <v-card :title="editing ? 'Modifica locale' : 'Nuovo locale'">
                <v-card-text>
                    <v-form ref="form">
                        <v-text-field v-model="name" label="Nome" :rules="[requiredRule]" counter="100"></v-text-field>
                        <v-text-field v-if="!editing" v-model="adminEmail" label="E-mail del primo admin (facoltativa)"
                            type="email"></v-text-field>
                        <v-switch v-model="allFeatures" color="primary" hide-details
                            label="Tutte le funzioni dell'installazione"></v-switch>
                        <template v-if="!allFeatures">
                            <v-checkbox v-for="feature in ALL_FEATURES" :key="feature" v-model="features" :value="feature"
                                :label="FEATURE_LABELS[feature]" hide-details density="compact"></v-checkbox>
                        </template>
                    </v-form>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn variant="plain" @click="dialog = false">ANNULLA</v-btn>
                    <v-btn variant="plain" @click="save()">SALVA</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-container>
</template>
