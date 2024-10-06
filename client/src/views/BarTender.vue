<script setup lang="ts">
import { Order, MasterItem, Item, ItemTypes as types } from "../../../models/src"
import { ref, onMounted, computed } from "vue"
import router from '@/router'
import Axios from '@/services/client'
import { SnackbarStore } from '@/stores'

const axios = new Axios()
const user = defineModel<IUser>()
const snackbarStore = new SnackbarStore()

const emit = defineEmits(['reload'])

const props = defineProps(['order_id'])

const loading = ref<boolean>(true)
const sheet = ref(false)
const orders = ref<Order[]>([])

onMounted(async () => {
  
  loading.value = false
})
</script>

<template>
  <main>
    
  </main>
</template>
