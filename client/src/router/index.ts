import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/Home.vue'
import { UserStore, SnackbarStore } from '@/stores'
import { Roles } from '../../../models/src'

const publicRoute:String[] = ['Login', 'Reset', 'Invitation', 'AskReset']

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
      path: '/askreset',
      name: 'AskReset',
      component: () => import('@/views/AskReset.vue'),
      props: true
    },
    {
      path: '/reset/:token',
      name: 'Reset',
      component: () => import('@/views/Reset.vue'),
      props: true
    },
    {
      path: '/invitation/:token',
      name: 'Invitation',
      component: () => import('@/views/Invitation.vue'),
      props: true
    },
    {
      path: '/admin',
      name: 'Admin',
      component: () => import('@/views/Admin.vue'),
      props: true,
      meta: {
        allowedRole: Roles.admin
      },
      children: [
        {
          path: "",
          name: "events",
          component: () => import('@/views/admin/Events.vue'),
          props: true,
          meta: {
            allowedRole: Roles.admin
          },
        },
        {
          path: "users",
          name: "users",
          component: () => import('@/views/admin/Users.vue'),
          props: true,
          meta: {
            allowedRole: Roles.superuser
          },
        },
        {
          path: "tables",
          name: "tables",
          component: () => import('@/views/admin/Tables.vue'),
          props: true,
          meta: {
            allowedRole: Roles.admin
          },
        },
        {
          path: "items",
          name: "items",
          component: () => import('@/views/admin/Items.vue'),
          props: true,
          meta: {
            allowedRole: Roles.admin
          },
        },
        {
          path: "destinations",
          name: "destinations",
          component: () => import('@/views/admin/Destinations.vue'),
          props: true,
          meta: {
            allowedRole: Roles.admin
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
        allowedRole: Roles.waiter
      }
    },
    {
      path: '/waiter/:event_id/order/:master_table_id/table/:table_id',
      name: 'Waiter Order',
      component: () => import('@/views/WaiterOrder.vue'),
      props: true,
      meta: {
        allowedRole: Roles.waiter
      }
    },
    {
      path: '/bartender/:destinations/:pagetitle',
      name: 'Bartender',
      component: () => import('@/views/BarTender.vue'),
      props: true,
      meta: {
        allowedRole: Roles.bartender
      }
    },
    {
      path: '/checkout',
      name: 'Checkout',
      component: () => import('@/views/Checkout.vue'),
      props: true,
      meta: {
        allowedRole: Roles.checkout
      }
    },
  ]
})

router.beforeEach(async (to, from, next) => {
  const snackbarStore = SnackbarStore()
  const userStore = UserStore()
  
  const user = userStore.user.id ? userStore.user : await userStore.checkAuthentication()
  if (user.id && to.name === 'Login') {
    next({ name: "Home" })
  }
  else if (user.id || publicRoute.includes(to.name?.toString())) {
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
