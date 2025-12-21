<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import Button from 'primevue/button'
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Dropdown from 'primevue/dropdown'
import ProgressBar from 'primevue/progressbar'
import Message from 'primevue/message'
import { simPortalService } from '../services/simPortalService.js'

// State
const portalConnected = ref(false)
const portalError = ref(null)
const sims = ref([])
const loading = ref(false)
const creating = ref(false)
const actionLoading = ref(null)

// Consumption generator state
const generatorRunning = ref(false)
const generatorInterval = ref(null)
const lastGeneratedAt = ref(null)
const generatedRecords = ref([])
const nextGenerationIn = ref(300) // 5 minutes in seconds

// Dialog state
const showCreateDialog = ref(false)
const showBlockDialog = ref(false)
const selectedSim = ref(null)
const blockReason = ref('MANUAL')

// Helper to get default expiry date (1 year from now)
const getDefaultExpiryDate = () => {
  const date = new Date()
  date.setFullYear(date.getFullYear() + 1)
  return date.toISOString().split('T')[0]
}

// Create SIM form
const newSimForm = ref({
  msisdn: '',
  apn: 'iot.simportal.ch',
  ratePlanId: 'plan_iot_standard',
  activateImmediately: true,
  expiryDate: getDefaultExpiryDate()
})

const blockReasons = [
  { label: 'Manual Block', value: 'MANUAL' },
  { label: 'Fraud Suspected', value: 'FRAUD_SUSPECTED' },
  { label: 'Usage Threshold Exceeded', value: 'USAGE_THRESHOLD_EXCEEDED' },
  { label: 'Billing Issue', value: 'BILLING_ISSUE' },
  { label: 'Customer Request', value: 'CUSTOMER_REQUEST' },
  { label: 'Policy Violation', value: 'POLICY_VIOLATION' }
]

// Status severity mapping
const getStatusSeverity = (status) => {
  const map = {
    'ACTIVE': 'success',
    'PROVISIONED': 'info',
    'INACTIVE': 'warn',
    'BLOCKED': 'danger'
  }
  return map[status] || 'secondary'
}

// Format bytes to human readable
const formatBytes = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Check portal connectivity
const checkPortalConnection = async () => {
  try {
    const health = await simPortalService.healthCheck()
    portalConnected.value = health.status === 'healthy'
    portalError.value = null
  } catch (err) {
    portalConnected.value = false
    portalError.value = err.message || 'Failed to connect to SIM Portal'
  }
}

// Fetch SIMs from portal
const fetchSims = async () => {
  loading.value = true
  try {
    const result = await simPortalService.listSims({ limit: 50 })
    sims.value = result.data || []
  } catch (err) {
    console.error('Failed to fetch SIMs:', err)
    if (err.response?.status === 401) {
      portalError.value = 'Authentication failed - check API key'
    }
  } finally {
    loading.value = false
  }
}

// Create new SIM
const createSim = async () => {
  creating.value = true
  try {
    const result = await simPortalService.createSim({
      msisdn: newSimForm.value.msisdn || undefined,
      apn: newSimForm.value.apn,
      ratePlanId: newSimForm.value.ratePlanId,
      activateImmediately: newSimForm.value.activateImmediately,
      expiryDate: newSimForm.value.expiryDate || undefined
    })
    showCreateDialog.value = false
    await fetchSims()
    // Reset form
    newSimForm.value = {
      msisdn: '',
      apn: 'iot.simportal.ch',
      ratePlanId: 'plan_iot_standard',
      activateImmediately: true,
      expiryDate: getDefaultExpiryDate()
    }
  } catch (err) {
    console.error('Failed to create SIM:', err)
    portalError.value = err.response?.data?.error?.message || 'Failed to create SIM'
  } finally {
    creating.value = false
  }
}

// Activate SIM
const activateSim = async (sim) => {
  actionLoading.value = sim.simId
  try {
    await simPortalService.activateSim(sim.simId)
    await fetchSims()
  } catch (err) {
    console.error('Failed to activate SIM:', err)
    portalError.value = err.response?.data?.error?.message || 'Failed to activate SIM'
  } finally {
    actionLoading.value = null
  }
}

// Deactivate SIM
const deactivateSim = async (sim) => {
  actionLoading.value = sim.simId
  try {
    await simPortalService.deactivateSim(sim.simId)
    await fetchSims()
  } catch (err) {
    console.error('Failed to deactivate SIM:', err)
    portalError.value = err.response?.data?.error?.message || 'Failed to deactivate SIM'
  } finally {
    actionLoading.value = null
  }
}

// Open block dialog
const openBlockDialog = (sim) => {
  selectedSim.value = sim
  blockReason.value = 'MANUAL'
  showBlockDialog.value = true
}

// Block SIM
const blockSim = async () => {
  if (!selectedSim.value) return
  actionLoading.value = selectedSim.value.simId
  try {
    await simPortalService.blockSim(selectedSim.value.simId, blockReason.value)
    showBlockDialog.value = false
    await fetchSims()
  } catch (err) {
    console.error('Failed to block SIM:', err)
    portalError.value = err.response?.data?.error?.message || 'Failed to block SIM'
  } finally {
    actionLoading.value = null
  }
}

// Unblock SIM
const unblockSim = async (sim) => {
  actionLoading.value = sim.simId
  try {
    await simPortalService.unblockSim(sim.simId)
    await fetchSims()
  } catch (err) {
    console.error('Failed to unblock SIM:', err)
    portalError.value = err.response?.data?.error?.message || 'Failed to unblock SIM'
  } finally {
    actionLoading.value = null
  }
}

// Generate consumption data for all active SIMs
const generateConsumption = async () => {
  const activeSims = sims.value.filter(s => s.status === 'ACTIVE')
  if (activeSims.length === 0) {
    console.log('No active SIMs to generate consumption for')
    return
  }

  const records = []
  for (const sim of activeSims) {
    try {
      const result = await simPortalService.submitUsage(sim.iccid)
      records.push({
        iccid: sim.iccid,
        status: result.status,
        recordId: result.recordId,
        time: new Date().toLocaleTimeString()
      })
    } catch (err) {
      records.push({
        iccid: sim.iccid,
        status: 'FAILED',
        error: err.message,
        time: new Date().toLocaleTimeString()
      })
    }
  }

  generatedRecords.value = [...records, ...generatedRecords.value].slice(0, 50)
  lastGeneratedAt.value = new Date().toLocaleTimeString()
}

// Start consumption generator
const startGenerator = () => {
  if (generatorRunning.value) return

  generatorRunning.value = true
  nextGenerationIn.value = 300

  // Generate immediately
  generateConsumption()

  // Set up interval for every 5 minutes
  generatorInterval.value = setInterval(() => {
    generateConsumption()
    nextGenerationIn.value = 300
  }, 5 * 60 * 1000)

  // Countdown timer
  const countdownInterval = setInterval(() => {
    if (!generatorRunning.value) {
      clearInterval(countdownInterval)
      return
    }
    nextGenerationIn.value = Math.max(0, nextGenerationIn.value - 1)
  }, 1000)
}

// Stop consumption generator
const stopGenerator = () => {
  generatorRunning.value = false
  if (generatorInterval.value) {
    clearInterval(generatorInterval.value)
    generatorInterval.value = null
  }
}

// Manual trigger
const triggerGeneration = async () => {
  await generateConsumption()
  nextGenerationIn.value = 300 // Reset countdown
}

// Format countdown
const formatCountdown = computed(() => {
  const mins = Math.floor(nextGenerationIn.value / 60)
  const secs = nextGenerationIn.value % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
})

// Lifecycle
onMounted(async () => {
  await checkPortalConnection()
  if (portalConnected.value) {
    await fetchSims()
  }
})

onUnmounted(() => {
  stopGenerator()
})
</script>

<template>
  <div class="simulator-view">
    <h2 class="view-title mb-4">
      <i class="pi pi-bolt mr-2"></i>
      SIM Portal Simulator
    </h2>

    <!-- Connection Status -->
    <Card class="mb-4">
      <template #content>
        <div class="flex align-items-center justify-content-between">
          <div class="flex align-items-center gap-3">
            <i :class="['pi', portalConnected ? 'pi-check-circle text-green-500' : 'pi-times-circle text-red-500']" style="font-size: 1.5rem"></i>
            <div>
              <div class="font-semibold">SIM Card Portal Connection</div>
              <div class="text-600 text-sm">{{ portalConnected ? 'Connected to localhost:3001' : 'Not connected' }}</div>
            </div>
          </div>
          <Button
            label="Refresh"
            icon="pi pi-refresh"
            severity="secondary"
            size="small"
            @click="checkPortalConnection(); fetchSims()"
          />
        </div>
        <Message v-if="portalError" severity="error" class="mt-3" :closable="false">
          {{ portalError }}
        </Message>
      </template>
    </Card>

    <div class="grid">
      <!-- SIM Management Panel -->
      <div class="col-12 lg:col-7">
        <Card>
          <template #title>
            <div class="flex align-items-center justify-content-between">
              <div class="flex align-items-center gap-2">
                <i class="pi pi-id-card"></i>
                SIM Cards
              </div>
              <Button
                label="Create SIM"
                icon="pi pi-plus"
                size="small"
                :disabled="!portalConnected"
                @click="showCreateDialog = true"
              />
            </div>
          </template>
          <template #content>
            <DataTable
              :value="sims"
              :loading="loading"
              scrollable
              scrollHeight="400px"
              stripedRows
              size="small"
              class="sim-table"
            >
              <template #empty>
                <div class="text-center p-4 text-600">
                  {{ portalConnected ? 'No SIM cards found' : 'Connect to portal to view SIMs' }}
                </div>
              </template>
              <Column field="iccid" header="ICCID" style="min-width: 180px">
                <template #body="{ data }">
                  <span class="font-mono text-sm">{{ data.iccid?.slice(-8) }}</span>
                </template>
              </Column>
              <Column field="msisdn" header="MSISDN" style="min-width: 130px">
                <template #body="{ data }">
                  <span class="text-sm">{{ data.msisdn }}</span>
                </template>
              </Column>
              <Column field="status" header="Status" style="min-width: 100px">
                <template #body="{ data }">
                  <Tag :value="data.status" :severity="getStatusSeverity(data.status)" />
                </template>
              </Column>
              <Column header="Actions" style="min-width: 200px">
                <template #body="{ data }">
                  <div class="flex gap-1">
                    <Button
                      v-if="data.status === 'PROVISIONED' || data.status === 'INACTIVE'"
                      icon="pi pi-play"
                      severity="success"
                      size="small"
                      text
                      :loading="actionLoading === data.simId"
                      v-tooltip.top="'Activate'"
                      @click="activateSim(data)"
                    />
                    <Button
                      v-if="data.status === 'ACTIVE'"
                      icon="pi pi-pause"
                      severity="warn"
                      size="small"
                      text
                      :loading="actionLoading === data.simId"
                      v-tooltip.top="'Deactivate'"
                      @click="deactivateSim(data)"
                    />
                    <Button
                      v-if="data.status !== 'BLOCKED'"
                      icon="pi pi-ban"
                      severity="danger"
                      size="small"
                      text
                      :loading="actionLoading === data.simId"
                      v-tooltip.top="'Block'"
                      @click="openBlockDialog(data)"
                    />
                    <Button
                      v-if="data.status === 'BLOCKED'"
                      icon="pi pi-unlock"
                      severity="info"
                      size="small"
                      text
                      :loading="actionLoading === data.simId"
                      v-tooltip.top="'Unblock'"
                      @click="unblockSim(data)"
                    />
                  </div>
                </template>
              </Column>
            </DataTable>
          </template>
        </Card>
      </div>

      <!-- Consumption Generator Panel -->
      <div class="col-12 lg:col-5">
        <Card class="mb-4">
          <template #title>
            <div class="flex align-items-center gap-2">
              <i class="pi pi-chart-line"></i>
              Consumption Generator
            </div>
          </template>
          <template #content>
            <p class="text-600 mb-4 text-sm">
              Generates random usage data for all active SIMs every 5 minutes and sends it to the SIM Portal.
            </p>

            <div class="flex align-items-center gap-3 mb-4">
              <Button
                v-if="!generatorRunning"
                label="Start Generator"
                icon="pi pi-play"
                severity="success"
                :disabled="!portalConnected"
                @click="startGenerator"
              />
              <Button
                v-else
                label="Stop Generator"
                icon="pi pi-stop"
                severity="danger"
                @click="stopGenerator"
              />
              <Button
                label="Generate Now"
                icon="pi pi-bolt"
                severity="secondary"
                :disabled="!portalConnected"
                @click="triggerGeneration"
              />
            </div>

            <div v-if="generatorRunning" class="mb-4">
              <div class="flex justify-content-between mb-2">
                <span class="text-600 text-sm">Next generation in:</span>
                <span class="font-semibold">{{ formatCountdown }}</span>
              </div>
              <ProgressBar :value="((300 - nextGenerationIn) / 300) * 100" :showValue="false" style="height: 6px" />
            </div>

            <div v-if="lastGeneratedAt" class="text-sm text-600">
              Last generated: {{ lastGeneratedAt }}
            </div>
          </template>
        </Card>

        <!-- Recent Records -->
        <Card>
          <template #title>
            <div class="flex align-items-center gap-2">
              <i class="pi pi-history"></i>
              Recent Records
            </div>
          </template>
          <template #content>
            <div class="recent-records">
              <div v-if="generatedRecords.length === 0" class="text-600 text-center p-3">
                No records generated yet
              </div>
              <div
                v-for="(record, idx) in generatedRecords.slice(0, 10)"
                :key="idx"
                class="record-item p-2 border-bottom-1 border-200"
              >
                <div class="flex justify-content-between align-items-center">
                  <span class="font-mono text-sm">...{{ record.iccid?.slice(-8) }}</span>
                  <Tag
                    :value="record.status"
                    :severity="record.status === 'ACCEPTED' ? 'success' : record.status === 'DUPLICATE' ? 'warn' : 'danger'"
                    class="text-xs"
                  />
                </div>
                <div class="text-xs text-500 mt-1">{{ record.time }}</div>
              </div>
            </div>
          </template>
        </Card>
      </div>
    </div>

    <!-- Create SIM Dialog -->
    <Dialog
      v-model:visible="showCreateDialog"
      header="Create New SIM"
      :style="{ width: '400px' }"
      modal
    >
      <div class="flex flex-column gap-3">
        <div>
          <label class="block text-600 mb-1 text-sm">MSISDN (optional)</label>
          <InputText
            v-model="newSimForm.msisdn"
            placeholder="+41791234567"
            class="w-full"
          />
          <small class="text-500">Leave empty for auto-generated</small>
        </div>
        <div>
          <label class="block text-600 mb-1 text-sm">APN</label>
          <InputText
            v-model="newSimForm.apn"
            class="w-full"
          />
        </div>
        <div>
          <label class="block text-600 mb-1 text-sm">Rate Plan</label>
          <InputText
            v-model="newSimForm.ratePlanId"
            class="w-full"
          />
        </div>
        <div>
          <label class="block text-600 mb-1 text-sm">Expiry Date (optional)</label>
          <InputText
            v-model="newSimForm.expiryDate"
            type="date"
            class="w-full"
          />
          <small class="text-500">Leave empty for no expiry</small>
        </div>
        <div class="flex align-items-center gap-2">
          <input type="checkbox" v-model="newSimForm.activateImmediately" id="activateNow" />
          <label for="activateNow" class="text-sm">Activate immediately</label>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" @click="showCreateDialog = false" />
        <Button label="Create" icon="pi pi-check" :loading="creating" @click="createSim" />
      </template>
    </Dialog>

    <!-- Block SIM Dialog -->
    <Dialog
      v-model:visible="showBlockDialog"
      header="Block SIM"
      :style="{ width: '400px' }"
      modal
    >
      <div class="flex flex-column gap-3">
        <Message severity="warn" :closable="false">
          You are about to block SIM: {{ selectedSim?.msisdn }}
        </Message>
        <div>
          <label class="block text-600 mb-1 text-sm">Block Reason</label>
          <Dropdown
            v-model="blockReason"
            :options="blockReasons"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" @click="showBlockDialog = false" />
        <Button label="Block SIM" icon="pi pi-ban" severity="danger" :loading="actionLoading !== null" @click="blockSim" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.view-title {
  display: flex;
  align-items: center;
  color: #4fc3f7;
  font-size: 1.5rem;
  font-weight: 600;
}

.sim-table :deep(.p-datatable-tbody > tr > td) {
  padding: 0.5rem;
}

.recent-records {
  max-height: 300px;
  overflow-y: auto;
}

.record-item:last-child {
  border-bottom: none !important;
}
</style>
