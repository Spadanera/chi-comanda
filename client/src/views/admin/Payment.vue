<script setup lang="ts">
import { type PaymentProvider } from "../../../../models/src";
import { onMounted, ref } from 'vue';
import Axios from '@/services/client'
import { RouterLink } from 'vue-router';
import { paymentProviderBase } from '../../services/utils'

const paymentProviders = ref<PaymentProvider[]>([])
const axios = new Axios()
const dialog = ref<boolean>(null)

onMounted(async () => {
    paymentProviders.value = await axios.GetPaymentProviders()
})
</script>
<template>
    <v-container>
        <v-row>
            <v-col v-if="paymentProviders.length" v-for="provider in paymentProviders" sm="6" cols="12" lg="4">
                <v-card :title="provider.name">
                    <v-card-subtitle>
                        sottotitole
                    </v-card-subtitle>
                    <v-card-text>
                        testo
                    </v-card-text>
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
    <v-fab @click="dialog = true" icon="mdi-plus" app style="position: fixed; right: 15px; bottom: 15px;" location="bottom right"></v-fab>
    <v-dialog v-model="dialog" >
        <v-card>
            <v-card-title>
                Seleziona il provider
            </v-card-title>
            <v-card-text>
                <v-row>
                    <v-col v-for="paymentProviderBase in paymentProviderBase" sm="6" cols="12" lg="4">
                        <RouterLink :to="`provider/sumup`">
                            <v-card>
                                <v-img width="100px" :src="paymentProviderBase.image"></v-img>
                                <v-card-title>
                                    {{ paymentProviderBase.name }}
                                </v-card-title>
                                <v-card-subtitle>
                                    <a :href="paymentProviderBase.docUrl" target="_blank">Guida</a>
                                </v-card-subtitle>
                                <v-card-text>
                                    {{ paymentProviderBase.description }}
                                </v-card-text>
                            </v-card>
                        </RouterLink>
                    </v-col>
                </v-row>
            </v-card-text>
            <v-card-actions>
                <v-btn variant="plain" @click="dialog = false">ANNULLA</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
