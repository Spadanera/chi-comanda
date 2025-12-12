<script setup lang="ts">
import { ref, onMounted } from "vue"
import { RouterLink, RouterView } from 'vue-router'
import { type User } from '../../../models/src'

defineOptions({ inheritAttrs: false })

interface NavigationItem {
  title: string
  prependIcon: string
  to: string,
  value: number
}

const emit = defineEmits(['login', 'reload'])
const user = defineModel<User>()

const drawer = ref<boolean>()
const selectedItem = ref<number[]>([0])
const navigationItems = ref<NavigationItem[]>([
  {
    title: "Eventi",
    prependIcon: "mdi-calendar",
    to: "",
    value: 0
  },
  {
    title: "Tavoli",
    prependIcon: "mdi-table-furniture",
    to: "tables",
    value: 1
  },
  {
    title: "Menu",
    prependIcon: "mdi-menu",
    to: "menu",
    value: 2
  },
  {
    title: "Destinazioni",
    prependIcon: "mdi-send-check",
    to: "destinations",
    value: 3
  }

])

onMounted(() => {
  try {
    if (user.value?.roles?.includes('superuser')) {
      navigationItems.value.push({
        title: "Utenti",
        prependIcon: "mdi-account-group",
        to: "users",
        value: 4
      })
      navigationItems.value.push({
        title: "Audit",
        prependIcon: "mdi-police-badge",
        to: "audit",
        value: 5
      })
    }

    // Logica ottimizzata per evitare crash su regex falliti
    if (/\/items\//.test(window.location.pathname)) {
      selectedItem.value = [navigationItems.value[2].value]
    }
    else {
      const match = /\/admin\/?(\w*)/.exec(window.location.pathname)
      if (match && match[1] !== undefined) {
        const found = navigationItems.value.find(n => n.to === match[1])
        if (found) {
          selectedItem.value = [found.value]
        }
      }
    }
  } catch (error) {
    // Silent fail safe
  }
})

</script>

<template>
  <v-navigation-drawer v-model="drawer" mobile-breakpoint="sm" width="150">
    <v-list nav v-model:selected="selectedItem">
      <RouterLink :to="`/admin/${item.to}`" v-for="item in navigationItems" :key="item.value"
        style="text-decoration: none; color: inherit;">
        <v-list-item :prepend-icon="item.prependIcon" :title="item.title" :value="item.value" rounded="0"></v-list-item>
      </RouterLink>
    </v-list>
  </v-navigation-drawer>
  <RouterView></RouterView>
  <v-fab v-show="!drawer" class="hide-xs" icon="mdi-menu" app style="position: fixed; left: 10px; bottom: 10px;"
    location="bottom left" @click="drawer = !drawer"></v-fab>
</template>

<style scoped>
.v-list {
  padding: 0 !important
}
</style>