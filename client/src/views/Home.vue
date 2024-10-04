<script setup lang="ts">
import Client from '@/services/client';
import { onMounted } from 'vue';

onMounted(async () => {
  const client = new Client()
  console.log(await client.GetAllEvents())
})
</script>

<template>
  <main>
    
  </main>
</template>
