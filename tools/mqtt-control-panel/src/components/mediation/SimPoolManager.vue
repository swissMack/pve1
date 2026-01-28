<script setup>
import { ref, onMounted, computed } from 'vue'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Button from 'primevue/button'
import Chip from 'primevue/chip'
import Divider from 'primevue/divider'
import ProgressSpinner from 'primevue/progressspinner'

const props = defineProps({
  simPool: { type: Array, required: true },
  portalUrl: { type: String, default: '' }
})

const emit = defineEmits(['add-iccid', 'remove-iccid', 'generate-iccids', 'clear-pool'])

const newIccid = ref('')
const generateCount = ref(5)

// Portal SIMs fetched from API
const portalSims = ref([])
const loadingPortalSims = ref(false)
const portalSimsError = ref('')

// Fetch provisioned SIMs from portal
const fetchPortalSims = async () => {
  if (!props.portalUrl) {
    portalSimsError.value = 'Portal URL not configured'
    return
  }

  loadingPortalSims.value = true
  portalSimsError.value = ''

  try {
    const response = await fetch(`${props.portalUrl}/api/v1/provisioned-sims`)
    const data = await response.json()

    if (data.success && data.data) {
      portalSims.value = data.data
    } else {
      portalSimsError.value = data.error || 'Failed to load SIMs'
    }
  } catch (error) {
    portalSimsError.value = error.message || 'Connection failed'
  } finally {
    loadingPortalSims.value = false
  }
}

const addIccid = () => {
  if (newIccid.value && newIccid.value.length >= 19) {
    emit('add-iccid', newIccid.value)
    newIccid.value = ''
  }
}

const addPortalSim = (iccid) => {
  if (!props.simPool.includes(iccid)) {
    emit('add-iccid', iccid)
  }
}

const addAllPortalSims = () => {
  portalSims.value.forEach(sim => {
    if (!props.simPool.includes(sim.iccid)) {
      emit('add-iccid', sim.iccid)
    }
  })
}

const isInPool = (iccid) => {
  return props.simPool.includes(iccid)
}

const allSimsInPool = computed(() => {
  return portalSims.value.length > 0 && portalSims.value.every(s => isInPool(s.iccid))
})

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

const getSimLabel = (sim, index) => {
  return sim.msisdn || `SIM ${index + 1}`
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
      <!-- Portal SIMs Section -->
      <div class="portal-sims mb-3">
        <div class="flex align-items-center justify-content-between mb-2">
          <span class="text-500 text-sm font-semibold">Portal SIMs (Provisioned)</span>
          <div class="flex gap-2">
            <Button
              icon="pi pi-refresh"
              size="small"
              severity="secondary"
              @click="fetchPortalSims"
              :loading="loadingPortalSims"
              text
              rounded
              v-tooltip="'Refresh from Portal'"
            />
            <Button
              icon="pi pi-plus-circle"
              label="Add All"
              size="small"
              severity="success"
              @click="addAllPortalSims"
              :disabled="allSimsInPool || portalSims.length === 0"
              text
            />
          </div>
        </div>

        <!-- Loading state -->
        <div v-if="loadingPortalSims" class="flex justify-content-center p-3">
          <ProgressSpinner style="width: 30px; height: 30px" />
        </div>

        <!-- Error state -->
        <div v-else-if="portalSimsError" class="text-center p-2">
          <div class="text-red-400 text-sm mb-2">{{ portalSimsError }}</div>
          <Button
            icon="pi pi-refresh"
            label="Retry"
            size="small"
            severity="secondary"
            @click="fetchPortalSims"
            outlined
          />
        </div>

        <!-- Empty state -->
        <div v-else-if="portalSims.length === 0" class="text-center p-2">
          <div class="text-500 text-sm mb-2">No portal SIMs loaded</div>
          <Button
            icon="pi pi-download"
            label="Load from Portal"
            size="small"
            severity="info"
            @click="fetchPortalSims"
            outlined
          />
        </div>

        <!-- SIM buttons -->
        <div v-else class="flex flex-wrap gap-2">
          <Button
            v-for="(sim, index) in portalSims"
            :key="sim.iccid"
            :label="getSimLabel(sim, index)"
            :icon="isInPool(sim.iccid) ? 'pi pi-check' : 'pi pi-plus'"
            size="small"
            :severity="isInPool(sim.iccid) ? 'success' : 'secondary'"
            :outlined="!isInPool(sim.iccid)"
            @click="addPortalSim(sim.iccid)"
            :disabled="isInPool(sim.iccid)"
            v-tooltip.bottom="sim.iccid"
          />
        </div>
      </div>

      <Divider />

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
          label="Generate Random"
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
          No ICCIDs in pool. Load portal SIMs, enter manually, or generate random ones.
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

.portal-sims {
  background: var(--surface-ground);
  border-radius: 6px;
  padding: 0.75rem;
}
</style>
