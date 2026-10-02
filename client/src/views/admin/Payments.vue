<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { type PaymentSetting } from '../../../../models/src'
import Axios from '@/services/client'
import { SnackbarStore } from '@/stores'

const axios = new Axios()
const snackbarStore = SnackbarStore()

// ── Definizione statica dei provider disponibili ────────────────────────────

interface ProviderDef {
    key: string
    label: string
    icon: string
    description: string
    fields: FieldDef[]
}

interface FieldDef {
    key: string
    label: string
    hint: string
    type?: 'text' | 'password' | 'select'
    options?: string[]
    required?: boolean
}

const PROVIDERS: ProviderDef[] = [
    {
        key: 'sumup_checkout',
        label: 'SumUp Checkout (link / QR)',
        icon: 'mdi-qrcode',
        description: 'Genera un link di pagamento che il cliente può aprire dal proprio telefono. Funziona su qualsiasi dispositivo, senza hardware aggiuntivo.',
        fields: [
            { key: 'api_key', label: 'Personal API Key', hint: 'Generala dal portale SumUp → Sviluppatori', type: 'password', required: true },
            { key: 'currency', label: 'Valuta', hint: '', type: 'select', options: ['EUR', 'USD', 'GBP', 'CHF'] }
        ]
    },
    {
        key: 'sumup_pos',
        label: 'SumUp POS (App su tablet)',
        icon: 'mdi-cellphone-nfc',
        description: 'Apre l\'app SumUp sul tablet di cassa con l\'importo precompilato. Il cliente paga sul lettore Air/3 collegato via Bluetooth. Richiede l\'app SumUp installata sul tablet.',
        fields: [
            { key: 'affiliate_key', label: 'Affiliate Key', hint: 'La tua Personal API Key di SumUp usata come affiliate key', type: 'password', required: true },
            { key: 'server_url', label: 'URL pubblico del server', hint: 'Es: https://my-restaurant.railway.app — serve per ricevere il callback dopo il pagamento', required: true },
            { key: 'currency', label: 'Valuta', hint: '', type: 'select', options: ['EUR', 'USD', 'GBP', 'CHF'] }
        ]
    },
    {
        key: 'sumup_solo',
        label: 'SumUp Solo (terminale standalone)',
        icon: 'mdi-credit-card-wireless-outline',
        description: 'Invia il pagamento direttamente al terminale SumUp Solo via API. Il cliente paga inserendo o avvicinando la carta. Richiede accesso al programma partner SumUp POS.',
        fields: [
            { key: 'api_key', label: 'API Key', hint: 'La tua Personal API Key di SumUp', type: 'password', required: true },
            { key: 'reader_code', label: 'Codice reader / Device ID', hint: 'Visibile nel portale SumUp → Il mio account → Dispositivi', required: true },
            { key: 'currency', label: 'Valuta', hint: '', type: 'select', options: ['EUR', 'USD', 'GBP', 'CHF'] }
        ]
    }
]

// ── State ───────────────────────────────────────────────────────────────────

const settings = ref<PaymentSetting[]>([])
const dialog = ref(false)
const activeProviderDef = ref<ProviderDef | null>(null)
const editingConfig = ref<Record<string, string>>({})
const editingEnabled = ref(true)
const showPasswordFields = ref<Record<string, boolean>>({})
const saving = ref(false)

// ── Helpers ─────────────────────────────────────────────────────────────────

function getSettingFor(providerKey: string): PaymentSetting | undefined {
    return settings.value.find(s => s.provider === providerKey)
}

function openDialog(def: ProviderDef) {
    activeProviderDef.value = def
    const existing = getSettingFor(def.key)
    editingEnabled.value = existing?.enabled ?? true
    // Non ripopolare i campi password con valori precedenti (sicurezza)
    editingConfig.value = { currency: 'EUR' }
    showPasswordFields.value = {}
    dialog.value = true
}

async function saveSettings() {
    if (!activeProviderDef.value) return
    saving.value = true
    try {
        // Non sovrascrivere l'api_key se il campo è rimasto vuoto (modifica parziale)
        const configToSave: Record<string, string> = {}
        for (const field of activeProviderDef.value.fields) {
            const val = editingConfig.value[field.key]
            if (val && val.trim()) {
                configToSave[field.key] = val.trim()
            }
        }

        await axios.SavePaymentSettings({
            provider: activeProviderDef.value.key,
            enabled: editingEnabled.value,
            config: configToSave
        } as PaymentSetting)

        snackbarStore.show('Impostazioni salvate', 3000, 'top', 'success')
        await loadSettings()
        dialog.value = false
    } catch {
        snackbarStore.show('Errore nel salvataggio', 3000, 'top', 'error')
    } finally {
        saving.value = false
    }
}

async function toggleEnabled(setting: PaymentSetting) {
    try {
        await axios.SavePaymentSettings({ ...setting, config: {} })
        await loadSettings()
        snackbarStore.show(
            setting.enabled ? 'Provider abilitato' : 'Provider disabilitato',
            2000, 'top', 'success'
        )
    } catch {
        snackbarStore.show('Errore nell\'aggiornamento', 3000, 'top', 'error')
        await loadSettings()
    }
}

async function loadSettings() {
    settings.value = await axios.GetPaymentSettings()
}

onMounted(loadSettings)
</script>

<template>
    <v-container>
        <v-row>
            <v-col>
                <h2 class="text-h5 mb-1">Metodi di Pagamento Elettronico</h2>
                <p class="text-body-2 text-medium-emphasis mb-4">
                    Configura i provider attivi. Ogni provider può essere abilitato o disabilitato
                    indipendentemente; il cassiere potrà scegliere tra quelli attivi al momento del pagamento.
                </p>
            </v-col>
        </v-row>

        <v-row>
            <v-col v-for="def in PROVIDERS" :key="def.key" cols="12" md="4">
                <v-card height="100%" class="d-flex flex-column">
                    <v-card-title class="d-flex align-center pt-4">
                        <v-icon :icon="def.icon" class="mr-2" size="22" />
                        {{ def.label }}
                    </v-card-title>

                    <v-card-text class="flex-grow-1">
                        <p class="text-body-2 text-medium-emphasis mb-3">{{ def.description }}</p>

                        <div class="d-flex align-center gap-2">
                            <template v-if="getSettingFor(def.key)">
                                <v-chip
                                    size="small"
                                    variant="tonal"
                                    :color="getSettingFor(def.key)!.enabled ? 'success' : 'default'"
                                >
                                    {{ getSettingFor(def.key)!.enabled ? 'Attivo' : 'Disattivato' }}
                                </v-chip>
                                <v-chip size="small" variant="tonal" :color="getSettingFor(def.key)!.configured ? 'primary' : 'warning'">
                                    <v-icon :icon="getSettingFor(def.key)!.configured ? 'mdi-check' : 'mdi-alert'" size="14" class="mr-1" />
                                    {{ getSettingFor(def.key)!.configured ? 'Configurato' : 'Incompleto' }}
                                </v-chip>
                            </template>
                            <v-chip v-else size="small" variant="tonal" color="default">
                                Non configurato
                            </v-chip>
                        </div>
                    </v-card-text>

                    <v-card-actions>
                        <v-btn
                            v-if="getSettingFor(def.key)"
                            variant="plain"
                            size="small"
                            :color="getSettingFor(def.key)!.enabled ? 'error' : 'success'"
                            @click="() => {
                                const s = getSettingFor(def.key)!
                                s.enabled = !s.enabled
                                toggleEnabled(s)
                            }"
                        >
                            {{ getSettingFor(def.key)!.enabled ? 'Disabilita' : 'Abilita' }}
                        </v-btn>
                        <v-spacer />
                        <v-btn variant="plain" size="small" @click="openDialog(def)">
                            {{ getSettingFor(def.key) ? 'Modifica' : 'Configura' }}
                        </v-btn>
                    </v-card-actions>
                </v-card>
            </v-col>
        </v-row>

        <!-- Dialog configurazione -->
        <v-dialog v-model="dialog" max-width="520">
            <v-card v-if="activeProviderDef">
                <v-card-title class="d-flex align-center pt-4">
                    <v-icon :icon="activeProviderDef.icon" class="mr-2" />
                    Configura {{ activeProviderDef.label }}
                </v-card-title>

                <v-card-text>
                    <v-switch
                        v-model="editingEnabled"
                        label="Abilitato"
                        color="success"
                        inset
                        hide-details
                        class="mb-4"
                    />

                    <v-alert
                        v-if="getSettingFor(activeProviderDef.key)?.configured"
                        type="info"
                        variant="tonal"
                        density="compact"
                        class="mb-4 text-body-2"
                    >
                        I campi password sono nascosti per sicurezza. Lasciare vuoti i campi che non si vuole modificare.
                    </v-alert>

                    <template v-for="field in activeProviderDef.fields" :key="field.key">
                        <!-- Select -->
                        <v-select
                            v-if="field.type === 'select'"
                            v-model="editingConfig[field.key]"
                            :items="field.options"
                            :label="field.label"
                            :hint="field.hint"
                            persistent-hint
                            class="mb-3"
                        />
                        <!-- Password -->
                        <v-text-field
                            v-else-if="field.type === 'password'"
                            v-model="editingConfig[field.key]"
                            :label="field.label"
                            :type="showPasswordFields[field.key] ? 'text' : 'password'"
                            :append-inner-icon="showPasswordFields[field.key] ? 'mdi-eye-off' : 'mdi-eye'"
                            :hint="field.hint"
                            persistent-hint
                            class="mb-3"
                            @click:append-inner="showPasswordFields[field.key] = !showPasswordFields[field.key]"
                        />
                        <!-- Text -->
                        <v-text-field
                            v-else
                            v-model="editingConfig[field.key]"
                            :label="field.label"
                            :hint="field.hint"
                            persistent-hint
                            class="mb-3"
                        />
                    </template>
                </v-card-text>

                <v-card-actions>
                    <v-btn variant="plain" @click="dialog = false">Annulla</v-btn>
                    <v-spacer />
                    <v-btn variant="plain" color="primary" :loading="saving" @click="saveSettings">
                        Salva
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-container>
</template>
