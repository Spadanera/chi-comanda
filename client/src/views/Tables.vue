<script setup lang="ts">
import Layout from '@/components/Layout.vue'
import { ref, onUnmounted, onMounted } from "vue"
import { useSocket } from '@/composables/useSocket'

const props = defineProps(['event'])

const socket = useSocket()
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
  socket.emit('join', 'table')
  reloadTable()
}

onMounted(() => {
  socket.emit('join', 'table')
  socket.on('reload-table', reloadTable)
  socket.on('connect', handleReconnection)
})

onUnmounted(() => {
  clearTimeout(reloadTimeout)
  socket.emit('leave', 'table')
  socket.off('reload-table', reloadTable)
  socket.off('connect', handleReconnection)
})
</script>

<template>
  <v-container v-if="!props.event?.id">
    <NoEvent></NoEvent>
  </v-container>
  <Layout v-else :edit-room="false" :event="props.event" ref="layout"></Layout>
</template>
