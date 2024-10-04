import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/Home.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/Login.vue')
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/Admin.vue')
    },
    {
      path: '/waiter',
      name: 'waiter',
      component: () => import('../views/Waiter.vue')
    },
    {
      path: '/bar-tender',
      name: 'bar-tender',
      component: () => import('../views/BarTender.vue')
    },
    {
      path: '/checkout',
      name: 'checkout',
      component: () => import('../views/Checkout.vue')
    }
  ]
})

export default router
