<script setup lang="ts">
import { computed, ref } from 'vue'
import Confirm from './Confirm.vue'
import { discard, flush, myQueue, outboxDialog, outboxPersistent, retry, venueQueue, type QueuedOrder } from '@/services/outbox'

const otherVenues = computed(() => myQueue.value.length - venueQueue.value.length)
const toDiscard = ref<QueuedOrder>()
const confirmDiscard = computed({
    get: () => !!toDiscard.value,
    set: value => { if (!value) toDiscard.value = undefined },
})

function time(entry: QueuedOrder) {
    return new Date(entry.createdAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

function summary(entry: QueuedOrder) {
    const count = entry.order.items?.length || 0
    return `${count} ${count === 1 ? 'prodotto' : 'prodotti'} · ${time(entry)}`
}

async function confirmedDiscard() {
    if (toDiscard.value) await discard(toDiscard.value.key)
    toDiscard.value = undefined
}
</script>

<template>
    <v-dialog v-model="outboxDialog" scrollable max-width="600px">
        <v-card title="Ordini in attesa di invio" prepend-icon="mdi-cloud-upload-outline">
            <v-divider></v-divider>
            <v-card-text style="padding: 0;">
                <v-alert v-if="!outboxPersistent" type="warning" variant="tonal" class="ma-2" density="compact">
                    Questo browser non permette di salvare gli ordini: non chiudere la pagina finché non sono partiti.
                </v-alert>
                <v-list lines="two" v-if="venueQueue.length">
                    <v-list-item v-for="entry in venueQueue" :key="entry.key"
                        :title="entry.order.table_name || 'Tavolo'" :subtitle="summary(entry)">
                        <div class="mt-1">
                            <v-chip v-if="entry.status === 'failed'" color="error" size="small" label>
                                Non accettato: {{ entry.error }}
                            </v-chip>
                            <v-chip v-else-if="entry.status === 'sending'" color="info" size="small" label>
                                Invio in corso…
                            </v-chip>
                            <v-chip v-else color="warning" size="small" label>In attesa di invio</v-chip>
                        </div>
                        <template v-slot:append>
                            <v-btn v-if="entry.status === 'failed'" icon="mdi-refresh" variant="text" title="Riprova"
                                @click="retry(entry.key)"></v-btn>
                            <v-btn icon="mdi-delete-outline" variant="text" title="Scarta" @click="toDiscard = entry"></v-btn>
                        </template>
                    </v-list-item>
                </v-list>
                <p v-else class="pa-4">Nessun ordine in attesa in questo locale.</p>
                <p v-if="otherVenues" class="px-4 pb-4 text-caption">
                    {{ otherVenues === 1 ? 'Un altro ordine aspetta' : `Altri ${otherVenues} ordini aspettano` }} in un altro
                    locale: {{ otherVenues === 1 ? 'partirà' : 'partiranno' }} quando ci tornerai.
                </p>
            </v-card-text>
            <v-divider></v-divider>
            <v-card-actions>
                <v-btn variant="plain" @click="outboxDialog = false">CHIUDI</v-btn>
                <v-spacer></v-spacer>
                <v-btn variant="plain" @click="flush()" :disabled="!venueQueue.some(e => e.status === 'pending')">INVIA ORA</v-btn>
            </v-card-actions>
        </v-card>
        <Confirm v-model="confirmDiscard"
            :text="`Scartare l'ordine per ${toDiscard?.order.table_name || 'il tavolo'}? Non verrà mai inviato.`">
            <template v-slot:action>
                <v-btn text="Scarta" color="error" variant="plain" @click="confirmedDiscard"></v-btn>
            </template>
        </Confirm>
    </v-dialog>
</template>
