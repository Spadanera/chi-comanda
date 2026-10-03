<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue"
import { useDisplay } from 'vuetify'
import { type Table, type Item, type PaymentSetting, type PaymentTransaction } from "../../../models/src"
import api from '@/services/client'
import { SnackbarStore } from '@/stores'
import { copy, sortItem } from "@/services/utils"
import Confirm from "@/components/Confirm.vue"
import ItemList from "@/components/ItemList.vue"
import { useSocket, onResync } from "@/composables/useSocket"
import { isFeatureEnabled } from "@/composables/useConfig"

const props = defineProps(['event', 'navigation', 'roomid'])
const emit = defineEmits(['getTables', 'changeTableSheet', 'closeDrawer'])

const selectedTable = defineModel<Table[]>('selectedTable', { required: true })
const drawer = defineModel<boolean>('drawer', { required: true })

const { smAndDown } = useDisplay()
const snackbarStore = SnackbarStore()
const socket = useSocket()

// ── Stato base ──────────────────────────────────────────────────────────────

const confirm = ref(false)
const deleteItemId = ref(0)
const itemToBePaid = ref<number[]>([])
const discount = ref(false)
const realPaid = ref<number | null>(null)
const partialPaid = ref(false)
const dialogPay = ref(false)

// ── Stato pagamento elettronico ─────────────────────────────────────────────

const availableProviders = ref<PaymentSetting[]>([])
const selectedProvider = ref<string>('cash')
const activeTransaction = ref<PaymentTransaction | null>(null)
const posUrlScheme = ref<string | null>(null)
const paymentStatus = ref<'idle' | 'pending' | 'checking' | 'paid' | 'failed'>('idle')
const pollingInterval = ref<ReturnType<typeof setInterval> | null>(null)

// ── Computed ────────────────────────────────────────────────────────────────

const activeTable = computed(() => selectedTable.value[0] || { items: [] } as Table)

const computedSelectedTable = computed(() => {
    const result = copy<Table>(activeTable.value)
    const items = result.items || []
    return {
        ...result,
        itemsToDo: items.filter((i: Item) => !i.paid).sort(sortItem),
        itemsDone: items.filter((i: Item) => i.paid).sort(sortItem)
    }
})

const tableTotalOrder = computed(() => {
    const items = computedSelectedTable.value.items || []
    const isClosed = computedSelectedTable.value.status === 'CLOSED'
    return items.reduce((acc, i) => acc + ((i.paid && !isClosed) ? 0 : i.price), 0)
})

const itemToBePaidBill = computed(() => {
    const items = activeTable.value.items || []
    return items
        .filter(i => itemToBePaid.value.includes(i.id || 0))
        .reduce((acc, i) => acc + i.price, 0)
})

const currentTotalToPay = computed(() => partialPaid.value ? itemToBePaidBill.value : tableTotalOrder.value)

const effectiveAmount = computed(() =>
    discount.value && realPaid.value !== null ? realPaid.value : currentTotalToPay.value
)

const onGoing = computed(() => (activeTable.value.items || []).some(i => !i.done))

const tableNameStyle = computed(() => ({
    top: props.navigation ? '16px' : (props.roomid === -1 ? '125px' : '74px'),
    right: props.navigation ? '14px' : '25px'
}))

const bottomBarStyle = computed(() => ({
    width: props.navigation || smAndDown.value ? '100%' : 'calc(100% - 255px)'
}))

const discounts = computed(() => {
    const base = currentTotalToPay.value
    return [
        { label: "10%", amount: Math.round(base * 0.9) },
        { label: "15%", amount: Math.round(base * 0.85) },
        { label: "20%", amount: Math.round(base * 0.8) },
        { label: "30%", amount: Math.round(base * 0.7) },
        { label: "50%", amount: Math.round(base * 0.5) }
    ]
})

// Mappa provider → etichetta e icona per i pulsanti di selezione
const PROVIDER_META: Record<string, { label: string; icon: string; color: string }> = {
    cash: { label: 'Contanti', icon: 'mdi-cash', color: 'default' },
    sumup_checkout: { label: 'Link (SumUp)', icon: 'mdi-qrcode', color: 'primary' },
    sumup_pos: { label: 'App SumUp', icon: 'mdi-cellphone-nfc', color: 'primary' },
    sumup_solo: { label: 'Solo (SumUp)', icon: 'mdi-credit-card-wireless-outline', color: 'primary' }
}

const paymentButtons = computed(() => {
    const btns = [{ key: 'cash', ...PROVIDER_META['cash'] }]
    for (const p of availableProviders.value) {
        const meta = PROVIDER_META[p.provider]
        if (meta) btns.push({ key: p.provider, ...meta })
    }
    return btns
})

// ── Azioni base ─────────────────────────────────────────────────────────────

const rollbackItem = async (item: Item) => {
    item.paid = false
    await api.UpdateItem(item, activeTable.value.paid)
    emit('getTables', item.table_id)
}

const deleteItemConfirm = (item_id: number) => {
    deleteItemId.value = item_id
    confirm.value = true
}

const deleteItem = async () => {
    await api.DeleteItem(deleteItemId.value)
    emit('getTables', activeTable.value.table_id || activeTable.value.id)
    confirm.value = false
}

const handleDiscount = async () => {
    if (discount.value && realPaid.value) {
        const discountAmount = currentTotalToPay.value - realPaid.value
        await api.InsertDiscount(props.event.id, activeTable.value.table_id || activeTable.value.id, discountAmount)
    }
}

const completeTable = async () => {
    await handleDiscount()
    await api.CompleteTable(activeTable.value.table_id || activeTable.value.id)
    emit('getTables', 0)
    snackbarStore.show("Tavolo chiuso", 3000, 'bottom', 'success')
    dialogPay.value = false
}

const paySelectedItem = async () => {
    await handleDiscount()
    await api.PaySelectedItem(activeTable.value.table_id || activeTable.value.id, itemToBePaid.value)
    emit('getTables', activeTable.value.table_id || activeTable.value.id)
    itemToBePaid.value = []
    dialogPay.value = false
}

const pay = (partial: boolean) => {
    partialPaid.value = partial
    discount.value = false
    realPaid.value = currentTotalToPay.value
    selectedProvider.value = 'cash'
    resetPaymentState()
    dialogPay.value = true
}

const closeDrawer = () => {
    drawer.value = !drawer.value
    emit('closeDrawer')
}

// ── Pagamento elettronico ────────────────────────────────────────────────────

function resetPaymentState() {
    stopPolling()
    activeTransaction.value = null
    posUrlScheme.value = null
    paymentStatus.value = 'idle'
}

function stopPolling() {
    if (pollingInterval.value) {
        clearInterval(pollingInterval.value)
        pollingInterval.value = null
    }
}

function closePayDialog() {
    resetPaymentState()
    dialogPay.value = false
}

function buildPayload() {
    const table_id = activeTable.value.table_id || activeTable.value.id
    const description = `Tavolo ${activeTable.value.name || activeTable.value.table_name || table_id}`
    return {
        table_id: table_id!,
        event_id: props.event.id,
        amount: effectiveAmount.value,
        item_ids: partialPaid.value ? itemToBePaid.value : [],
        description
    }
}

async function startElectronicPayment() {
    paymentStatus.value = 'pending'
    try {
        const payload = buildPayload()

        if (selectedProvider.value === 'sumup_checkout') {
            // ── Link / QR code ───────────────────────────────────────────────
            activeTransaction.value = await api.CreateSumupCheckoutLink(payload)
            // Polling ogni 5 s
            pollingInterval.value = setInterval(pollStatus, 5000)

        } else if (selectedProvider.value === 'sumup_pos') {
            // ── App SumUp su tablet ──────────────────────────────────────────
            const result = await api.CreateSumupPosSession(payload)
            activeTransaction.value = result
            posUrlScheme.value = result.url_scheme
            // Apri l'app SumUp automaticamente
            window.location.href = result.url_scheme
            // Lo stato verrà aggiornato via Socket.IO (handlePosCallback lato server)

        } else if (selectedProvider.value === 'sumup_solo') {
            // ── Terminale Solo ───────────────────────────────────────────────
            activeTransaction.value = await api.CreateSumupSoloPayment(payload)
            // Polling ogni 5 s
            pollingInterval.value = setInterval(pollStatus, 5000)
        }
    } catch (err: any) {
        paymentStatus.value = 'failed'
        snackbarStore.show(err?.message || 'Errore nella creazione del pagamento', 4000, 'top', 'error')
    }
}

async function pollStatus() {
    if (!activeTransaction.value?.id) return
    paymentStatus.value = 'checking'
    try {
        const result = await api.CheckPaymentStatus(activeTransaction.value.id)
        if (result.status === 'PAID') {
            onPaymentSuccess()
        } else if (result.status === 'FAILED') {
            stopPolling()
            paymentStatus.value = 'failed'
            snackbarStore.show('Pagamento non riuscito', 3000, 'top', 'error')
        } else {
            paymentStatus.value = 'pending'
        }
    } catch {
        paymentStatus.value = 'pending'
    }
}

/** The server has already paid the items / closed the table (and recorded any discount). */
function onPaymentSuccess() {
    stopPolling()
    paymentStatus.value = 'paid'
    snackbarStore.show(partialPaid.value ? 'Pagamento ricevuto' : 'Pagamento ricevuto, tavolo chiuso', 3000, 'top', 'success')
    const tableId = activeTable.value.table_id || activeTable.value.id
    setTimeout(() => {
        itemToBePaid.value = []
        dialogPay.value = false
        emit('getTables', partialPaid.value ? tableId : 0)
    }, 1000)
}

function copyPaymentLink() {
    const url = (activeTransaction.value as any)?.payment_url
    if (url) {
        navigator.clipboard.writeText(url)
        snackbarStore.show('Link copiato', 2000, 'bottom', 'success')
    }
}

function openPosApp() {
    if (posUrlScheme.value) window.location.href = posUrlScheme.value
}

// ── Socket.IO: ascolta il callback POS (sumup_pos) ───────────────────────────

function handlePaymentCompleted(data: { transaction_id: number; table_id: number; status: string }) {
    if (activeTransaction.value?.id === data.transaction_id) {
        if (data.status === 'PAID') {
            onPaymentSuccess()
        } else {
            paymentStatus.value = 'failed'
            snackbarStore.show('Pagamento non riuscito', 3000, 'top', 'error')
        }
    }
}

/**
 * When the connection comes back: the payment's outcome may have been announced while disconnected, so it is asked
 * (the table list is reloaded by Checkout).
 */
function resync() {
    if (activeTransaction.value?.id && paymentStatus.value === 'pending') void pollStatus()
}

let stopResync: () => void
onMounted(async () => {
    socket.on('payment-completed', handlePaymentCompleted)
    stopResync = onResync(resync)
    // Without electronic payments only cash is offered
    if (!isFeatureEnabled('payments')) return
    try {
        availableProviders.value = await api.GetAvailablePaymentProviders()
    } catch {
        // Il modulo di pagamento potrebbe non essere configurato
    }
})

onBeforeUnmount(() => {
    socket.off('payment-completed', handlePaymentCompleted)
    stopResync()
    stopPolling()
})
</script>

<template>
    <div style="padding-bottom: 56px;">
        <v-btn v-if="activeTable.name || activeTable.table_name" @click="emit('changeTableSheet')"
            :style="tableNameStyle" class="floating-name-btn" :readonly="roomid === -1"
            :variant="roomid === -1 ? 'text' : 'elevated'">
            {{ activeTable.name || activeTable.table_name }}
        </v-btn>

        <v-chip v-if="activeTable.user" class="user-chip">
            Effettuato da: {{ activeTable.user.username }}
        </v-chip>

        <ItemList class="mt-1" :shownote="true" :showtype="true" subheader="DA PAGARE"
            v-model="computedSelectedTable.itemsToDo">
            <template #prequantity="{ item }">
                <v-btn icon="mdi-delete" @click="deleteItemConfirm(item.id)" variant="plain" />
            </template>
            <template #postquantity="{ item }">
                <v-checkbox v-model="itemToBePaid" :value="item.id" />
            </template>
        </ItemList>

        <v-divider />

        <ItemList subheader="PAGATI" v-model="computedSelectedTable.itemsDone" :done="true">
            <template #postquantity="{ item }" v-if="computedSelectedTable.status !== 'CLOSED'">
                <v-btn variant="plain"
                    :icon="item.sub_type !== 'Sconto' ? 'mdi-arrow-up-thin' : 'mdi-window-close'"
                    @click="item.sub_type !== 'Sconto' ? rollbackItem(item) : deleteItemConfirm(item.id)" />
            </template>
        </ItemList>

        <!-- Bottom bar -->
        <div :style="bottomBarStyle" class="bottom-action-bar bg-surface text-on-surface elevation-4">
            <v-btn id="drawer-button" variant="plain" :icon="navigation ? 'mdi-undo' : 'mdi-menu'"
                @click="closeDrawer" />

            <v-btn v-if="selectedTable.length" variant="plain" readonly class="total-display-btn">
                Totale: {{ tableTotalOrder }} €
            </v-btn>

            <v-spacer />

            <v-btn v-if="itemToBePaid.length" variant="plain" @click="pay(true)" class="action-btn">
                PARZIALE {{ itemToBePaidBill }} €
            </v-btn>

            <template v-if="selectedTable.length && !activeTable.paid && activeTable.status !== 'CLOSED'">
                <v-btn class="show-xs action-btn" variant="plain" @click="pay(false)" :readonly="onGoing">
                    <span :class="{ 'opacity-low': onGoing }">CHIUDI TAVOLO</span>
                </v-btn>
                <v-btn class="hide-xs" icon="mdi-close-box" variant="plain" @click="pay(false)"
                    :readonly="onGoing" :class="{ 'opacity-low': onGoing }" />
            </template>
        </div>

        <!-- Dialog pagamento -->
        <v-dialog v-model="dialogPay" width="440"
            :persistent="paymentStatus === 'pending' || paymentStatus === 'checking'"
            @update:model-value="(v) => { if (!v) closePayDialog() }">
            <v-card>
                <v-card-title>
                    {{ partialPaid ? 'Pagare elementi selezionati' : 'Paga l\'intero conto' }}
                </v-card-title>
                <v-card-subtitle v-if="!partialPaid">
                    A seguito del pagamento il tavolo verrà chiuso
                </v-card-subtitle>

                <!-- ── Stato: pagamento in corso ── -->
                <template v-if="activeTransaction">
                    <v-card-text>

                        <!-- Successo -->
                        <div v-if="paymentStatus === 'paid'" class="text-center py-6">
                            <v-icon icon="mdi-check-circle" color="success" size="72" />
                            <p class="text-h6 mt-3">Pagamento ricevuto!</p>
                        </div>

                        <!-- Fallito -->
                        <div v-else-if="paymentStatus === 'failed'" class="text-center py-6">
                            <v-icon icon="mdi-close-circle" color="error" size="72" />
                            <p class="text-h6 mt-3">Pagamento non riuscito</p>
                        </div>

                        <!-- In attesa -->
                        <div v-else>
                            <div class="text-h5 text-center mb-4">{{ effectiveAmount }} €</div>

                            <!-- sumup_checkout: mostra link -->
                            <template v-if="selectedProvider === 'sumup_checkout'">
                                <v-alert type="info" variant="tonal" class="mb-3">
                                    <p class="text-body-2 mb-2">Condividi il link con il cliente:</p>
                                    <div class="d-flex align-center gap-1">
                                        <code class="text-caption link-text flex-grow-1">
                                            {{ (activeTransaction as any).payment_url }}
                                        </code>
                                        <v-btn icon="mdi-content-copy" variant="plain" size="x-small"
                                            @click="copyPaymentLink" />
                                    </div>
                                </v-alert>
                            </template>

                            <!-- sumup_pos: mostra bottone per riaprire app -->
                            <template v-else-if="selectedProvider === 'sumup_pos'">
                                <v-alert type="info" variant="tonal" class="mb-3">
                                    <p class="text-body-2 mb-2">
                                        L'app SumUp è stata aperta sul tablet. Il cliente deve avvicinare
                                        o inserire la carta sul lettore.
                                    </p>
                                    <v-btn variant="tonal" size="small" prepend-icon="mdi-cellphone-nfc"
                                        @click="openPosApp">
                                        Riapri app SumUp
                                    </v-btn>
                                </v-alert>
                            </template>

                            <!-- sumup_solo: istruzioni terminale -->
                            <template v-else-if="selectedProvider === 'sumup_solo'">
                                <v-alert type="info" variant="tonal" class="mb-3">
                                    <p class="text-body-2">
                                        Il pagamento è stato inviato al terminale SumUp Solo.
                                        Il cliente può pagare avvicinando o inserendo la carta.
                                    </p>
                                </v-alert>
                            </template>

                            <!-- Indicatore di attesa -->
                            <div class="d-flex align-center justify-center gap-2 mt-2">
                                <v-progress-circular
                                    v-if="paymentStatus === 'checking'"
                                    indeterminate size="18" width="2" />
                                <v-icon v-else icon="mdi-timer-sand" size="18" />
                                <span class="text-body-2 text-medium-emphasis">
                                    {{ paymentStatus === 'checking' ? 'Verifica in corso…' : 'In attesa di pagamento…' }}
                                </span>
                            </div>
                        </div>
                    </v-card-text>

                    <v-card-actions v-if="paymentStatus !== 'paid'">
                        <v-btn variant="plain" @click="resetPaymentState">Annulla</v-btn>
                        <v-spacer />
                        <!-- Verifica manuale (solo per provider con polling) -->
                        <v-btn
                            v-if="selectedProvider !== 'sumup_pos'"
                            variant="plain"
                            :loading="paymentStatus === 'checking'"
                            @click="pollStatus"
                        >
                            Verifica ora
                        </v-btn>
                        <!-- Conferma manuale (fallback per sumup_pos se callback non raggiunge il server) -->
                        <v-btn
                            v-else
                            variant="plain"
                            color="success"
                            @click="onPaymentSuccess"
                        >
                            Confermo pagamento ricevuto
                        </v-btn>
                    </v-card-actions>
                </template>

                <!-- ── Stato: selezione metodo ── -->
                <template v-else>
                    <v-card-text>
                        <v-row>
                            <v-col class="text-h5">Da pagare: {{ currentTotalToPay }} €</v-col>
                        </v-row>

                        <v-row>
                            <v-checkbox v-model="discount" label="Applicare sconto" />
                        </v-row>

                        <template v-if="discount">
                            <v-row>
                                <v-text-field :max="currentTotalToPay" append-inner-icon="mdi-currency-eur"
                                    v-model.number="realPaid" label="Quanto vuoi far pagare" type="number" />
                            </v-row>
                            <v-row>
                                <v-table class="w-100" density="compact">
                                    <thead>
                                        <tr>
                                            <th>Sconto</th>
                                            <th>Da pagare</th>
                                        </tr>
                                    </thead>
                                    <tbody class="cursor-pointer">
                                        <tr v-for="d in discounts" :key="d.label" v-ripple
                                            @click="realPaid = d.amount">
                                            <td>{{ d.label }}</td>
                                            <td>{{ d.amount }} €</td>
                                        </tr>
                                    </tbody>
                                </v-table>
                            </v-row>
                        </template>

                        <!-- Selezione metodo di pagamento (solo se ci sono provider elettronici) -->
                        <template v-if="paymentButtons.length > 1">
                            <v-row class="mt-3">
                                <v-col class="text-body-2 text-medium-emphasis pb-1">
                                    Metodo di pagamento
                                </v-col>
                            </v-row>
                            <v-row dense>
                                <v-col v-for="btn in paymentButtons" :key="btn.key"
                                    :cols="paymentButtons.length <= 2 ? 6 : 4">
                                    <v-btn
                                        block
                                        :variant="selectedProvider === btn.key ? 'tonal' : 'outlined'"
                                        :color="selectedProvider === btn.key ? 'primary' : undefined"
                                        :prepend-icon="btn.icon"
                                        size="small"
                                        class="payment-method-btn"
                                        @click="selectedProvider = btn.key"
                                    >
                                        {{ btn.label }}
                                    </v-btn>
                                </v-col>
                            </v-row>
                        </template>
                    </v-card-text>

                    <v-card-actions>
                        <v-btn variant="plain" @click="closePayDialog">ANNULLA</v-btn>
                        <v-spacer />
                        <v-btn
                            v-if="selectedProvider !== 'cash'"
                            variant="plain"
                            color="primary"
                            :prepend-icon="PROVIDER_META[selectedProvider]?.icon"
                            @click="startElectronicPayment"
                        >
                            AVVIA PAGAMENTO
                        </v-btn>
                        <v-btn
                            v-else
                            variant="plain"
                            @click="partialPaid ? paySelectedItem() : completeTable()"
                        >
                            CONFERMA
                        </v-btn>
                    </v-card-actions>
                </template>
            </v-card>
        </v-dialog>

        <Confirm v-model="confirm">
            <template #action>
                <v-btn text="Conferma" variant="plain" @click="deleteItem" />
            </template>
        </Confirm>
    </div>
</template>

<style scoped>
.floating-name-btn {
    position: absolute;
    z-index: 100;
}

.user-chip {
    margin: 10px 0 0 10px;
}

.bottom-action-bar {
    position: absolute;
    bottom: 0;
    display: flex;
    flex: none;
    font-size: .75rem;
    justify-content: center;
    transition: inherit;
    height: 56px;
}

.total-display-btn,
.action-btn {
    font-size: inherit;
    height: 100%;
    max-width: 168px;
    min-width: 80px;
    text-transform: none;
    transition: inherit;
    width: auto;
}

.opacity-low {
    opacity: 0.2;
}

.cursor-pointer {
    cursor: pointer;
}

.link-text {
    word-break: break-all;
}

.payment-method-btn {
    text-transform: none;
    font-size: 0.75rem;
}

@media only screen and (min-width: 576px) {
    #drawer-button {
        display: none;
    }
}

.table-selection .v-card {
    text-align: center;
    font-size: large;
}
</style>
