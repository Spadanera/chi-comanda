<script setup lang="ts">
import { type PaymentProvider, type PaymentProviderBase, type PaymentProviderStatus } from "../../../../models/src";
import { onMounted, ref } from 'vue';
import Axios from '@/services/client'
import { RouterLink } from 'vue-router';
import { copy, paymentProviderBase } from '../../services/utils'

const paymentProviders = ref<PaymentProvider[]>([])
const axios = new Axios()
const dialog = ref<boolean>(null)
const loading = ref<boolean>(null)
const confirm = ref<boolean>(null)
const providerToDelete = ref<PaymentProvider>(null)

async function createPaymentProvider(paymentProviderBase: PaymentProviderBase) {
    await axios.CreatePaymentProviders({
        display_name: paymentProviderBase.name,
        status: 'ACTIVE',
        ...paymentProviderBase
    } as PaymentProvider)

    await getPaymentProviders()
    dialog.value = false
}

async function getPaymentProviders() {
    paymentProviders.value = await axios.GetPaymentProviders()
    for (let i = 0; i < paymentProviders.value.length; i++) {
        let provider = paymentProviders.value[i]
        const providerBase = paymentProviderBase.find((p: PaymentProviderBase) => p.type === provider.type)
        provider = {
            ...provider,
            ...providerBase
        }
        paymentProviders.value[i] = provider

    }
}

async function setDefaultPaymentProvider(id: number) {
    console.log(id)
    await axios.SetDefaultPaymentProviders(id)
    await getPaymentProviders()
}

async function editStatusPaymentProvider(paymentProvider?: PaymentProvider, status?: PaymentProviderStatus) {
    if (paymentProvider) {
        const paymentProviderCopy = copy(paymentProvider)
        paymentProviderCopy.status = status
        if (status === 'DELETED') {
            providerToDelete.value = paymentProviderCopy
            confirm.value = true
        }
        else {
            await axios.EditStatusPaymentProviders(paymentProviderCopy)
            await getPaymentProviders()
        }
    }
    else {
        await axios.EditStatusPaymentProviders(providerToDelete.value)
        await getPaymentProviders()
        confirm.value = false
    }
}

function showPaymentProvider(paymentProviderBase: PaymentProviderBase): boolean {
    if (!paymentProviderBase.isUnique) return true
    if (paymentProviders.value.filter((p: PaymentProvider) => p.type === paymentProviderBase.type).length) {
        return false
    }
    return true
}

onMounted(async () => {
    loading.value = true
    await getPaymentProviders()
    loading.value = false
})
</script>
<template>
    <v-skeleton-loader v-if="loading" type="card"></v-skeleton-loader>
    <v-container>
        <v-row>
            <v-col v-if="paymentProviders.length" v-for="provider in paymentProviders" sm="6" cols="12" lg="4">
                <v-card>
                    <div :class="[provider.status === 'DISABLED' ? 'opacity-40' : '']"
                        style="padding-left: 10px; padding-top: 10px;">
                        <v-icon size="xxx-large" v-if="/^mdi/.test(provider.image)" six>{{
                            provider.image
                            }}</v-icon>
                        <v-img v-else width="100px" :src="provider.image"></v-img>
                        <v-btn v-if="provider.is_default" style="position: absolute; right: 5px; top: 15px; opacity: 1;"
                            variant="plain" readonly disabled>PREDEFINITO</v-btn>
                        <v-btn v-if="provider.status === 'DISABLED'"
                            style="position: absolute; right: 5px; top: 15px; opacity: 1;" variant="plain" readonly
                            disabled>DISABILITATO</v-btn>
                    </div>
                    <v-card-title :class="[provider.status === 'DISABLED' ? 'opacity-40' : '']">
                        {{ provider.display_name }}
                    </v-card-title>
                    <v-card-subtitle v-if="provider.docUrl"
                        :class="[provider.status === 'DISABLED' ? 'opacity-40' : '']">
                        <a :href="provider.docUrl" target="_blank">Guida</a>
                    </v-card-subtitle>
                    <v-card-text :class="[provider.status === 'DISABLED' ? 'opacity-40' : '']">
                        {{ provider.description }}
                    </v-card-text>
                    <v-card-actions>
                        <v-btn v-if="!provider.is_default && provider.status === 'ACTIVE'" variant="plain"
                            @click="editStatusPaymentProvider(provider, 'DISABLED')">DISABILITA</v-btn>
                        <v-btn style="opacity: 1;" v-if="provider.status === 'DISABLED'" color="red" variant="plain"
                            @click="editStatusPaymentProvider(provider, 'DELETED')">ELIMINA</v-btn>
                        <v-btn v-if="!provider.is_default && provider.status === 'ACTIVE'"
                            @click="setDefaultPaymentProvider(provider.id)" variant="plain">IMPOSTA COME
                            PREDEFINITO</v-btn>
                    </v-card-actions>
                </v-card>
            </v-col>
            <v-col v-else>
                <h3>
                    Nussun provider creato
                </h3>
                <v-btn @click="dialog = true">
                    Crea nuovo provider
                </v-btn>
            </v-col>
        </v-row>
    </v-container>
    <v-fab @click="dialog = true" icon="mdi-plus" app style="position: fixed; right: 15px; bottom: 15px;"
        location="bottom right"></v-fab>
    <v-dialog v-model="dialog">
        <v-card>
            <v-card-title>
                Seleziona il provider
            </v-card-title>
            <v-card-text>
                <v-row>
                    <template v-for="paymentProviderBase in paymentProviderBase">
                        <v-col v-if="showPaymentProvider(paymentProviderBase)" sm="6" cols="12" lg="4">
                            <v-card>
                                <div style="padding-left: 10px; padding-top: 10px;">
                                    <v-icon size="xxx-large" v-if="/^mdi/.test(paymentProviderBase.image)" six>{{
                                        paymentProviderBase.image
                                        }}</v-icon>
                                    <v-img v-else width="100px" :src="paymentProviderBase.image"></v-img>
                                </div>
                                <v-card-title>
                                    {{ paymentProviderBase.name }}
                                </v-card-title>
                                <v-card-subtitle v-if="paymentProviderBase.docUrl">
                                    <a :href="paymentProviderBase.docUrl" target="_blank">Guida</a>
                                </v-card-subtitle>
                                <v-card-text>
                                    {{ paymentProviderBase.description }}
                                </v-card-text>
                                <v-card-actions>
                                    <RouterLink v-if="paymentProviderBase.hasConfigPage"
                                        :to="`provider/${paymentProviderBase.type}`">
                                        <v-btn variant="plain">CONFIGURA</v-btn>
                                    </RouterLink>
                                    <v-btn v-else @click="createPaymentProvider(paymentProviderBase)"
                                        variant="plain">CREA</v-btn>
                                </v-card-actions>
                            </v-card>
                        </v-col>
                    </template>
                </v-row>
            </v-card-text>
            <v-card-actions>
                <v-btn variant="plain" @click="dialog = false">ANNULLA</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
    <Confirm v-model="confirm">
        <template v-slot:action>
            <v-btn text="Conferma" variant="plain" @click="editStatusPaymentProvider()"></v-btn>
        </template>
    </Confirm>
</template>
