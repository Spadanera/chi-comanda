<script setup lang="ts">
import { ref, computed, onBeforeMount, onMounted } from 'vue'
import { type Destination, type User } from '../../../models/src'
import Axios from '@/services/client'
import { Roles } from '@/services/utils'

interface Role {
  title: string
  route: string
  text: string
  role: string | string[]
}

const axios = new Axios()

const roles = ref<Role[]>([
  {
    title: 'Amministrazione',
    route: "/admin",
    text: "Gestione eventi, tavoli, lavoranti",
    role: Roles.admin
  },
  {
    title: 'Cassa',
    route: "/checkout",
    text: "Gestione Cassa",
    role: Roles.checkout
  },
  {
    title: 'Cameriere',
    route: "/waiter",
    text: "Inviare ordini al bar e alla cucina",
    role: Roles.waiter
  },
  {
    title: 'Gestione Tavoli',
    route: "/tables",
    text: "Modifica la struttura dei tavoli all'interno dell'evento",
    role: [Roles.waiter, Roles.checkout]
  }
])

const emit = defineEmits(['login', 'reload'])

const user = defineModel<User>()

const filteredRole = computed(() => {
  if (user.value?.roles?.includes(Roles.superuser)) {
    return roles.value
  }
  return roles.value.filter(r => {
    const userRoles = user.value?.roles ?? [];
    const roleList = Array.isArray(r.role) ? r.role : [r.role];
    return roleList.some(role => userRoles.includes(role));
  });
})

onMounted(async () => {
  const destinations = await axios.GetDestinations()
  roles.value.push(...(destinations.map((d: Destination) => {
    return {
      title: d.name,
      route: `/bartender/${[d.id]}/${d.name}/${d.minute_to_alert}`,
      text: "Preparazione delle comande",
      role: [Roles.bartender, Roles.waiter]
    } as Role
  })))
})

onBeforeMount(() => {
  emit('reload')
})

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