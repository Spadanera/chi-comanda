import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/Home.vue'
import { UserStore } from '@/stores'
import { provide } from 'vue'

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
      component: () => import('../views/Login.vue'),
      props: true
    },
    {
      path: '/admin',
      name: 'Admin',
      component: () => import('../views/Admin.vue'),
      props: true
    },
    {
      path: '/waiter',
      name: 'Waiter',
      component: () => import('../views/Waiter.vue'),
      props: true
    },
    {
      path: '/bartender',
      name: 'Bartender',
      component: () => import('../views/BarTender.vue'),
      props: true
    },
    {
      path: '/checkout',
      name: 'Checkout',
      component: () => import('../views/Checkout.vue'),
      props: true
    }
  ]
})

router.beforeEach(async (to, from, next) => {
  const userStore = UserStore()
  const user = await userStore.checkAuthentication()
  if (to.name !== "Login" && !user.isLoggedIn) {
    next({ name: "Login"})
  }
  else {
    next()
  }
})

export default router
