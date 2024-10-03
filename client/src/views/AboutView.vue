<script setup>
import { onMounted } from 'vue';
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
  <div class="about">
    <h1>This is an about page</h1>
  </div>
</template>

<style>
@media (min-width: 1024px) {
  .about {
    min-height: 100vh;
    display: flex;
    align-items: center;
  }
}
</style>
