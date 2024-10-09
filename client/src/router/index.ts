import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/Home.vue'
import { UserStore, SnackbarStore } from '@/stores'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: Home,
      props: true,
      meta: {
        allowedRole: 'admin'
      }
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
      props: true,
      meta: {
        allowedRole: 'admin'
      },
      children: [
        {
          path: "",
          name: "events",
          component: () => import('@/views/admin/Events.vue'),
          props: true,
          meta: {
            allowedRole: 'admin'
          },
        },
        {
          path: "users",
          name: "users",
          component: () => import('@/views/admin/Users.vue'),
          props: true,
          meta: {
            allowedRole: 'admin'
          },
        },
        {
          path: "tables",
          name: "tables",
          component: () => import('@/views/admin/Tables.vue'),
          props: true,
          meta: {
            allowedRole: 'admin'
          },
        },
        {
          path: "items",
          name: "items",
          component: () => import('@/views/admin/Items.vue'),
          props: true,
          meta: {
            allowedRole: 'admin'
          },
        }
      ]
    },
    {
      path: '/waiter',
      name: 'Waiter',
      component: () => import('@/views/Waiter.vue'),
      props: true,
      meta: {
        allowedRole: 'waiter'
      }
    },
    {
      path: '/waiter/:event_id/order/:master_table_id/table/:table_id',
      name: 'Waiter Order',
      component: () => import('@/views/WaiterOrder.vue'),
      props: true,
      meta: {
        allowedRole: 'waiter'
      }
    },
    {
      path: '/bartender',
      name: 'Bartender',
      component: () => import('@/views/BarTender.vue'),
      props: {
        destinations: '[1, 2]'
      },
      meta: {
        allowedRole: 'bartender'
      }
    },
    {
      path: '/kitchen',
      name: 'Kitchen',
      component: () => import('@/views/BarTender.vue'),
      props: {
        destinations: '[3]'
      },
      meta: {
        allowedRole: 'kitchen'
      }
    },
    {
      path: '/checkout',
      name: 'Checkout',
      component: () => import('@/views/Checkout.vue'),
      props: true,
      meta: {
        allowedRole: 'checkout'
      }
    },
  ]
})

router.beforeEach(async (to, from, next) => {
  const snackbarStore = SnackbarStore()
  const userStore = UserStore()
  const user = await userStore.checkAuthentication()
  if (user.id && to.name === 'Login') {
    next({ name: "Home" })
  }
  else if (user.id || to.name === 'Login') {
    if (to.meta.allowedRole) {
      if (user.roles.includes(to.meta.allowedRole)) {
        next()
      } else {
        snackbarStore.show("Non sei autorizzato a visualizzare questa sezione", 3000, 'top', 'error')
        next({ name: 'Home' })
      }
    }
    else {
      next()
    }
  }
  else {
    snackbarStore.show("Sessione scaduta")
    next({ name: 'Login' })
  }
})

export default router
