<script setup lang="ts">
import Layout from '@/components/Layout.vue'
import { ref, onUnmounted, onMounted } from "vue"
import { useSocket, joinRoom, leaveRoom, onResync } from '@/composables/useSocket'

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

/** When the connection comes back: the whole layout, unless the user is changing it. */
const resync = () => {
  if (!layout.value?.isEditing()) reloadTable()
}

let stopResync: () => void
onMounted(() => {
  joinRoom('table')
  socket.on('reload-table', reloadTable)
  stopResync = onResync(resync)
})

onUnmounted(() => {
  clearTimeout(reloadTimeout)
  leaveRoom('table')
  socket.off('reload-table', reloadTable)
  stopResync()
})
</script>

<template>
  <v-container v-if="!props.event?.id">
    <NoEvent></NoEvent>
  </v-container>
  <Layout v-else :edit-room="false" :event="props.event" ref="layout"></Layout>
</template>
