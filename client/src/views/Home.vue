<script setup lang="ts">
const roles = [
  {
    title: 'Amministrazione',
    route: "/admin",
    text: "Gestione eventi, tavoli, lavoranti"
  },
  {
    title: 'Cassa',
    route: "/checkout",
    text: "Gestione Cass"
  },
  {
    title: 'Bar',
    route: "/bartender",
    text: "Preparazione bevande e nachos"
  },
  {
    title: 'Cucina',
    route: "/ciao",
    text: "Preparazione piade e panini"
  },
  {
    title: 'Cameriere',
    route: "/waiter",
    text: "Inviare ordini al bar e alla cucina"
  },
]
</script>

<template>
  <v-container>
    <v-row>
      <v-col cols="12" md="4" v-for="role in roles">
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