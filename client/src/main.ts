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
import { light, dark } from './plugins/theme'
import Confirm from './components/Confirm.vue'
import NoEvent from './components/NoEvent.vue'
import { it } from 'vuetify/locale'
import VueKonva from 'vue-konva'

const vuetify = createVuetify({
    components,
    directives,
    icons: {
      defaultSet: 'mdi'
    },
    theme: {
      defaultTheme: 'light',
      themes: { light, dark },
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

app.mount('#app')
