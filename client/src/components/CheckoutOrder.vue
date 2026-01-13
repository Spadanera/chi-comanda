<script setup lang="ts">
import { ref, computed } from "vue"
import { useDisplay } from 'vuetify'
import { type Table, type Item } from "../../../models/src"
import Axios from '@/services/client'
import { SnackbarStore } from '@/stores'
import { copy, sortItem } from "@/services/utils"
import Confirm from "@/components/Confirm.vue"
import ItemList from "@/components/ItemList.vue"

const props = defineProps(['event', 'navigation', 'roomid'])
const emit = defineEmits(['getTables', 'changeTableSheet', 'closeDrawer'])

const selectedTable = defineModel<Table[]>('selectedTable', { required: true })
const drawer = defineModel<boolean>('drawer', { required: true })

const { smAndDown } = useDisplay()
const axios = new Axios()
const snackbarStore = SnackbarStore()

const confirm = ref(false)
const deleteItemId = ref(0)
const itemToBePaid = ref<number[]>([])
const discount = ref(false)
const realPaid = ref<number | null>(null)
const partialPaid = ref(false)
const dialogPay = ref(false)

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

const onGoing = computed(() => {
    const items = activeTable.value.items || []
    return items.some(i => !i.done)
})

const tableNameStyle = computed(() => ({
    top: props.navigation ? '16px' : (props.roomid === -1 ? '125px' : '74px'),
    right: props.navigation ? '14px' : '25px'
}))

const bottomBarStyle = computed(() => ({
    width: props.navigation || smAndDown.value ? '100%' : 'calc(100% - 255px)'
}))

const discounts = computed(() => {
    const base = currentTotalToPay.value
    const percentages = [0.9, 0.85, 0.8, 0.7, 0.5]
    const labels = ["10%", "15%", "20%", "30%", "50%"]

    return labels.map((label, index) => ({
        discount: label,
        discountAmount: Math.round(base * percentages[index])
    }))
})

const rollbackItem = async (item: Item) => {
    item.paid = false
    await axios.UpdateItem(item, activeTable.value.paid)
    emit('getTables', item.table_id)
}

const deleteItemConfirm = (item_id: number) => {
    deleteItemId.value = item_id
    confirm.value = true
}

const deleteItem = async () => {
    await axios.DeleteItem(deleteItemId.value)
    emit('getTables', activeTable.value.table_id || activeTable.value.id)
    confirm.value = false
}

const handleDiscount = async () => {
    if (discount.value && realPaid.value) {
        const discountAmount = currentTotalToPay.value - realPaid.value
        await axios.InsertDiscount(props.event.id, activeTable.value.table_id || activeTable.value.id, discountAmount)
    }
}

const completeTable = async () => {
    await handleDiscount()
    await axios.CompleteTable(activeTable.value.table_id || activeTable.value.id)
    emit('getTables', 0)
    snackbarStore.show("Tavolo chiuso", 3000, 'bottom', 'success')
    dialogPay.value = false
}

const paySelectedItem = async () => {
    await handleDiscount()
    await axios.PaySelectedItem(activeTable.value.table_id || activeTable.value.id, itemToBePaid.value)
    emit('getTables', activeTable.value.table_id || activeTable.value.id)
    itemToBePaid.value = []
    dialogPay.value = false
}

const pay = (partial: boolean) => {
    partialPaid.value = partial
    discount.value = false
    realPaid.value = currentTotalToPay.value
    dialogPay.value = true
}

const closeDrawer = () => {
    drawer.value = !drawer.value
    emit('closeDrawer')
}
</script>

<template>
    <div style="padding-bottom: 56px;">
        <v-btn v-if="activeTable.name || activeTable.table_name" @click="emit('changeTableSheet')" :style="tableNameStyle"
            class="floating-name-btn" :readonly="roomid === -1" :variant="roomid === -1 ? 'text' : 'elevated'">
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
                <v-btn variant="plain" :icon="item.sub_type !== 'Sconto' ? 'mdi-arrow-up-thin' : 'mdi-window-close'"
                    @click="item.sub_type !== 'Sconto' ? rollbackItem(item) : deleteItemConfirm(item.id)" />
            </template>
        </ItemList>

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

                <v-btn class="hide-xs" icon="mdi-close-box" variant="plain" @click="pay(false)" :readonly="onGoing"
                    :class="{ 'opacity-low': onGoing }" />
            </template>
        </div>

        <v-dialog v-model="dialogPay" width="400">
            <v-card>
                <v-card-title>
                    {{ partialPaid ? 'Pagare elementi selezionati' : 'Paga l\'intero conto' }}
                </v-card-title>
                <v-card-subtitle v-if="!partialPaid">
                    A seguito del pagamento il tavolo verrà chiuso
                </v-card-subtitle>
                <v-card-text>
                    <v-row>
                        <v-col class="text-h5">
                            Da pagare: {{ currentTotalToPay }} €
                        </v-col>
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
                                    <tr v-for="disc in discounts" :key="disc.discount" v-ripple
                                        @click="realPaid = disc.discountAmount">
                                        <td>{{ disc.discount }}</td>
                                        <td>{{ disc.discountAmount }} €</td>
                                    </tr>
                                </tbody>
                            </v-table>
                        </v-row>
                    </template>
                </v-card-text>
                <v-card-actions>
                    <v-btn variant="plain" @click="dialogPay = false">ANNULLA</v-btn>
                    <v-spacer />
                    <v-btn variant="plain" @click="partialPaid ? paySelectedItem() : completeTable()">CONFERMA</v-btn>
                </v-card-actions>
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