<script setup lang="ts">
import { ref } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import type { Sim } from '@/types/sim'

defineProps<{
  sim: Sim | null
  visible: boolean
  loading: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'confirm': [notes: string]
}>()

const notes = ref('')

const confirm = () => {
  emit('confirm', notes.value)
}

const close = () => {
  notes.value = ''
  emit('update:visible', false)
}
</script>

<template>
  <Dialog
    :visible="visible"
    @update:visible="emit('update:visible', $event)"
    header="Unblock SIM"
    :modal="true"
    :closable="true"
    :style="{ width: '450px' }"
  >
    <div class="unblock-dialog">
      <p class="mb-4">
        You are about to unblock SIM: <strong class="font-mono">{{ sim?.iccid }}</strong>
      </p>

      <div v-if="sim?.blockReason" class="mb-4 p-3 surface-100 border-round">
        <div class="text-500 text-sm mb-1">Previously blocked for:</div>
        <div class="text-red-600 font-semibold">{{ sim.blockReason }}</div>
      </div>

      <div class="field">
        <label for="notes" class="block text-900 font-medium mb-2">Unblock Notes (optional)</label>
        <Textarea
          v-model="notes"
          id="notes"
          rows="3"
          class="w-full"
          placeholder="Add any notes about the unblock..."
        />
      </div>
    </div>

    <template #footer>
      <Button label="Cancel" severity="secondary" @click="close" :disabled="loading" />
      <Button
        label="Unblock SIM"
        icon="pi pi-check-circle"
        severity="success"
        @click="confirm"
        :loading="loading"
      />
    </template>
  </Dialog>
</template>
