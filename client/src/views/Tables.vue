<script setup lang="ts">
import Layout from '@/components/Layout.vue'
import { ref, onUnmounted, onMounted } from "vue"

const props = defineProps(['is', 'event'])

const is = props.is
const layout = ref(null)

const reloadTable = () => {
  if (layout.value) {
    layout.value.getLayout();
  }
}

onMounted(async () => {
  is.emit('join', 'waiter')

  is.on('reload-table', reloadTable)
})

onUnmounted(() => {
  if (is) {
    is.off('reload-table', reloadTable)
  }
})
</script>

<template>
  <v-container v-if="!props.event?.id">
    <h3>Gestione Tavoli</h3>
    <p>Nessun evento attivo</p>
  </v-container>
  <Layout v-else :edit-room="false" :event="props.event" ref="layout"></Layout>
</template>