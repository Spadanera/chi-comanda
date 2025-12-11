<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import type { MasterTable } from '../../../models/src'
import { requiredRule, positiveIntegerRule } from '@/services/utils'

const props = defineProps<{
  modelValue: boolean
  table: MasterTable
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', table: MasterTable): void
  (e: 'delete', tableId: number): void
}>()

const formRef = ref<any>(null)
const localTable = reactive<MasterTable>({ 
    name: '', default_seats: 0, x: 0, y: 0, width: 0, height: 0, shape: 'rect', ...props.table 
} as MasterTable)

watch(() => props.table, (newVal) => {
    if(newVal) Object.assign(localTable, newVal)
}, { deep: true })

const close = () => {
  emit('update:modelValue', false)
}

const save = async () => {
  const { valid } = await formRef.value?.validate()
  if (valid) {
    emit('save', { ...localTable })
    close()
  }
}

const remove = () => {
    if (localTable.id) {
        emit('delete', localTable.id)
    }
}
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" max-width="400">
    <v-card>
      <v-card-title>Configura Tavolo</v-card-title>
      <v-card-text>
        <v-form @submit.prevent ref="formRef">
          <v-text-field 
            v-model="localTable.master_table_name" 
            label="Etichetta" 
            :rules="[requiredRule]"
            autofocus
          ></v-text-field>
          <v-text-field 
            v-model.number="localTable.default_seats"
            :rules="[requiredRule, positiveIntegerRule]" 
            type="number" 
            label="Posti"
          ></v-text-field>
          <v-row>
            <v-col cols="6">
              <v-text-field 
                v-model.number="localTable.width"
                :rules="[requiredRule, positiveIntegerRule]" 
                type="number" 
                suffix="cm"
                label="Larghezza"
              ></v-text-field>
            </v-col>
            <v-col cols="6">
              <v-text-field 
                v-model.number="localTable.height"
                :rules="[requiredRule, positiveIntegerRule]" 
                type="number" 
                suffix="cm"
                label="Altezza"
              ></v-text-field>
            </v-col>
            <v-col cols="12">
                <v-select 
                    label="Forma" 
                    :rules="[requiredRule]"
                    :items="[{ title: 'Rettangolare', value: 'rect' }, { title: 'Ovale', value: 'circle' }]"
                    v-model="localTable.shape"
                ></v-select>
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-btn color="error" variant="text" @click="remove">Elimina</v-btn>
        <v-spacer></v-spacer>
        <v-btn color="grey" variant="text" @click="close">Annulla</v-btn>
        <v-btn color="primary" @click="save">OK</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>