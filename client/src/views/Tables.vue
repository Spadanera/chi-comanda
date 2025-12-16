<script setup lang="ts">
import Layout from '@/components/Layout.vue'
import { ref, onUnmounted, onMounted } from "vue"

const props = defineProps(['is', 'event'])

const is = props.is
const layout = ref<any>(null)
let reloadTimeout: ReturnType<typeof setTimeout>

const reloadTable = () => {
  clearTimeout(reloadTimeout)
  reloadTimeout = setTimeout(() => {
    if (layout.value) {
      layout.value.getLayout()
    }
  }, 300)
}

const handleReconnection = () => {
  if (is) {
    is.emit('join', 'table')
    reloadTable()
  }
}

onMounted(async () => {
  is.emit('join', 'table')

  is.on('reload-table', reloadTable)
  is.on('connect', handleReconnection)
})

onUnmounted(() => {
  clearTimeout(reloadTimeout)
  if (is) {
    is.emit('leave', 'table')
    is.off('reload-table', reloadTable)
    is.off('connect', handleReconnection)
  }
})
</script>

<template>
  <v-container v-if="!props.event?.id">
    <NoEvent></NoEvent>
  </v-container>
  <Layout v-else :edit-room="false" :event="props.event" ref="layout"></Layout>
</template>