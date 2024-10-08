<script setup lang="ts">
const dialog = defineModel({ default: false })
</script>

<template>
    <v-dialog v-model="dialog" max-width="350px">
        <v-card>
            <v-card-text>
                Sei sicuro di voler procedere?
            </v-card-text>

            <v-divider></v-divider>

            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn text="Annulla" variant="plain" @click="dialog = false"></v-btn>
                <template v-slot:action>
                    <slot></slot>
                </template>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>