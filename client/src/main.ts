import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from '@/router'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import '@mdi/font/css/materialdesignicons.css'
import '@fontsource/federo/400.css'
import { light, dark, applyBrandColors } from './plugins/theme'
import { appConfig, loadConfig } from './composables/useConfig'
import { aliases, decoIconSet } from './plugins/icons'
import Confirm from './components/Confirm.vue'
import NoEvent from './components/NoEvent.vue'
import { it } from 'vuetify/locale'
import VueKonva from 'vue-konva'

async function bootstrap() {
    // Branding and active functions are needed before the first render
    await loadConfig()
    // Copies: the definitions in plugins/theme stay the defaults, to restore them
    const themes = { light: structuredClone(light), dark: structuredClone(dark) }
    applyBrandColors(themes, appConfig.value.colors)

    const vuetify = createVuetify({
        components,
        directives,
        icons: {
          defaultSet: 'mdi',
          aliases,
          sets: { mdi: decoIconSet },
        },
        theme: {
          defaultTheme: 'light',
          themes,
        },
        locale: {
          locale: 'it',
          messages: {
            it
          }
        }
      })

    const app = createApp(App)
    const pinia = createPinia()

    app.use(pinia)
    app.use(router)
    app.use(vuetify)
    app.use(VueKonva)
    app.component("Confirm", Confirm)
    app.component("NoEvent", NoEvent)

    const { sentry, slug, name } = appConfig.value
    if (sentry) {
        // Loaded only where error reporting is configured
        const Sentry = await import('@sentry/vue')
        Sentry.init({
            app, dsn: sentry.dsn, environment: sentry.environment, release: sentry.release,
            // Sentry 11 collects user data by default: opt out explicitly
            dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
        })
        Sentry.setTag('client', slug || name || 'unknown')
    }

    app.mount('#app')
}

bootstrap()
