<script setup lang="ts">
import { type Table, type Item } from "../../../models/src"
import { ref, computed } from "vue"
import Axios from '@/services/client'
import { SnackbarStore } from '@/stores'
import { copy, sortItem } from "@/services/utils"
import Confirm from "@/components/Confirm.vue"
import ItemList from "@/components/ItemList.vue"
import { useDisplay } from 'vuetify'

const { smAndDown } = useDisplay()

const props = defineProps(['is', 'event', 'navigation'])
const selectedTable = defineModel<Table[]>('selectedTable', { required: true })
const drawer = defineModel<boolean>('drawer', { required: true })

const axios = new Axios()
const snackbarStore = SnackbarStore()

const emit = defineEmits(['getTables', 'changeTableSheet'])

const confirm = ref<boolean>(false)
const deleteItemId = ref<number>(0)
const itemToBePaid = ref<number[]>([])
const discount = ref<boolean>(false)
const realPaid = ref<number | null>(null)
const partialPaid = ref<boolean>(false)
const dialogPay = ref<boolean>(false)

const computedSelectedTable = computed(() => {
    let result = copy<Table>((selectedTable.value.length ? selectedTable.value[0] : { items: [] }) as Table)
    if (!result.items) {
        result.items = []
    }
    result.itemsToDo = result.items.filter((i: Item) => !i.paid).sort(sortItem)
    result.itemsDone = result.items.filter((i: Item) => i.paid).sort(sortItem)
    return result
})
const tableTotalOrder = computed(() => {
    if (computedSelectedTable.value.items) {
        return computedSelectedTable.value.items.reduce((a: number, i: Item) => a += i.paid ? 0 : i.price, 0)
    }
    else return 0
})
const itemToBePaidBill = computed(() => {
    if (selectedTable.value.length && selectedTable.value[0].items) {
        return selectedTable.value[0].items.filter((i: Item) => itemToBePaid.value.includes(i.id || 0)).reduce((a: number, i: Item) => a += i.price, 0)
    }
    else {
        return 0
    }
})
const onGoing = computed(() => selectedTable.value[0].items.filter((i: Item) => !i.done).length ? true : false)
const discounts = computed(() => {
    return [
        {
            discount: "10%",
            discountAmount: Math.round((partialPaid.value ? itemToBePaidBill.value : tableTotalOrder.value) * 0.9)
        },
        {
            discount: "15%",
            discountAmount: Math.round((partialPaid.value ? itemToBePaidBill.value : tableTotalOrder.value) * 0.85)
        },
        {
            discount: "20%",
            discountAmount: Math.round((partialPaid.value ? itemToBePaidBill.value : tableTotalOrder.value) * 0.8)
        },
        {
            discount: "30%",
            discountAmount: Math.round((partialPaid.value ? itemToBePaidBill.value : tableTotalOrder.value) * 0.7)
        },
        {
            discount: "50%",
            discountAmount: Math.round((partialPaid.value ? itemToBePaidBill.value : tableTotalOrder.value) * 0.5)
        }
    ]
})

async function rollbackItem(item: Item) {
    item.paid = false
    await axios.UpdateItem(item)
    selectedTable.value[0].items.find((i: Item) => i.master_item_id === item.master_item_id && i.note === item.note && i.paid).paid = false
}

async function deleteItemConfirm(item_id: number) {
    deleteItemId.value = item_id
    confirm.value = true
}

async function deleteItem() {
    await axios.DeleteItem(deleteItemId.value)
    emit('getTables')
    confirm.value = false
}

async function completeTable() {
    if (discount.value) {
        if (!realPaid.value) {
            return
        }
        const discountAmout = tableTotalOrder.value - realPaid.value
        await axios.InsertDiscount(props.event.id, selectedTable.value[0].id, discountAmout)
    }
    await axios.CompleteTable(selectedTable.value[0].id)
    emit('getTables')
    snackbarStore.show("Tavolo chiuso", 3000, 'bottom', 'success')
    dialogPay.value = false
}

async function paySelectedItem() {
    if (discount.value) {
        if (!realPaid.value) {
            return
        }
        const discountAmout = itemToBePaidBill.value - realPaid.value
        await axios.InsertDiscount(props.event.id, selectedTable.value[0].id, discountAmout)
    }
    await axios.PaySelectedItem(selectedTable.value[0].id, itemToBePaid.value)
    emit('getTables')
    itemToBePaid.value = []

    dialogPay.value = false
}

function pay(partial: boolean) {
    partialPaid.value = partial
    discount.value = false
    realPaid.value = partial ? itemToBePaidBill.value : tableTotalOrder.value
    dialogPay.value = true
}

function changeTableSheetHandler() {
    emit('changeTableSheet')
}
</script>

<template>
    <div>
        <v-container>
            <v-btn @click="changeTableSheetHandler()"
                style="position: absolute; top: 74px; right: 25px; z-index: 10000;" v-if="selectedTable.length && selectedTable[0].name">{{
                    selectedTable[0].name }}</v-btn>
        </v-container>
        <ItemList :shownote="true" style="margin-top: 2px;" :showtype="true" subheader="DA PAGARE"
            v-model="computedSelectedTable.itemsToDo">
            <template v-slot:prequantity="slotProps">
                <v-btn icon="mdi-delete" @click="deleteItemConfirm(slotProps.item.id)" variant="plain"></v-btn>
            </template>
            <template v-slot:postquantity="slotProps">
                <v-checkbox v-model="itemToBePaid" :value="slotProps.item.id"></v-checkbox>
            </template>
        </ItemList>
        <v-divider></v-divider>
        <ItemList subheader="PAGATI" v-model="computedSelectedTable.itemsDone" :done="true">
            <template v-slot:postquantity="slotProps">
                <v-btn variant="plain" v-if="slotProps.item.sub_type !== 'Sconto'" icon="mdi-arrow-up-thin"
                    @click="rollbackItem(slotProps.item)"></v-btn>
                <v-btn variant="plain" v-else icon="mdi-window-close"
                    @click="deleteItemConfirm(slotProps.item.id)"></v-btn>
            </template>
        </ItemList>
        <div :style="{ width: navigation || smAndDown ? '100%' : 'calc(100% - 255px)' }"
            style="position: absolute; bottom: 0; display: flex; flex: none; font-size: .75rem; justify-content: center; transition: inherit; height: 56px;">
            <v-btn variant="plain" :icon="navigation ? 'mdi-undo' : 'mdi-menu'" @click="drawer = !drawer" id="drawer-button"></v-btn>
            <v-btn variant="plain" readonly v-if="selectedTable.length"
                style="font-size: inherit; height: 100%; max-width: 168px; min-width: 80px; text-transform: none; transition: inherit; width: auto;">
                Totale: {{ tableTotalOrder }} €
            </v-btn>
            <v-spacer></v-spacer>
            <v-btn variant="plain" @click="pay(true)" v-if="itemToBePaid.length"
                class="custom-button-bottom-bar">PARZIALE {{
                    itemToBePaidBill
                }}
                €</v-btn>
            <v-btn class="show-xs custom-button-bottom-bar" variant="plain" @click="pay(false)"
                v-if="selectedTable.length && !selectedTable[0].paid" :readonly="onGoing">
                <span :style="{ opacity: onGoing ? 0.2 : 'inherit' }">CHIUDI TAVOLO</span>
            </v-btn>
            <v-btn :style="{ opacity: onGoing ? 0.2 : 'inherit' }" icon="mdi-close-box" class="hide-xs" variant="plain"
                @click="pay(false)" :readonly="onGoing" v-if="selectedTable.length && !selectedTable[0].paid">

            </v-btn>
        </div>
        <v-dialog v-model="dialogPay" width="400">
            <v-card>
                <v-card-title v-if="partialPaid">
                    Pagare elementi selezionati
                </v-card-title>
                <v-card-title v-else>
                    Paga l'intero conto
                </v-card-title>
                <v-card-subtitle v-if="!partialPaid">
                    A seguito del pagamento il tavolo verrà chiuso
                </v-card-subtitle>
                <v-card-text>
                    <v-row v-if="partialPaid">
                        <v-col style="font-size: x-large;">
                            Da pagare: {{ itemToBePaidBill }} €
                        </v-col>
                    </v-row>
                    <v-row v-else>
                        <v-col style="font-size: x-large;">
                            Da pagare: {{ tableTotalOrder }} €
                        </v-col>
                    </v-row>
                    <v-row>
                        <v-checkbox v-model="discount" label="Applicare sconto"></v-checkbox>
                    </v-row>
                    <v-row v-if="discount">
                        <v-text-field :max="partialPaid ? itemToBePaidBill : tableTotalOrder"
                            append-inner-icon="mdi-currency-eur" v-model.number="realPaid"
                            label="Quanto vuoi far pagere" type="number"></v-text-field>
                    </v-row>
                    <v-row v-if="discount">
                        <v-table style="width: 100%;" density="compact">
                            <thead>
                                <td>Sconto</td>
                                <td>Da pagare</td>
                            </thead>
                            <tbody style="cursor: pointer">
                                <tr v-ripple @click="realPaid = disc.discountAmount" v-for="disc in discounts">
                                    <td>{{ disc.discount }}</td>
                                    <td>{{ disc.discountAmount }} €</td>
                                </tr>
                            </tbody>
                        </v-table>
                    </v-row>
                </v-card-text>
                <v-card-actions>
                    <v-btn variant="plain" @click="dialogPay = false">ANNULLA</v-btn>
                    <v-spacer></v-spacer>
                    <v-btn v-if="partialPaid" variant="plain" @click="paySelectedItem">CONFERMA</v-btn>
                    <v-btn v-else variant="plain" @click="completeTable">CONFERMA</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
        <Confirm v-model="confirm">
            <template v-slot:action>
                <v-btn text="Conferma" variant="plain" @click="deleteItem"></v-btn>
            </template>
        </Confirm>
    </div>
</template>

<style scoped>
@media only screen and (min-width: 576px) {
    #drawer-button {
        display: none;
    }
}

.table-selection .v-card {
    text-align: center;
    font-size: large;
}

.custom-button-bottom-bar {
    font-size: inherit;
    height: 100%;
    max-width: 168px;
    min-width: 80px;
    text-transform: none;
    transition: inherit;
    width: auto;
}
</style>