<script setup lang="ts">
import { computed } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Divider from 'primevue/divider'
import type { Sim, SimStatus } from '@/types/sim'

const props = defineProps<{
  sim: Sim | null
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'block': [sim: Sim]
  'unblock': [sim: Sim]
}>()

const canBlock = computed(() => {
  return props.sim?.status === 'ACTIVE' || props.sim?.status === 'INACTIVE'
})

const canUnblock = computed(() => {
  return props.sim?.status === 'BLOCKED'
})

const getStatusSeverity = (status: SimStatus): 'success' | 'info' | 'warning' | 'danger' | 'secondary' => {
  const severityMap: Record<SimStatus, 'success' | 'info' | 'warning' | 'danger'> = {
    PROVISIONED: 'info',
    ACTIVE: 'success',
    INACTIVE: 'warning',
    BLOCKED: 'danger'
  }
  return severityMap[status] || 'secondary'
}

const formatDate = (dateString?: string): string => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('de-CH')
}

const close = () => {
  emit('update:visible', false)
}
</script>

<template>
  <Dialog
    :visible="visible"
    @update:visible="emit('update:visible', $event)"
    :header="`SIM Details - ${sim?.iccid || ''}`"
    :modal="true"
    :closable="true"
    :style="{ width: '600px' }"
    class="sim-details-dialog"
  >
    <div v-if="sim" class="sim-details">
      <div class="grid">
        <div class="col-6">
          <div class="text-500 text-sm mb-1">ICCID</div>
          <div class="font-mono font-semibold">{{ sim.iccid }}</div>
        </div>
        <div class="col-6">
          <div class="text-500 text-sm mb-1">Status</div>
          <Tag :value="sim.status" :severity="getStatusSeverity(sim.status)" />
        </div>
        <div class="col-6">
          <div class="text-500 text-sm mb-1">IMSI</div>
          <div class="font-mono">{{ sim.imsi }}</div>
        </div>
        <div class="col-6">
          <div class="text-500 text-sm mb-1">MSISDN</div>
          <div class="font-mono">{{ sim.msisdn }}</div>
        </div>
        <div class="col-6">
          <div class="text-500 text-sm mb-1">IMEI</div>
          <div class="font-mono">{{ sim.imei || '-' }}</div>
        </div>
        <div class="col-6">
          <div class="text-500 text-sm mb-1">Created</div>
          <div>{{ formatDate(sim.createdAt) }}</div>
        </div>
      </div>

      <Divider />

      <div class="text-lg font-semibold mb-3">Profile</div>
      <div class="grid">
        <div class="col-6">
          <div class="text-500 text-sm mb-1">APN</div>
          <div>{{ sim.profile?.apn || '-' }}</div>
        </div>
        <div class="col-6">
          <div class="text-500 text-sm mb-1">Rate Plan</div>
          <div>{{ sim.profile?.ratePlanId || '-' }}</div>
        </div>
        <div class="col-6">
          <div class="text-500 text-sm mb-1">Data Limit</div>
          <div>{{ sim.profile?.dataLimit ? `${(sim.profile.dataLimit / 1024 / 1024).toFixed(0)} MB` : '-' }}</div>
        </div>
        <div class="col-6">
          <div class="text-500 text-sm mb-1">Customer ID</div>
          <div>{{ sim.profile?.customerId || '-' }}</div>
        </div>
      </div>

      <template v-if="sim.status === 'BLOCKED'">
        <Divider />
        <div class="text-lg font-semibold mb-3 text-red-500">Block Information</div>
        <div class="grid">
          <div class="col-6">
            <div class="text-500 text-sm mb-1">Reason</div>
            <div class="text-red-600 font-semibold">{{ sim.blockReason || '-' }}</div>
          </div>
          <div class="col-6">
            <div class="text-500 text-sm mb-1">Blocked At</div>
            <div>{{ formatDate(sim.blockedAt) }}</div>
          </div>
          <div class="col-12">
            <div class="text-500 text-sm mb-1">Blocked By</div>
            <div>{{ sim.blockedBy || '-' }}</div>
          </div>
          <div class="col-12" v-if="sim.blockNotes">
            <div class="text-500 text-sm mb-1">Notes</div>
            <div class="text-600">{{ sim.blockNotes }}</div>
          </div>
        </div>
      </template>
    </div>

    <template #footer>
      <div class="flex justify-content-between w-full">
        <div>
          <Button
            v-if="canBlock"
            label="Block SIM"
            icon="pi pi-ban"
            severity="danger"
            @click="emit('block', sim!)"
          />
          <Button
            v-if="canUnblock"
            label="Unblock SIM"
            icon="pi pi-check-circle"
            severity="success"
            @click="emit('unblock', sim!)"
          />
        </div>
        <Button label="Close" severity="secondary" @click="close" />
      </div>
    </template>
  </Dialog>
</template>
