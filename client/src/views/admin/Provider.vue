<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Axios from '@/services/client'
import SumUp from '../providers/SumUp.vue';
import { type PaymentProvider } from '../../../../models/src';
import { requiredRule } from '@/services/utils';

const props = defineProps(['type'])
const paymentProvider = ref<PaymentProvider>({
    type: 'SumUp'
} as PaymentProvider)

const axios = new Axios()

async function createProvider() {
    await axios.CreatePaymentProviders(paymentProvider.value)
}

onMounted(async () => {

})
</script>
<template>
    <v-container>
        Crea nuovo provider
        <v-form>
            <v-row>
                <v-col>
                    <v-text-field v-model="paymentProvider.name" :rules="[requiredRule]"></v-text-field>
                </v-col>
            </v-row>
        </v-form>
        <SumUp v-if="type === 'sumup'" v-model="paymentProvider.access_info"></SumUp>
        <v-btn>
            Crea Provider
        </v-btn>
    </v-container>
</template>
