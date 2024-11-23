<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Axios from '@/services/client'
import type { AccessInfo } from '../../../../models/src';

const accessInfo = defineModel<AccessInfo>({ default: {}, required: true })

const axios = new Axios()

onMounted(() => {
})
</script>
<template>
    <v-form>
        <v-row>
            <v-col>
                sumup
            </v-col>
        </v-row>
    </v-form>
</template>
