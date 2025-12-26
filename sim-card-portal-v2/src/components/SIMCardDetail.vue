<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { type SIMCard } from '../data/mockData'
import { dataService } from '../data/dataService'

// PrimeVue components
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import ProgressBar from 'primevue/progressbar'
import Panel from 'primevue/panel'
import Message from 'primevue/message'
import DatePicker from 'primevue/datepicker'

// Props
const props = defineProps<{
  simCardId: string | null
  onClose: () => void
}>()

// Emit
const emit = defineEmits<{
  close: []
  updated: [simCard: SIMCard]
}>()

// Reactive state
const simCard = ref<SIMCard | null>(null)
const editedSIMCard = ref<SIMCard | null>(null)
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const isEditing = ref(false)
const visible = ref(true)

// Status options for dropdown
const statusOptions = [
  { label: 'Active', value: 'Active' },
  { label: 'Inactive', value: 'Inactive' },
  { label: 'Suspended', value: 'Suspended' },
  { label: 'Terminated', value: 'Terminated' }
]

// Load SIM card data
onMounted(async () => {
  if (!props.simCardId) {
    error.value = 'No SIM card ID provided'
    loading.value = false
    return
  }

  try {
    // Get SIM card from the list
    const simCards = await dataService.getSIMCards()
    const foundSIMCard = simCards.find(sim => sim.id === props.simCardId)

    if (foundSIMCard) {
      simCard.value = foundSIMCard
      editedSIMCard.value = { ...foundSIMCard }
    } else {
      error.value = 'SIM card not found'
    }
  } catch (err) {
    error.value = 'Failed to load SIM card details'
    console.error('Error loading SIM card:', err)
  } finally {
    loading.value = false
  }
})

// Computed properties
const hasUnsavedChanges = computed(() => {
  if (!simCard.value || !editedSIMCard.value) return false
  return JSON.stringify(simCard.value) !== JSON.stringify(editedSIMCard.value)
})

const getStatusSeverity = (status: string) => {
  switch (status.toLowerCase()) {
    case 'active': return 'success'
    case 'inactive': return 'secondary'
    case 'suspended': return 'warn'
    case 'terminated': return 'danger'
    default: return 'info'
  }
}

// Methods
const startEditing = () => {
  isEditing.value = true
}

const cancelEditing = () => {
  if (simCard.value) {
    editedSIMCard.value = { ...simCard.value }
  }
  isEditing.value = false
}

const saveChanges = async () => {
  if (!editedSIMCard.value || !props.simCardId) return

  saving.value = true
  try {
    const success = await dataService.updateSIMCard(props.simCardId, editedSIMCard.value)

    if (success) {
      simCard.value = { ...editedSIMCard.value }
      isEditing.value = false
      // Emit updated event so parent can refresh data
      emit('updated', editedSIMCard.value)
    } else {
      error.value = 'Failed to save changes'
    }
  } catch (err) {
    error.value = 'Failed to save changes'
    console.error('Error saving SIM card:', err)
  } finally {
    saving.value = false
  }
}

const getDataUsagePercentage = (used: string, limit: string): number => {
  const usedNum = parseFloat(used.replace(/[^\d.]/g, ''))
  const limitNum = parseFloat(limit.replace(/[^\d.]/g, ''))
  return limitNum > 0 ? Math.min((usedNum / limitNum) * 100, 100) : 0
}

// Unused but kept for potential future use with ProgressBar severity prop
// const getUsageSeverity = (percentage: number): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" | undefined => {
//   if (percentage >= 90) return 'danger'
//   if (percentage >= 75) return 'warn'
//   if (percentage >= 50) return 'info'
//   return 'success'
// }

const handleClose = () => {
  visible.value = false
  emit('close')
  props.onClose()
}

const formatDate = (dateString?: string) => {
  if (!dateString) return 'Not available'
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return dateString
  }
}

// Computed properties for date pickers (convert string to Date and back)
const activationDateModel = computed({
  get: () => editedSIMCard.value?.activationDate ? new Date(editedSIMCard.value.activationDate) : null,
  set: (val: Date | null) => {
    if (editedSIMCard.value && val) {
      editedSIMCard.value.activationDate = val.toISOString().split('T')[0]
    }
  }
})

const expiryDateModel = computed({
  get: () => editedSIMCard.value?.expiryDate ? new Date(editedSIMCard.value.expiryDate) : null,
  set: (val: Date | null) => {
    if (editedSIMCard.value && val) {
      editedSIMCard.value.expiryDate = val.toISOString().split('T')[0]
    }
  }
})
</script>

<template>
  <Dialog
    v-model:visible="visible"
    :header="simCard ? `SIM Card - ${simCard.id}` : 'SIM Card Details'"
    :modal="true"
    :closable="true"
    :draggable="false"
    class="sim-detail-dialog"
    :style="{ width: '90vw', maxWidth: '800px' }"
    @hide="handleClose"
  >
    <template #header>
      <div class="dialog-header">
        <div class="header-info">
          <h3 class="dialog-title">SIM Card Details</h3>
          <Tag v-if="simCard" :value="simCard.id" severity="secondary" class="id-tag" />
        </div>
        <div class="header-actions">
          <Button
            v-if="!isEditing && simCard"
            @click="startEditing"
            icon="pi pi-pencil"
            label="Edit"
            size="small"
            outlined
            :disabled="loading"
          />
        </div>
      </div>
    </template>

    <!-- Loading State -->
    <div v-if="loading" class="state-container">
      <i class="pi pi-spinner pi-spin" style="font-size: 2.5rem; color: var(--primary)"></i>
      <h3>Loading SIM Card Details</h3>
      <p>Please wait while we fetch the information...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="state-container">
      <i class="pi pi-exclamation-triangle" style="font-size: 2.5rem; color: var(--jt-danger)"></i>
      <h3>Error Loading SIM Card</h3>
      <p>{{ error }}</p>
    </div>

    <!-- SIM Card Details Content -->
    <div v-else-if="simCard && editedSIMCard" class="sim-content">
      <!-- Unsaved Changes Warning -->
      <Message v-if="hasUnsavedChanges" severity="warn" :closable="false" class="unsaved-message">
        You have unsaved changes
      </Message>

      <!-- Basic Information Panel -->
      <Panel header="Basic Information" :toggleable="true" class="detail-panel">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">SIM Card ID</label>
            <InputText
              v-if="isEditing"
              v-model="editedSIMCard.id"
              placeholder="SIM Card ID"
              class="form-input"
              disabled
            />
            <span v-else class="form-value monospace">{{ simCard.id }}</span>
          </div>

          <div class="form-group">
            <label class="form-label">Status</label>
            <Select
              v-if="isEditing"
              v-model="editedSIMCard.status"
              :options="statusOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Select status"
              class="form-input"
            />
            <Tag v-else :value="simCard.status" :severity="getStatusSeverity(simCard.status)" />
          </div>

          <div class="form-group full-width">
            <label class="form-label">ICCID</label>
            <InputText
              v-if="isEditing"
              v-model="editedSIMCard.iccid"
              placeholder="19-digit ICCID number"
              class="form-input monospace"
            />
            <span v-else class="form-value monospace">{{ simCard.iccid }}</span>
          </div>

          <div class="form-group">
            <label class="form-label">MSISDN (Phone Number)</label>
            <InputText
              v-if="isEditing"
              v-model="editedSIMCard.msisdn"
              placeholder="+1234567890"
              class="form-input monospace"
            />
            <span v-else class="form-value monospace">{{ simCard.msisdn }}</span>
          </div>

          <div class="form-group">
            <label class="form-label">Carrier</label>
            <InputText
              v-if="isEditing"
              v-model="editedSIMCard.carrier"
              placeholder="Network operator"
              class="form-input"
            />
            <span v-else class="form-value">{{ simCard.carrier }}</span>
          </div>
        </div>
      </Panel>

      <!-- Plan Information Panel -->
      <Panel header="Plan Information" :toggleable="true" class="detail-panel">
        <div class="form-grid">
          <div class="form-group full-width">
            <label class="form-label">Plan Name</label>
            <InputText
              v-if="isEditing"
              v-model="editedSIMCard.plan"
              placeholder="Service plan name"
              class="form-input"
            />
            <span v-else class="form-value">{{ simCard.plan }}</span>
          </div>

          <div class="form-group">
            <label class="form-label">Data Used</label>
            <InputText
              v-if="isEditing"
              v-model="editedSIMCard.dataUsed"
              placeholder="2.4 MB"
              class="form-input"
            />
            <span v-else class="form-value">{{ simCard.dataUsed }}</span>
          </div>

          <div class="form-group">
            <label class="form-label">Data Limit</label>
            <InputText
              v-if="isEditing"
              v-model="editedSIMCard.dataLimit"
              placeholder="10 MB"
              class="form-input"
            />
            <span v-else class="form-value">{{ simCard.dataLimit }}</span>
          </div>

          <div class="form-group full-width">
            <label class="form-label">Data Usage</label>
            <div class="usage-display">
              <div class="usage-info">
                <span class="usage-text">{{ simCard.dataUsed }} / {{ simCard.dataLimit }}</span>
                <span class="usage-percentage">{{ getDataUsagePercentage(simCard.dataUsed, simCard.dataLimit).toFixed(1) }}%</span>
              </div>
              <ProgressBar
                :value="getDataUsagePercentage(simCard.dataUsed, simCard.dataLimit)"
                :showValue="false"
                class="usage-bar"
              />
            </div>
          </div>
        </div>
      </Panel>

      <!-- Service Dates Panel -->
      <Panel header="Service Dates" :toggleable="true" class="detail-panel">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Activation Date</label>
            <DatePicker
              v-if="isEditing"
              v-model="activationDateModel"
              dateFormat="dd M yy"
              showIcon
              iconDisplay="input"
              class="form-input"
              placeholder="Select activation date"
            />
            <span v-else class="form-value">{{ formatDate(simCard.activationDate) }}</span>
          </div>

          <div class="form-group">
            <label class="form-label">Expiry Date</label>
            <DatePicker
              v-if="isEditing"
              v-model="expiryDateModel"
              dateFormat="dd M yy"
              showIcon
              iconDisplay="input"
              class="form-input"
              placeholder="Select expiry date"
            />
            <span v-else class="form-value">{{ formatDate(simCard.expiryDate) }}</span>
          </div>
        </div>
      </Panel>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button v-if="isEditing" label="Cancel" icon="pi pi-times" text @click="cancelEditing" />
        <Button
          v-if="isEditing"
          label="Save Changes"
          icon="pi pi-check"
          @click="saveChanges"
          :loading="saving"
          :disabled="!hasUnsavedChanges"
        />
        <Button v-if="!isEditing" label="Close" icon="pi pi-times" @click="handleClose" />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
/* Dialog styling for dark theme */
.sim-detail-dialog {
  --dialog-background: var(--surface-dark, #18222c);
  --dialog-border: var(--border-dark, #283039);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.header-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.dialog-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: white;
}

.id-tag {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.75rem;
}

.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
  gap: 1rem;
}

.state-container h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: white;
}

.state-container p {
  margin: 0;
  color: var(--text-secondary, #9faab6);
}

.sim-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.unsaved-message {
  margin-bottom: 0.5rem;
}

.detail-panel {
  margin-bottom: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-label {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--text-secondary, #9faab6);
}

.form-value {
  font-size: 0.9375rem;
  color: white;
}

.form-value.monospace,
.form-input.monospace {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
  letter-spacing: 0.02em;
}

.form-input {
  width: 100%;
}

/* Usage Display */
.usage-display {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.usage-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.usage-text {
  font-size: 0.9375rem;
  font-weight: 500;
  color: white;
}

.usage-percentage {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--primary, #137fec);
}

.usage-bar {
  height: 8px;
  border-radius: 4px;
}

/* Dialog Footer */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

/* Responsive */
@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-group.full-width {
    grid-column: 1;
  }

  .dialog-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .header-actions {
    align-self: flex-end;
  }
}
</style>

<style>
/* Global styles for PrimeVue Dialog dark theme */
.sim-detail-dialog .p-dialog {
  background: var(--surface-dark, #18222c) !important;
  border: 1px solid var(--border-dark, #283039) !important;
  border-radius: 1rem !important;
}

.sim-detail-dialog .p-dialog-header {
  background: var(--surface-dark, #18222c) !important;
  border-bottom: 1px solid var(--border-dark, #283039) !important;
  padding: 1.25rem 1.5rem !important;
  border-radius: 1rem 1rem 0 0 !important;
}

.sim-detail-dialog .p-dialog-header .p-dialog-title {
  display: none;
}

.sim-detail-dialog .p-dialog-header-icons {
  position: absolute;
  right: 1rem;
  top: 1rem;
}

.sim-detail-dialog .p-dialog-header-icon {
  color: var(--text-secondary, #9faab6) !important;
}

.sim-detail-dialog .p-dialog-header-icon:hover {
  background: var(--surface-dark-highlight, #202b36) !important;
  color: white !important;
}

.sim-detail-dialog .p-dialog-content {
  background: var(--surface-dark, #18222c) !important;
  padding: 1.5rem !important;
  color: white !important;
}

.sim-detail-dialog .p-dialog-footer {
  background: var(--surface-dark, #18222c) !important;
  border-top: 1px solid var(--border-dark, #283039) !important;
  padding: 1rem 1.5rem !important;
  border-radius: 0 0 1rem 1rem !important;
}

/* Panel styling for dark theme */
.sim-detail-dialog .p-panel {
  background: var(--surface-dark-highlight, #202b36) !important;
  border: 1px solid var(--border-dark, #283039) !important;
  border-radius: 0.75rem !important;
  overflow: hidden;
}

.sim-detail-dialog .p-panel-header {
  background: transparent !important;
  border-bottom: 1px solid var(--border-dark, #283039) !important;
  padding: 1rem 1.25rem !important;
}

.sim-detail-dialog .p-panel-title {
  color: white !important;
  font-weight: 600 !important;
  font-size: 0.9375rem !important;
}

.sim-detail-dialog .p-panel-icons {
  color: var(--text-secondary, #9faab6) !important;
}

.sim-detail-dialog .p-panel-content {
  background: transparent !important;
  padding: 1.25rem !important;
}

/* Input styling for dark theme */
.sim-detail-dialog .p-inputtext {
  background: var(--background-dark, #101922) !important;
  border: 1px solid var(--border-dark, #283039) !important;
  color: white !important;
  border-radius: 0.5rem !important;
}

.sim-detail-dialog .p-inputtext:enabled:hover {
  border-color: var(--primary, #137fec) !important;
}

.sim-detail-dialog .p-inputtext:enabled:focus {
  border-color: var(--primary, #137fec) !important;
  box-shadow: 0 0 0 2px rgba(19, 127, 236, 0.2) !important;
}

.sim-detail-dialog .p-inputtext::placeholder {
  color: var(--text-secondary, #9faab6) !important;
}

.sim-detail-dialog .p-inputtext:disabled {
  opacity: 0.6;
  background: var(--surface-dark-highlight, #202b36) !important;
}

/* Select/Dropdown styling for dark theme */
.sim-detail-dialog .p-select {
  background: var(--background-dark, #101922) !important;
  border: 1px solid var(--border-dark, #283039) !important;
  border-radius: 0.5rem !important;
}

.sim-detail-dialog .p-select .p-select-label {
  color: white !important;
}

.sim-detail-dialog .p-select:not(.p-disabled):hover {
  border-color: var(--primary, #137fec) !important;
}

.sim-detail-dialog .p-select:not(.p-disabled).p-focus {
  border-color: var(--primary, #137fec) !important;
  box-shadow: 0 0 0 2px rgba(19, 127, 236, 0.2) !important;
}

/* Progress bar styling */
.sim-detail-dialog .p-progressbar {
  background: var(--border-dark, #283039) !important;
  border-radius: 4px !important;
}

.sim-detail-dialog .p-progressbar-value {
  border-radius: 4px !important;
}

/* Button styling for dark theme */
.sim-detail-dialog .p-button.p-button-outlined {
  border-color: var(--border-dark, #283039) !important;
  color: white !important;
}

.sim-detail-dialog .p-button.p-button-outlined:hover {
  background: var(--surface-dark-highlight, #202b36) !important;
  border-color: var(--primary, #137fec) !important;
}

.sim-detail-dialog .p-button.p-button-text {
  color: var(--text-secondary, #9faab6) !important;
}

.sim-detail-dialog .p-button.p-button-text:hover {
  background: var(--surface-dark-highlight, #202b36) !important;
  color: white !important;
}

/* Tag styling */
.sim-detail-dialog .p-tag {
  font-size: 0.75rem !important;
  font-weight: 600 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
}

/* Message styling */
.sim-detail-dialog .p-message {
  border-radius: 0.5rem !important;
}

/* DatePicker styling for dark theme */
.sim-detail-dialog .p-datepicker {
  width: 100%;
}

.sim-detail-dialog .p-datepicker .p-inputtext {
  background: var(--background-dark, #101922) !important;
  border: 1px solid var(--border-dark, #283039) !important;
  color: white !important;
  border-radius: 0.5rem !important;
}

.sim-detail-dialog .p-datepicker .p-inputtext:enabled:hover {
  border-color: var(--primary, #137fec) !important;
}

.sim-detail-dialog .p-datepicker .p-inputtext:enabled:focus {
  border-color: var(--primary, #137fec) !important;
  box-shadow: 0 0 0 2px rgba(19, 127, 236, 0.2) !important;
}

.sim-detail-dialog .p-datepicker-dropdown {
  background: var(--background-dark, #101922) !important;
  border: 1px solid var(--border-dark, #283039) !important;
  border-left: none !important;
  color: white !important;
}

.sim-detail-dialog .p-datepicker-dropdown:hover {
  background: var(--surface-dark-highlight, #202b36) !important;
}

/* DatePicker panel/calendar styling */
.p-datepicker-panel {
  background: var(--surface-dark, #18222c) !important;
  border: 1px solid var(--border-dark, #283039) !important;
  border-radius: 0.75rem !important;
}

.p-datepicker-header {
  background: var(--surface-dark, #18222c) !important;
  border-bottom: 1px solid var(--border-dark, #283039) !important;
  color: white !important;
}

.p-datepicker-title button {
  color: white !important;
}

.p-datepicker-title button:hover {
  background: var(--surface-dark-highlight, #202b36) !important;
}

.p-datepicker-prev-button,
.p-datepicker-next-button {
  color: white !important;
}

.p-datepicker-prev-button:hover,
.p-datepicker-next-button:hover {
  background: var(--surface-dark-highlight, #202b36) !important;
}

.p-datepicker table th {
  color: var(--text-secondary, #9faab6) !important;
}

.p-datepicker table td > span {
  color: white !important;
}

.p-datepicker table td > span:hover {
  background: rgba(19, 127, 236, 0.2) !important;
}

.p-datepicker table td.p-datepicker-today > span {
  background: rgba(19, 127, 236, 0.3) !important;
}

.p-datepicker table td > span.p-highlight {
  background: var(--primary, #137fec) !important;
  color: white !important;
}

.p-monthpicker .p-monthpicker-month,
.p-yearpicker .p-yearpicker-year {
  color: white !important;
}

.p-monthpicker .p-monthpicker-month:hover,
.p-yearpicker .p-yearpicker-year:hover {
  background: rgba(19, 127, 236, 0.2) !important;
}

.p-monthpicker .p-highlight,
.p-yearpicker .p-highlight {
  background: var(--primary, #137fec) !important;
  color: white !important;
}
</style>
