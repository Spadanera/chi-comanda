import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/Home.vue'
import { UserStore } from '@/stores'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: Home,
      props: true
    },
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/Login.vue'),
      props: true
    },
    {
      path: '/admin',
      name: 'Admin',
      component: () => import('@/views/Admin.vue'),
      props: true
    },
    {
      path: '/waiter',
      name: 'Waiter',
      component: () => import('@/views/Waiter.vue'),
      props: true
    },
    {
      path: '/bartender',
      name: 'Bartender',
      component: () => import('@/views/BarTender.vue'),
      props: {
        destinations: '[1, 2]'
      }
    },
    {
      path: '/kitchen',
      name: 'Kitchen',
      component: () => import('@/views/BarTender.vue'),
      props: {
        destinations: '[3]'
      }
    },
    {
      path: '/checkout',
      name: 'Checkout',
      component: () => import('@/views/Checkout.vue'),
      props: true
    },
    {
      path: '/event/:event_id/order/:master_table_id/table/:table_id',
      name: 'Waiter Order',
      component: () => import('@/views/WaiterOrder.vue'),
      props: true
    },
  ]
})

router.beforeEach(async (to, from, next) => {
  const userStore = UserStore()
  const user = await userStore.checkAuthentication()
  if (user.id && to.name === 'Login') {
    next({ name: "Home" })
  }
  else if (user.id || to.name === 'Login') {
    next()
  }
  else {
    next({ name: 'Login' })
  }
})

export default router
