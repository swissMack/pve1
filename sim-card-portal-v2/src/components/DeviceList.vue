<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { type Device } from '../data/mockData'
import { dataService } from '../data/dataService'
import DeviceDetail from './DeviceDetail.vue'
import DeviceMap from './DeviceMap.vue'

interface Props {
  refreshKey?: number
}

const props = defineProps<Props>()

const searchTerm = ref('')
const selectedStatus = ref('All')
const devices = ref<Device[]>([])
const loading = ref(true)
const error = ref('')
const selectedDeviceId = ref<string | null>(null)
const showCreateDialog = ref(false)

const statusOptions = [
  { label: 'All Devices', value: 'All' },
  { label: 'Active', value: 'Active' },
  { label: 'Inactive', value: 'Inactive' },
  { label: 'Maintenance', value: 'Maintenance' },
  { label: 'Offline', value: 'Offline' }
]

// Load devices from data service
onMounted(async () => {
  try {
    await loadDevices()
  } finally {
    loading.value = false
  }
})

const filteredDevices = computed(() => {
  let filtered = devices.value.filter(device => {
    const matchesSearch = device.name.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
                         device.id.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
                         device.location.toLowerCase().includes(searchTerm.value.toLowerCase())
    const matchesStatus = selectedStatus.value === 'All' || device.status.toLowerCase() === selectedStatus.value.toLowerCase()
    return matchesSearch && matchesStatus
  })
  return filtered
})

const generateIMEI = (deviceId: string) => {
  const hash = deviceId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  const imei = Math.abs(hash).toString().padStart(15, '0').substring(0, 15)
  return imei.replace(/(\d{3})(\d{3})(\d{3})(\d{3})(\d{3})/, '$1$2$3$4$5')
}

const getStatusClass = (status: string) => {
  switch (status.toLowerCase()) {
    case 'active': return 'bg-green-500/10 text-green-400 border-green-500/20'
    case 'inactive': return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    case 'maintenance': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    case 'offline': return 'bg-red-500/10 text-red-400 border-red-500/20'
    default: return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
  }
}

const showDeviceDetail = (deviceId: string) => {
  selectedDeviceId.value = deviceId
}

const closeDeviceDetail = () => {
  selectedDeviceId.value = null
  // Refresh the device list to get any updates
  loadDevices()
}

const openCreateDialog = () => {
  showCreateDialog.value = true
}

const closeCreateDialog = () => {
  showCreateDialog.value = false
  // Refresh the device list to show the new device
  loadDevices()
}

const loadDevices = async () => {
  loading.value = true
  error.value = ''
  try {
    devices.value = await dataService.getDevices()
  } catch (err) {
    error.value = 'Failed to load devices'
    console.error('Error loading devices:', err)
  } finally {
    loading.value = false
  }
}

// Watch for refresh trigger from parent
watch(() => props.refreshKey, () => {
  loadDevices()
})

// Stats computed
const activeCount = computed(() => devices.value.filter(d => d.status.toLowerCase() === 'active').length)
const offlineCount = computed(() => devices.value.filter(d => d.status.toLowerCase() === 'offline').length)
const maintenanceCount = computed(() => devices.value.filter(d => d.status.toLowerCase() === 'maintenance').length)
</script>

<template>
  <div class="p-6 lg:p-8 bg-background-dark min-h-full">
    <div class="max-w-[1600px] mx-auto flex flex-col gap-6">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-white">Device Management</h1>
          <p class="text-text-secondary text-sm mt-1">Monitor and manage your IoT device fleet</p>
        </div>
        <button
          @click="openCreateDialog"
          class="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors shadow-lg shadow-primary/20"
        >
          <span class="material-symbols-outlined text-[20px]">add</span>
          Add Device
        </button>
      </div>

      <!-- Stats Row -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center gap-4">
          <div class="p-2.5 rounded-lg bg-primary/10 text-primary">
            <span class="material-symbols-outlined text-[24px]">devices</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ devices.length }}</p>
            <p class="text-text-secondary text-xs">Total Devices</p>
          </div>
        </div>
        <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center gap-4">
          <div class="p-2.5 rounded-lg bg-green-500/10 text-green-400">
            <span class="material-symbols-outlined text-[24px]">check_circle</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ activeCount }}</p>
            <p class="text-text-secondary text-xs">Active</p>
          </div>
        </div>
        <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center gap-4">
          <div class="p-2.5 rounded-lg bg-red-500/10 text-red-400">
            <span class="material-symbols-outlined text-[24px]">signal_disconnected</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ offlineCount }}</p>
            <p class="text-text-secondary text-xs">Offline</p>
          </div>
        </div>
        <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center gap-4">
          <div class="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
            <span class="material-symbols-outlined text-[24px]">build</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ maintenanceCount }}</p>
            <p class="text-text-secondary text-xs">Maintenance</p>
          </div>
        </div>
      </div>

      <!-- Google Maps Device Location Visualization -->
      <DeviceMap
        :devices="devices"
        :onDeviceSelect="showDeviceDetail"
      />

      <!-- Filters and Search -->
      <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div class="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <!-- Search Input -->
          <div class="relative">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-[20px]">search</span>
            <input
              v-model="searchTerm"
              type="text"
              placeholder="Search by name, ID, or location..."
              class="w-full md:w-80 bg-background-dark border border-border-dark rounded-lg pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-text-secondary transition-all"
            />
          </div>
          <!-- Status Filter -->
          <div class="flex bg-background-dark p-1 rounded-lg border border-border-dark">
            <button
              v-for="opt in statusOptions"
              :key="opt.value"
              @click="selectedStatus = opt.value"
              class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
              :class="selectedStatus === opt.value ? 'bg-surface-dark text-white shadow-sm' : 'text-text-secondary hover:text-white hover:bg-surface-dark'"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
        <div class="text-text-secondary text-sm">
          Showing <span class="text-white font-medium">{{ filteredDevices.length }}</span> of {{ devices.length }} devices
        </div>
      </div>

      <!-- Device Table -->
      <div class="bg-surface-dark rounded-xl border border-border-dark overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-background-dark border-b border-border-dark">
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Device</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Status</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">IMEI</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">SIM Card</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Type</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Location</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Signal</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border-dark text-sm">
              <tr
                v-for="device in filteredDevices"
                :key="device.id"
                class="hover:bg-surface-dark-highlight transition-colors group cursor-pointer"
                @click="showDeviceDetail(device.id)"
              >
                <td class="py-3 px-4">
                  <div class="flex items-center gap-3">
                    <div class="size-10 rounded-lg flex items-center justify-center shrink-0"
                      :class="device.status.toLowerCase() === 'active' ? 'bg-green-500/10 text-green-400' : device.status.toLowerCase() === 'offline' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'">
                      <span class="material-symbols-outlined text-[20px]">router</span>
                    </div>
                    <div>
                      <p class="text-white font-medium">{{ device.name }}</p>
                      <p class="text-text-secondary text-xs">ID: {{ device.id }}</p>
                    </div>
                  </div>
                </td>
                <td class="py-3 px-4">
                  <span
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                    :class="getStatusClass(device.status)"
                  >
                    <span class="size-1.5 rounded-full"
                      :class="device.status.toLowerCase() === 'active' ? 'bg-green-400' : device.status.toLowerCase() === 'offline' ? 'bg-red-400' : 'bg-amber-400'"></span>
                    {{ device.status }}
                  </span>
                </td>
                <td class="py-3 px-4">
                  <code class="text-xs font-mono text-text-secondary bg-background-dark px-2 py-1 rounded">{{ generateIMEI(device.id) }}</code>
                </td>
                <td class="py-3 px-4 text-white">{{ device.simCard || '-' }}</td>
                <td class="py-3 px-4 text-text-secondary">{{ device.deviceType }}</td>
                <td class="py-3 px-4 text-text-secondary">{{ device.location }}</td>
                <td class="py-3 px-4">
                  <div class="flex items-center gap-2">
                    <div class="w-16 h-1.5 bg-border-dark rounded-full overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all"
                        :style="{ width: `${device.signalStrength}%` }"
                        :class="{
                          'bg-green-400': device.signalStrength >= 80,
                          'bg-lime-400': device.signalStrength >= 60 && device.signalStrength < 80,
                          'bg-amber-400': device.signalStrength >= 40 && device.signalStrength < 60,
                          'bg-orange-400': device.signalStrength >= 20 && device.signalStrength < 40,
                          'bg-red-400': device.signalStrength < 20
                        }"
                      ></div>
                    </div>
                    <span class="text-xs text-text-secondary">{{ device.signalStrength }}%</span>
                  </div>
                </td>
                <td class="py-3 px-4 text-right">
                  <button
                    @click.stop="showDeviceDetail(device.id)"
                    class="text-text-secondary hover:text-primary opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <span class="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </button>
                </td>
              </tr>
              <tr v-if="filteredDevices.length === 0">
                <td colspan="8" class="py-12 text-center">
                  <div class="flex flex-col items-center gap-2 text-text-secondary">
                    <span class="material-symbols-outlined text-4xl">search_off</span>
                    <p class="text-sm">No devices found matching your criteria</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- Pagination -->
        <div class="px-4 py-3 border-t border-border-dark flex items-center justify-between text-xs text-text-secondary">
          <span>Showing {{ filteredDevices.length }} of {{ devices.length }} devices</span>
          <div class="flex gap-2">
            <button class="hover:text-white disabled:opacity-50 px-2 py-1" disabled>Previous</button>
            <button class="hover:text-white px-2 py-1">Next</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Device Detail Modal -->
    <DeviceDetail
      v-if="selectedDeviceId"
      :device-id="selectedDeviceId"
      @close="closeDeviceDetail"
    />

    <!-- Create Device Modal -->
    <DeviceDetail
      v-if="showCreateDialog"
      :device-id="null"
      :create-mode="true"
      @close="closeCreateDialog"
      @device-created="closeCreateDialog"
    />
  </div>
</template>

<style scoped>
/* Additional dark theme styles */
</style>
