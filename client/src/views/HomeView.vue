<script setup lang="ts">
import { onMounted } from 'vue';
import TheWelcome from '../components/TheWelcome.vue'
import { io } from 'socket.io-client';

onMounted(() => {
  const is = io()
  is.on('connect', () => {
    console.log('a user connected');
    is.emit('room', 'test')
  });

  is.on('disconnect', () => {
    console.log('user disconnected');
  });

  is.on('connect_error', (err) => {
    console.log('connect_error', err.message); // prints the message associated with the error
  });

  is.on('test', (data) => {
    console.log('connect_msg', data); // prints the message associated with the error 
  });
})

</script>

<template>
  <main>
    <TheWelcome />
  </main>
</template>
