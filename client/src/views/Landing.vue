<script setup lang="ts">
import { RouterLink } from 'vue-router'
import Logo from '@/components/Logo.vue'
import { ThemeStore } from '@/stores'

const themeStore = ThemeStore()

const features = [
  {
    icon: 'mdi-table-chair',
    title: 'Gestione Tavoli',
    description: 'Mappa visiva dei tavoli in tempo reale. Apri, chiudi e trasferisci tavoli con un tocco.'
  },
  {
    icon: 'mdi-receipt-text-send',
    title: 'Ordini Istantanei',
    description: 'I camerieri inviano ordini dal telefono direttamente al bar e alla cucina, senza carta e senza errori.'
  },
  {
    icon: 'mdi-lightning-bolt',
    title: 'Tempo Reale',
    description: 'Ogni aggiornamento è visibile a tutti i ruoli simultaneamente tramite WebSocket.'
  },
  {
    icon: 'mdi-cash-register',
    title: 'Cassa Integrata',
    description: 'La cassa vede i consumi per tavolo, gestisce i pagamenti parziali e applica sconti.'
  },
  {
    icon: 'mdi-account-multiple',
    title: 'Multi-Ruolo',
    description: 'Cameriere, bartender, cassa e amministratore: ogni ruolo vede solo ciò che gli serve.'
  },
  {
    icon: 'mdi-message-fast',
    title: 'Broadcast',
    description: 'Invia messaggi istantanei a tutto il personale durante l\'evento, con notifica sonora.'
  },
]

const steps = [
  { number: '01', title: 'Crea l\'evento', description: 'Configura menu, tavoli e assegna il personale.' },
  { number: '02', title: 'Avvia la serata', description: 'Attiva l\'evento: i tavoli diventano operativi.' },
  { number: '03', title: 'Lavora in tempo reale', description: 'Ordini, preparazioni e pagamenti fluiscono senza attriti.' },
  { number: '04', title: 'Chiudi e analizza', description: 'Chiudi l\'evento e consulta il riepilogo ricavi per tavolo.' },
]
</script>

<template>
  <!-- Hero -->
  <v-sheet class="hero d-flex align-center" min-height="calc(100vh - 64px)">
    <v-container>
      <v-row align="center" justify="center">
        <v-col cols="12" md="6" class="text-center text-md-left">
          <v-chip color="primary" variant="tonal" class="mb-4" label>
            Gestionale per eventi bar & ristorazione
          </v-chip>
          <h1 class="text-h3 text-sm-h2 font-weight-black mb-4" style="line-height: 1.15;">
            La serata scorre,<br>
            <span class="text-primary">tu hai il controllo.</span>
          </h1>
          <p class="text-body-1 text-medium-emphasis mb-8" style="max-width: 480px;">
            Chi Comanda connette camerieri, bartender e cassa in tempo reale.
            Niente carta, niente confusione. Solo ordini che arrivano dove devono arrivare.
          </p>
          <div class="d-flex flex-wrap gap-3">
            <RouterLink to="/login" style="text-decoration: none;">
              <v-btn color="primary" size="large" rounded="pill" prepend-icon="mdi-arrow-right">
                Inizia ora
              </v-btn>
            </RouterLink>
            <v-btn size="large" rounded="pill" variant="outlined" href="#features">
              Scopri le funzioni
            </v-btn>
          </div>
        </v-col>
        <v-col cols="12" md="5" class="text-center d-none d-md-flex justify-center">
          <Logo />
        </v-col>
      </v-row>
    </v-container>
  </v-sheet>

  <!-- Features -->
  <v-container id="features" class="py-16">
    <v-row justify="center" class="mb-10">
      <v-col cols="12" class="text-center">
        <p class="text-overline text-primary mb-2">Funzionalità</p>
        <h2 class="text-h4 font-weight-bold">Tutto ciò che serve in una serata</h2>
      </v-col>
    </v-row>
    <v-row>
      <v-col v-for="feature in features" :key="feature.title" cols="12" sm="6" lg="4">
        <v-card flat border rounded="xl" height="100%" class="pa-2">
          <v-card-text>
            <v-avatar color="primary" variant="tonal" size="48" class="mb-4">
              <v-icon :icon="feature.icon" size="24"></v-icon>
            </v-avatar>
            <div class="text-subtitle-1 font-weight-bold mb-2">{{ feature.title }}</div>
            <div class="text-body-2 text-medium-emphasis">{{ feature.description }}</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>

  <!-- How it works -->
  <v-sheet color="surface-variant">
    <v-container class="py-16">
      <v-row justify="center" class="mb-10">
        <v-col cols="12" class="text-center">
          <p class="text-overline text-primary mb-2">Come funziona</p>
          <h2 class="text-h4 font-weight-bold">Quattro passi, una serata perfetta</h2>
        </v-col>
      </v-row>
      <v-row justify="center">
        <v-col v-for="step in steps" :key="step.number" cols="12" sm="6" md="3" class="text-center">
          <div class="text-h3 font-weight-black text-primary mb-2" style="opacity: 0.25;">
            {{ step.number }}
          </div>
          <div class="text-subtitle-1 font-weight-bold mb-2">{{ step.title }}</div>
          <div class="text-body-2 text-medium-emphasis">{{ step.description }}</div>
        </v-col>
      </v-row>
    </v-container>
  </v-sheet>

  <!-- Roles -->
  <v-container class="py-16">
    <v-row justify="center" class="mb-10">
      <v-col cols="12" class="text-center">
        <p class="text-overline text-primary mb-2">Ruoli</p>
        <h2 class="text-h4 font-weight-bold">Ognuno vede la sua schermata</h2>
      </v-col>
    </v-row>
    <v-row justify="center">
      <v-col cols="12" sm="6" md="3" v-for="role in [
        { icon: 'mdi-walk', label: 'Cameriere', desc: 'Prende ordini al tavolo dal suo telefono.' },
        { icon: 'mdi-glass-cocktail', label: 'Bartender', desc: 'Vede gli ordini arrivare in tempo reale e li segna come completati.' },
        { icon: 'mdi-cash-register', label: 'Cassa', desc: 'Gestisce i pagamenti, gli sconti e chiude i tavoli.' },
        { icon: 'mdi-shield-crown', label: 'Admin', desc: 'Configura eventi, menu, tavoli e utenti.' },
      ]" :key="role.label">
        <v-card flat border rounded="xl" class="text-center pa-4" height="100%">
          <v-icon :icon="role.icon" size="40" color="primary" class="mb-3"></v-icon>
          <div class="text-subtitle-1 font-weight-bold mb-1">{{ role.label }}</div>
          <div class="text-body-2 text-medium-emphasis">{{ role.desc }}</div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>

  <!-- CTA -->
  <v-sheet color="primary">
    <v-container class="py-16 text-center">
      <h2 class="text-h4 font-weight-black mb-4 text-on-primary">
        Pronto per la prossima serata?
      </h2>
      <p class="text-body-1 mb-8 text-on-primary" style="opacity: 0.85;">
        Accedi e inizia a gestire eventi, menu e ordini in pochi minuti.
      </p>
      <RouterLink to="/login" style="text-decoration: none;">
        <v-btn size="large" rounded="pill" color="white" variant="flat" prepend-icon="mdi-arrow-right">
          <span class="text-primary font-weight-bold">Accedi</span>
        </v-btn>
      </RouterLink>
    </v-container>
  </v-sheet>

  <!-- Footer -->
  <v-sheet border="t">
    <v-container class="py-6">
      <v-row align="center" justify="space-between">
        <v-col cols="auto">
          <span class="text-caption text-medium-emphasis">© {{ new Date().getFullYear() }} Chi Comanda</span>
        </v-col>
        <v-col cols="auto">
          <RouterLink to="/login" class="text-caption text-medium-emphasis" style="text-decoration: none;">
            Accedi
          </RouterLink>
        </v-col>
      </v-row>
    </v-container>
  </v-sheet>
</template>

<style scoped>
.hero {
  background: radial-gradient(ellipse at 70% 50%, rgb(var(--v-theme-primary), 0.08) 0%, transparent 70%);
}

.gap-3 {
  gap: 12px;
}
</style>
