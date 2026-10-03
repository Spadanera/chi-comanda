<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useTheme } from 'vuetify'
import { type Settings } from '../../../../models/src'
import api from '@/services/client'
import { SnackbarStore } from '@/stores'
import { appConfig, DEFAULT_NAME, setConfig } from '@/composables/useConfig'
import { applyBrandColors, light } from '@/plugins/theme'
import logoLight from '@/assets/logo/maitre-light.svg'

const snackbarStore = SnackbarStore()
const theme = useTheme()

const COLOR_FIELDS = [
    { key: 'primary_color', label: 'Colore principale', fallback: light.colors!.primary! },
    { key: 'secondary_color', label: 'Colore secondario', fallback: light.colors!.secondary! },
] as const

const settings = ref<Settings>({ venue_name: null, primary_color: null, secondary_color: null, has_logo: false })
const logoFile = ref<File | File[] | null>(null)
const saving = ref(false)

/** Reads the public configuration again and applies it right away: name, logo, colours. */
async function refreshBranding() {
    setConfig(await api.GetPublicConfig())
    applyBrandColors(theme.themes.value, appConfig.value.colors)
}

async function save() {
    saving.value = true
    try {
        settings.value = await api.SaveSettings(settings.value)
        await refreshBranding()
        snackbarStore.show('Impostazioni salvate', 3000, 'top', 'success')
    } finally {
        saving.value = false
    }
}

async function uploadLogo() {
    const file = Array.isArray(logoFile.value) ? logoFile.value[0] : logoFile.value
    if (!file) return
    const formData = new FormData()
    formData.append('logo', file)
    // Only the logo: unsaved changes to name and colours stay in the form
    settings.value.has_logo = (await api.UploadLogo(formData)).has_logo
    logoFile.value = null
    await refreshBranding()
    snackbarStore.show('Logo aggiornato', 3000, 'top', 'success')
}

async function removeLogo() {
    settings.value.has_logo = (await api.DeleteLogo()).has_logo
    await refreshBranding()
    snackbarStore.show('Logo predefinito ripristinato', 3000, 'top', 'success')
}

onMounted(async () => {
    settings.value = await api.GetSettings()
})
</script>

<template>
    <v-container>
        <v-row>
            <v-col>
                <h2 class="text-h5 mb-1">Impostazioni del locale</h2>
                <p class="text-body-2 text-medium-emphasis mb-4">
                    Nome, logo e colori con cui l'app si presenta allo staff e ai clienti. I campi vuoti usano i valori
                    predefiniti di Chi Comanda.
                </p>
            </v-col>
        </v-row>
        <v-row>
            <v-col cols="12" md="6">
                <v-card title="Nome e colori">
                    <v-card-text>
                        <v-form @submit.prevent="save">
                            <v-text-field v-model="settings.venue_name" label="Nome del locale" counter="100"
                                :placeholder="DEFAULT_NAME" persistent-placeholder clearable></v-text-field>
                            <v-text-field v-for="field in COLOR_FIELDS" :key="field.key" v-model="settings[field.key]"
                                :label="field.label" :placeholder="field.fallback" persistent-placeholder clearable
                                hint="Formato #RRGGBB; vuoto = colore predefinito" persistent-hint class="mb-2">
                                <template v-slot:prepend-inner>
                                    <v-menu :close-on-content-click="false">
                                        <template v-slot:activator="{ props }">
                                            <div v-bind="props" class="swatch"
                                                :style="{ background: settings[field.key] || field.fallback }"></div>
                                        </template>
                                        <v-color-picker mode="hex" :modes="['hex']"
                                            :model-value="settings[field.key] || field.fallback"
                                            @update:model-value="(v: string) => settings[field.key] = v.slice(0, 7).toUpperCase()"></v-color-picker>
                                    </v-menu>
                                </template>
                            </v-text-field>
                        </v-form>
                    </v-card-text>
                    <v-card-actions>
                        <v-spacer></v-spacer>
                        <v-btn variant="plain" :loading="saving" @click="save">Salva</v-btn>
                    </v-card-actions>
                </v-card>
            </v-col>
            <v-col cols="12" md="6">
                <v-card title="Logo">
                    <v-card-text>
                        <div class="d-flex align-center ga-4 mb-4">
                            <img :src="appConfig.logo || logoLight" alt="Logo attuale" width="96" height="96"
                                class="logo-preview" />
                            <p class="text-body-2 text-medium-emphasis">
                                Usato nella barra in alto, nella pagina di accesso e come icona dell'app installata.
                                Meglio un'immagine quadrata (PNG o SVG); viene adattata a 512×512.
                            </p>
                        </div>
                        <v-file-input v-model="logoFile" label="Nuovo logo" accept="image/*" show-size
                            prepend-icon=""></v-file-input>
                    </v-card-text>
                    <v-card-actions>
                        <v-btn v-if="settings.has_logo" variant="plain" color="error" @click="removeLogo">
                            Usa il logo predefinito
                        </v-btn>
                        <v-spacer></v-spacer>
                        <v-btn variant="plain" :disabled="!logoFile" @click="uploadLogo">Carica</v-btn>
                    </v-card-actions>
                </v-card>
            </v-col>
        </v-row>
    </v-container>
</template>

<style scoped>
.swatch {
    width: 22px;
    height: 22px;
    border-radius: 4px;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    cursor: pointer;
}

.logo-preview {
    object-fit: contain;
    flex-shrink: 0;
}
</style>
