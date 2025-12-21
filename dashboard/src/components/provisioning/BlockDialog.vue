<script setup lang="ts">
import { ref } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import Textarea from 'primevue/textarea'
import type { Sim, BlockReason } from '@/types/sim'

defineProps<{
  sim: Sim | null
  visible: boolean
  loading: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'confirm': [reason: BlockReason, notes: string]
}>()

const selectedReason = ref<BlockReason | null>(null)
const notes = ref('')

const reasonOptions: { label: string; value: BlockReason }[] = [
  { label: 'Usage Threshold Exceeded', value: 'USAGE_THRESHOLD_EXCEEDED' },
  { label: 'Fraud Suspected', value: 'FRAUD_SUSPECTED' },
  { label: 'Billing Issue', value: 'BILLING_ISSUE' },
  { label: 'Customer Request', value: 'CUSTOMER_REQUEST' },
  { label: 'Policy Violation', value: 'POLICY_VIOLATION' },
  { label: 'Manual', value: 'MANUAL' }
]

const confirm = () => {
  if (selectedReason.value) {
    emit('confirm', selectedReason.value, notes.value)
  }
}

const close = () => {
  selectedReason.value = null
  notes.value = ''
  emit('update:visible', false)
}
</script>

<template>
  <Dialog
    :visible="visible"
    @update:visible="emit('update:visible', $event)"
    header="Block SIM"
    :modal="true"
    :closable="true"
    :style="{ width: '450px' }"
  >
    <div class="block-dialog">
      <p class="mb-4">
        You are about to block SIM: <strong class="font-mono">{{ sim?.iccid }}</strong>
      </p>

      <div class="field mb-4">
        <label for="reason" class="block text-900 font-medium mb-2">Block Reason *</label>
        <Dropdown
          v-model="selectedReason"
          :options="reasonOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Select a reason"
          class="w-full"
          id="reason"
        />
      </div>

      <div class="field">
        <label for="notes" class="block text-900 font-medium mb-2">Notes (optional)</label>
        <Textarea
          v-model="notes"
          id="notes"
          rows="3"
          class="w-full"
          placeholder="Add any additional notes..."
        />
      </div>
    </div>

    <template #footer>
      <Button label="Cancel" severity="secondary" @click="close" :disabled="loading" />
      <Button
        label="Block SIM"
        icon="pi pi-ban"
        severity="danger"
        @click="confirm"
        :loading="loading"
        :disabled="!selectedReason"
      />
    </template>
  </Dialog>
</template>
