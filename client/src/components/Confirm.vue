<script setup lang="ts">
const dialog = defineModel({ default: false })
const props = defineProps(['text'])
</script>

<template>
    <v-dialog v-model="dialog" max-width="350px">
        <v-card>
            <v-card-text v-if="props.text">{{ props.text }}</v-card-text>
            <v-card-text v-else>
                Sei sicuro di voler procedere?
            </v-card-text>

            <v-divider></v-divider>

            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn text="Annulla" variant="plain" @click="dialog = false"></v-btn>
                <slot name="action"></slot>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>