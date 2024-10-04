import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from '@/router'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import Client from '@/services/client'

const vuetify = createVuetify({
    components,
    directives,
  })

const app = createApp(App)

app.config.globalProperties.$client = new Client()

app.use(router)
app.use(vuetify)

app.mount('#app')
