<script setup>
import { ref } from 'vue'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Button from 'primevue/button'
import Chip from 'primevue/chip'

const props = defineProps({
  simPool: { type: Array, required: true }
})

const emit = defineEmits(['add-iccid', 'remove-iccid', 'generate-iccids', 'clear-pool'])

const newIccid = ref('')
const generateCount = ref(5)

const addIccid = () => {
  if (newIccid.value && newIccid.value.length >= 19) {
    emit('add-iccid', newIccid.value)
    newIccid.value = ''
  }
}

const handleKeyDown = (event) => {
  if (event.key === 'Enter') {
    addIccid()
  }
}

const truncateIccid = (iccid) => {
  if (iccid.length > 12) {
    return iccid.slice(0, 6) + '...' + iccid.slice(-6)
  }
  return iccid
}
</script>

<template>
  <Card class="sim-pool-manager">
    <template #title>
      <div class="flex align-items-center gap-2">
        <i class="pi pi-id-card"></i>
        <span>SIM Pool (ICCIDs)</span>
        <span class="text-500 text-sm font-normal ml-2">({{ simPool.length }})</span>
      </div>
    </template>
    <template #content>
      <!-- Add ICCID manually -->
      <div class="flex gap-2 mb-3">
        <InputText
          v-model="newIccid"
          placeholder="Enter ICCID (19-20 digits)"
          class="flex-1"
          @keydown="handleKeyDown"
        />
        <Button
          icon="pi pi-plus"
          label="Add"
          @click="addIccid"
          :disabled="!newIccid || newIccid.length < 19"
          outlined
        />
      </div>

      <!-- Generate random ICCIDs -->
      <div class="flex gap-2 mb-3">
        <InputNumber
          v-model="generateCount"
          :min="1"
          :max="50"
          showButtons
          buttonLayout="horizontal"
          class="w-8rem"
          decrementButtonClass="p-button-outlined"
          incrementButtonClass="p-button-outlined"
        />
        <Button
          icon="pi pi-bolt"
          label="Generate"
          @click="emit('generate-iccids', generateCount)"
          severity="secondary"
        />
        <Button
          icon="pi pi-trash"
          label="Clear All"
          @click="emit('clear-pool')"
          severity="danger"
          outlined
          :disabled="simPool.length === 0"
        />
      </div>

      <!-- ICCID chips -->
      <div class="iccid-chips">
        <Chip
          v-for="iccid in simPool"
          :key="iccid"
          :label="truncateIccid(iccid)"
          removable
          @remove="emit('remove-iccid', iccid)"
          v-tooltip="iccid"
          class="mb-2 mr-2"
        />
        <div v-if="simPool.length === 0" class="text-500 text-center p-3">
          No ICCIDs in pool. Add manually or generate random ones.
        </div>
      </div>
    </template>
  </Card>
</template>

<style scoped>
.sim-pool-manager :deep(.p-card-content) {
  padding-top: 0;
}

.iccid-chips {
  max-height: 150px;
  overflow-y: auto;
}
</style>
