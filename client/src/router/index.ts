import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/Home.vue'
import { UserStore, SnackbarStore } from '@/stores'
import { hasAnyRole, Roles } from '@/services/utils'
import api from '@/services/client'
import { isFeatureEnabled } from '@/composables/useConfig'
import type { Feature } from '../../../models/src'

declare module 'vue-router' {
  interface RouteMeta {
    /** Roles allowed to open the route (superuser always is). */
    allowedRole?: Roles | Roles[]
    /** Function the route belongs to: switched off on this installation, the route doesn't exist. */
    feature?: Feature
  }
}

const publicRoutes = ['Login', 'Reset', 'Invitation', 'AskReset']

/** Screens that work without a venue: everything else needs one chosen first. */
const venueFreeRoutes = ['Locale', 'Piattaforma', 'Profilo']

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
      name: 'Amministazione',
      component: () => import('@/views/Admin.vue'),
      props: true,
      meta: {
        allowedRole: Roles.admin
      },
      children: [
        {
          path: "",
          name: "Eventi",
          component: () => import('@/views/admin/Events.vue'),
          props: true,
          meta: {
            allowedRole: Roles.admin
          },
        },
        {
          path: "users",
          name: "Utenti",
          component: () => import('@/views/admin/Users.vue'),
          props: true,
          meta: {
            allowedRole: Roles.admin
          },
        },
        {
          path: "tables",
          name: "Tavoli",
          component: () => import('@/views/admin/Tables.vue'),
          props: true,
          meta: {
            allowedRole: Roles.admin
          },
        },
        {
          path: "items/:menu_id/:menu_name",
          name: "items",
          component: () => import('@/views/admin/Items.vue'),
          props: true,
          meta: {
            allowedRole: Roles.admin
          },
        },
        {
          path: "menu",
          name: "Menu",
          component: () => import('@/views/admin/Menu.vue'),
          props: true,
          meta: {
            allowedRole: Roles.admin
          },
        },
        {
          path: "destinations",
          name: "Destinazioni",
          component: () => import('@/views/admin/Destinations.vue'),
          props: true,
          meta: {
            allowedRole: Roles.admin
          },
        },
        {
          path: "audit",
          name: "Audit",
          component: () => import('@/views/admin/Audit.vue'),
          props: true,
          meta: {
            allowedRole: Roles.superuser
          },
        },
        {
          path: "payments",
          name: "Pagamenti",
          component: () => import('@/views/admin/Payments.vue'),
          props: true,
          meta: {
            allowedRole: Roles.admin,
            feature: 'payments'
          },
        },
        {
          path: "settings",
          name: "Impostazioni",
          component: () => import('@/views/admin/Settings.vue'),
          props: true,
          meta: {
            allowedRole: Roles.admin
          },
        }
      ]
    },
    {
      path: '/waiter',
      name: 'Cameriere',
      component: () => import('@/views/Waiter.vue'),
      props: true,
      meta: {
        allowedRole: [Roles.waiter, Roles.checkout, Roles.bartender]
      }
    },
    {
      path: '/waiter/:event_id/mastertable/:master_table_id/table/:table_id/menu/:menu_id',
      name: 'Completa Ordine',
      component: () => import('@/views/WaiterOrder.vue'),
      props: true,
      meta: {
        allowedRole: [Roles.waiter, Roles.checkout, Roles.bartender]
      }
    },
    {
      path: '/bartender/:destinations/:pagetitle/:minutetoalert',
      name: 'Bartender',
      component: () => import('@/views/BarTender.vue'),
      props: true,
      meta: {
        allowedRole: [Roles.bartender, Roles.waiter]
      }
    },
    {
      path: '/checkout',
      name: 'Cassa',
      component: () => import('@/views/Checkout.vue'),
      props: true,
      meta: {
        allowedRole: Roles.checkout
      }
    },
    {
      path: '/tables',
      name: 'Gestione Tavoli',
      component: () => import('@/views/Tables.vue'),
      props: true,
      meta: {
        allowedRole: [Roles.checkout, Roles.waiter]
      }
    },
    {
      path: '/locale',
      name: 'Locale',
      component: () => import('@/views/VenueChoice.vue'),
      props: true
    },
    {
      path: '/platform',
      name: 'Piattaforma',
      component: () => import('@/views/Platform.vue'),
      props: true,
      meta: {
        allowedRole: Roles.superuser
      }
    },
    {
      path: '/profile',
      name: 'Profilo',
      component: () => import('@/views/Profile.vue'),
      props: true
    },
    // Unknown addresses (old bookmarks, the removed /landing): home, or login when not signed in
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'Home' }
    },
  ]
})

router.beforeEach(async (to) => {
  const snackbarStore = SnackbarStore()
  const userStore = UserStore()

  const user = userStore.user.id ? userStore.user : await userStore.checkAuthentication()
  const isPublic = publicRoutes.includes(to.name?.toString() || '')

  if (to.meta.feature && !isFeatureEnabled(to.meta.feature)) {
    return { name: 'Home' }
  }
  if (user.id && to.name === 'Login') {
    return { name: 'Home' }
  }
  if (!user.id && !isPublic) {
    snackbarStore.show('Sessione scaduta')
    return { name: 'Login' }
  }
  // A link to another venue (e.g. a push notification): switch to it when the user works there
  const wanted = Number(to.query.venue)
  if (user.id && wanted && !isPublic) {
    const { venue: _, ...query } = to.query
    if (wanted !== user.venueId && user.venues.some(v => v.id === wanted)) {
      await api.SwitchVenue(wanted)
    }
    return { path: to.path, query, hash: to.hash }
  }
  if (user.id && !user.venueId && !isPublic && !venueFreeRoutes.includes(to.name?.toString() || '')) {
    return { name: 'Locale', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
  }
  if (to.meta.allowedRole && !hasAnyRole(user.roles, to.meta.allowedRole)) {
    snackbarStore.show('Non sei autorizzato a visualizzare questa sezione', 3000, 'top', 'error')
    return { name: 'Home' }
  }
})

export default router
