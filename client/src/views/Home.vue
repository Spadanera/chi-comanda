<script setup lang="ts">
import { ref, computed, onBeforeMount } from 'vue';
import { UserStore, type IUser } from '@/stores'

interface Role {
  title: string
  route: string
  text: string
  role: string
}

const roles:Role[] = [
  {
    title: 'Amministrazione',
    route: "/admin",
    text: "Gestione eventi, tavoli, lavoranti",
    role: "Admin"
  },
  {
    title: 'Cassa',
    route: "/checkout",
    text: "Gestione Cassa",
    role: "Checkout"
  },
  {
    title: 'Cameriere',
    route: "/waiter",
    text: "Inviare ordini al bar e alla cucina",
    role: "Waiter"
  },
  {
    title: 'Bar',
    route: "/bartender",
    text: "Preparazione bevande e nachos",
    role: "Bartender"
  },
  {
    title: 'Cucina',
    route: "/kitchen",
    text: "Preparazione piade e panini",
    role: "Cook"
  },
]

const emit = defineEmits(['reload'])

const user = defineModel<IUser>()

const filteredRole = computed(() => {
  return roles.filter(r => user.value?.roles?.includes(r.role))
})

onBeforeMount(() =>
  emit('reload')
)

</script>

<template>
  <v-container>
    <v-row>
      <v-col cols="12" md="4" v-for="role in filteredRole">
        <RouterLink :to="role.route">
          <v-card>
            <v-card-title>
              {{ role.title }}
            </v-card-title>
            <v-card-text>
              {{ role.text }}
            </v-card-text>
          </v-card>
        </RouterLink>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped></style>