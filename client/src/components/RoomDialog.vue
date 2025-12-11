<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import type { Room } from '../../../models/src'
import { requiredRule, positiveIntegerRule } from '@/services/utils'

const props = defineProps<{
  modelValue: boolean
  room: Room
  isEditing: boolean
}>()

const emit = defineEmits<{(e: 'update:modelValue', value: boolean): void
  (e: 'save', room: Room): void
}>()

const formRef = ref<any>(null)
const localRoom = reactive<Room>({ ...props.room })

watch(() => props.room, (newVal) => {
  Object.assign(localRoom, newVal)
}, { deep: true })

const close = () => {
  emit('update:modelValue', false)
}

const save = async () => {
  const { valid } = await formRef.value?.validate()
  if (valid) {
    emit('save', { ...localRoom })
    close()
  }
}
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" max-width="400">
    <v-card>
      <v-card-title>{{ isEditing ? 'Modifica Sala' : 'Nuova Sala' }}</v-card-title>
      <v-card-text>
        <v-form @submit.prevent="save" ref="formRef">
          <v-text-field 
            v-model="localRoom.name" 
            :rules="[requiredRule]" 
            label="Nome Sala"
            autofocus
          ></v-text-field>
          <v-row>
            <v-col cols="6">
              <v-text-field 
                v-model.number="localRoom.width"
                :rules="[requiredRule, positiveIntegerRule]" 
                type="number" 
                suffix="m"
                label="Larghezza"
              ></v-text-field>
            </v-col>
            <v-col cols="6">
              <v-text-field 
                v-model.number="localRoom.height"
                :rules="[requiredRule, positiveIntegerRule]" 
                type="number" 
                suffix="m"
                label="Altezza"
              ></v-text-field>
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="grey" variant="text" @click="close">Annulla</v-btn>
        <v-btn color="primary" @click="save">Salva</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>