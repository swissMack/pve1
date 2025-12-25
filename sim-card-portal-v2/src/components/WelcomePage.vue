<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { type Device, type SIMCard } from '../data/mockData'
import { dataService } from '../data/dataService'

interface WelcomeProps {
  onLogout: () => void
  onNavigate: (page: string) => void
}

const props = defineProps<WelcomeProps>()

const devices = ref<Device[]>([])
const simCards = ref<SIMCard[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const [deviceData, simData] = await Promise.all([
      dataService.getDevices(),
      dataService.getSIMCards()
    ])
    devices.value = deviceData
    simCards.value = simData
  } catch (err) {
    console.error('Error loading dashboard data:', err)
  } finally {
    loading.value = false
  }
})

const activeDevices = computed(() => devices.value.filter(d => d.status.toLowerCase() === 'active').length)
const activeSIMs = computed(() => simCards.value.filter(s => s.status.toLowerCase() === 'active').length)
const offlineDevices = computed(() => devices.value.filter(d => d.status.toLowerCase() === 'offline').length)
const expiringSIMs = computed(() => {
  return simCards.value.filter(s => {
    const expiry = new Date(s.expiryDate)
    const today = new Date()
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry <= 30
  }).length
})
</script>

<template>
  <div class="p-6 lg:p-8 bg-background-dark min-h-full">
    <div class="max-w-[1400px] mx-auto flex flex-col gap-8">
      <!-- KPI Stats Row -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Active Devices Card -->
        <div class="bg-surface-dark rounded-xl border border-border-dark p-5 flex flex-col gap-4 relative overflow-hidden group hover:border-primary/50 transition-colors cursor-pointer" @click="props.onNavigate('devices')">
          <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <span class="material-symbols-outlined text-primary text-[80px]">router</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="p-2 rounded-lg bg-primary/10 text-primary">
              <span class="material-symbols-outlined text-[24px]">router</span>
            </div>
            <p class="text-text-secondary font-medium text-sm">Active Devices</p>
          </div>
          <div>
            <h3 class="text-3xl font-bold text-white mb-1">{{ activeDevices }}</h3>
            <div class="flex items-center gap-2 text-xs text-text-secondary">
              <span class="flex items-center gap-1 text-green-400">
                <span class="size-2 rounded-full bg-green-400"></span>
                Online
              </span>
              <span>of {{ devices.length }} total</span>
            </div>
          </div>
        </div>

        <!-- Active SIMs Card -->
        <div class="bg-surface-dark rounded-xl border border-border-dark p-5 flex flex-col gap-4 relative overflow-hidden group hover:border-teal-500/50 transition-colors cursor-pointer" @click="props.onNavigate('sim-cards')">
          <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <span class="material-symbols-outlined text-teal-400 text-[80px]">sim_card</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="p-2 rounded-lg bg-teal-500/10 text-teal-400">
              <span class="material-symbols-outlined text-[24px]">sim_card</span>
            </div>
            <p class="text-text-secondary font-medium text-sm">Active SIMs</p>
          </div>
          <div>
            <h3 class="text-3xl font-bold text-white mb-1">{{ activeSIMs }}</h3>
            <div class="flex items-center gap-2 text-xs text-text-secondary">
              <span class="flex items-center gap-1 text-teal-400">
                <span class="size-2 rounded-full bg-teal-400"></span>
                Connected
              </span>
              <span>of {{ simCards.length }} total</span>
            </div>
          </div>
        </div>

        <!-- Offline Devices Card -->
        <div class="bg-surface-dark rounded-xl border border-border-dark p-5 flex flex-col gap-4 relative overflow-hidden group hover:border-red-500/50 transition-colors cursor-pointer" @click="props.onNavigate('devices')">
          <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <span class="material-symbols-outlined text-red-400 text-[80px]">signal_disconnected</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="p-2 rounded-lg bg-red-500/10 text-red-400">
              <span class="material-symbols-outlined text-[24px]">signal_disconnected</span>
            </div>
            <p class="text-text-secondary font-medium text-sm">Offline Devices</p>
          </div>
          <div>
            <h3 class="text-3xl font-bold text-white mb-1">{{ offlineDevices }}</h3>
            <div class="flex items-center gap-2 text-xs">
              <span class="text-red-400 font-medium">Needs Attention</span>
            </div>
          </div>
        </div>

        <!-- Expiring SIMs Card -->
        <div class="bg-surface-dark rounded-xl border border-border-dark p-5 flex flex-col gap-4 relative overflow-hidden group hover:border-amber-500/50 transition-colors cursor-pointer" @click="props.onNavigate('sim-cards')">
          <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <span class="material-symbols-outlined text-amber-400 text-[80px]">schedule</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <span class="material-symbols-outlined text-[24px]">schedule</span>
            </div>
            <p class="text-text-secondary font-medium text-sm">Expiring SIMs</p>
          </div>
          <div>
            <h3 class="text-3xl font-bold text-white mb-1">{{ expiringSIMs }}</h3>
            <div class="flex items-center gap-2 text-xs">
              <span class="text-amber-400 font-medium">Next 30 Days</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Actions Section -->
      <div class="flex flex-col gap-4">
        <h2 class="text-lg font-bold text-white">Quick Actions</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Manage Devices -->
          <div
            @click="props.onNavigate('devices')"
            class="bg-surface-dark rounded-xl border border-border-dark p-6 flex flex-col items-center text-center gap-4 cursor-pointer hover:border-primary/50 hover:bg-surface-dark-highlight transition-all group"
          >
            <div class="size-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
              <span class="material-symbols-outlined text-[32px]">devices</span>
            </div>
            <div>
              <h3 class="text-white font-semibold mb-1">Manage Devices</h3>
              <p class="text-text-secondary text-sm">View and manage all connected IoT devices</p>
            </div>
          </div>

          <!-- SIM Management -->
          <div
            @click="props.onNavigate('sim-cards')"
            class="bg-surface-dark rounded-xl border border-border-dark p-6 flex flex-col items-center text-center gap-4 cursor-pointer hover:border-teal-500/50 hover:bg-surface-dark-highlight transition-all group"
          >
            <div class="size-14 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-400 group-hover:bg-teal-500/20 transition-colors">
              <span class="material-symbols-outlined text-[32px]">sim_card</span>
            </div>
            <div>
              <h3 class="text-white font-semibold mb-1">SIM Management</h3>
              <p class="text-text-secondary text-sm">Monitor usage and manage SIM cards</p>
            </div>
          </div>

          <!-- Analytics -->
          <div
            @click="props.onNavigate('consumption')"
            class="bg-surface-dark rounded-xl border border-border-dark p-6 flex flex-col items-center text-center gap-4 cursor-pointer hover:border-purple-500/50 hover:bg-surface-dark-highlight transition-all group"
          >
            <div class="size-14 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:bg-purple-500/20 transition-colors">
              <span class="material-symbols-outlined text-[32px]">analytics</span>
            </div>
            <div>
              <h3 class="text-white font-semibold mb-1">Analytics</h3>
              <p class="text-text-secondary text-sm">View reports and performance insights</p>
            </div>
          </div>

          <!-- Settings -->
          <div
            @click="props.onNavigate('settings')"
            class="bg-surface-dark rounded-xl border border-border-dark p-6 flex flex-col items-center text-center gap-4 cursor-pointer hover:border-gray-500/50 hover:bg-surface-dark-highlight transition-all group"
          >
            <div class="size-14 rounded-xl bg-gray-500/10 flex items-center justify-center text-gray-400 group-hover:bg-gray-500/20 transition-colors">
              <span class="material-symbols-outlined text-[32px]">settings</span>
            </div>
            <div>
              <h3 class="text-white font-semibold mb-1">Settings</h3>
              <p class="text-text-secondary text-sm">Configure system and preferences</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Activity / Live Status Section -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Recent Devices -->
        <div class="bg-surface-dark rounded-xl border border-border-dark overflow-hidden">
          <div class="px-5 py-4 border-b border-border-dark flex items-center justify-between">
            <h3 class="text-white font-semibold">Recent Devices</h3>
            <button @click="props.onNavigate('devices')" class="text-primary text-sm font-medium hover:underline">View All</button>
          </div>
          <div class="divide-y divide-border-dark">
            <div v-for="device in devices.slice(0, 4)" :key="device.id" class="px-5 py-3 flex items-center gap-4 hover:bg-surface-dark-highlight transition-colors">
              <div class="size-10 rounded-lg flex items-center justify-center shrink-0"
                :class="device.status.toLowerCase() === 'active' ? 'bg-green-500/10 text-green-400' : device.status.toLowerCase() === 'offline' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'">
                <span class="material-symbols-outlined">{{ device.status.toLowerCase() === 'active' ? 'check_circle' : device.status.toLowerCase() === 'offline' ? 'error' : 'warning' }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-white text-sm font-medium truncate">{{ device.name }}</p>
                <p class="text-text-secondary text-xs truncate">{{ device.location || 'Unknown Location' }}</p>
              </div>
              <span class="text-xs px-2 py-1 rounded-full"
                :class="device.status.toLowerCase() === 'active' ? 'bg-green-500/10 text-green-400' : device.status.toLowerCase() === 'offline' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'">
                {{ device.status }}
              </span>
            </div>
          </div>
        </div>

        <!-- Recent SIM Cards -->
        <div class="bg-surface-dark rounded-xl border border-border-dark overflow-hidden">
          <div class="px-5 py-4 border-b border-border-dark flex items-center justify-between">
            <h3 class="text-white font-semibold">Recent SIM Cards</h3>
            <button @click="props.onNavigate('sim-cards')" class="text-primary text-sm font-medium hover:underline">View All</button>
          </div>
          <div class="divide-y divide-border-dark">
            <div v-for="sim in simCards.slice(0, 4)" :key="sim.id" class="px-5 py-3 flex items-center gap-4 hover:bg-surface-dark-highlight transition-colors">
              <div class="size-10 rounded-lg flex items-center justify-center shrink-0"
                :class="sim.status.toLowerCase() === 'active' ? 'bg-teal-500/10 text-teal-400' : 'bg-gray-500/10 text-gray-400'">
                <span class="material-symbols-outlined">sim_card</span>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-white text-sm font-medium truncate">{{ sim.carrier }}</p>
                <p class="text-text-secondary text-xs truncate">{{ sim.iccid }}</p>
              </div>
              <div class="flex flex-col items-end">
                <span class="text-xs px-2 py-1 rounded-full"
                  :class="sim.status.toLowerCase() === 'active' ? 'bg-teal-500/10 text-teal-400' : 'bg-gray-500/10 text-gray-400'">
                  {{ sim.status }}
                </span>
                <span class="text-text-secondary text-xs mt-1">{{ Math.round((parseFloat(String(sim.dataUsed)) / parseFloat(String(sim.dataLimit))) * 100) || 0 }}% used</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Additional styles if needed */
</style>
