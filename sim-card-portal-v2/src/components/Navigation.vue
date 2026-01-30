<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'

// User type definition
interface User {
  username: string
  name: string
  role: string
  email: string
}

interface NavigationProps {
  currentPage: string
  onPageChange: (page: string) => void
  onLogout: () => void
  currentUser: User | null
}

const props = defineProps<NavigationProps>()

// Sidebar collapsed state with localStorage persistence
const STORAGE_KEY = 'sim-portal-sidebar-collapsed'
const collapsed = ref(false)

onMounted(() => {
  const stored = localStorage.getItem(STORAGE_KEY)
  collapsed.value = stored === 'true'
})

const toggleSidebar = () => {
  collapsed.value = !collapsed.value
  localStorage.setItem(STORAGE_KEY, String(collapsed.value))
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'devices', label: 'Devices', icon: 'router' },
  { id: 'sim-cards', label: 'SIM Cards', icon: 'sim_card' },
  { id: 'assets', label: 'Assets', icon: 'inventory_2' },
  { id: 'geozones', label: 'Geozones', icon: 'map' },
  { id: 'alerts', label: 'Alerts', icon: 'warning' },
  { id: 'alert-rules', label: 'Alert Rules', icon: 'rule' },
  { id: 'bulk-operations', label: 'Bulk Operations', icon: 'dynamic_feed' },
  { id: 'notifications', label: 'Notifications', icon: 'notifications' },
  { id: 'consumption', label: 'Consumption', icon: 'analytics' },
  { id: 'customer-dashboard', label: 'Customer View', icon: 'dashboard_customize' },
  { id: 'support', label: 'Support', icon: 'help' },
  { id: 'about', label: 'About', icon: 'info' }
]

// Use logged-in user or fallback to default
const userProfile = computed(() => ({
  name: props.currentUser?.name || 'Admin User',
  role: props.currentUser?.role || 'Super Admin'
}))

// Role-based page access restrictions
const rolePageRestrictions: Record<string, string[]> = {
  'DMP': ['sim-cards'],
  'DMP Viewer': ['sim-cards'],
  'CMP': ['devices'],
  'CMP Viewer': ['devices'],
}

// All logged-in users can access settings (viewers can reset their own password)
const canAccessSettings = computed(() => !!userProfile.value.role)

// Filter menu items based on current user's role
const filteredMenuItems = computed(() => {
  const restrictedPages = rolePageRestrictions[userProfile.value.role] || []
  return menuItems.filter(item => !restrictedPages.includes(item.id))
})
</script>

<template>
  <!-- Sidebar -->
  <aside
    class="flex-shrink-0 border-r border-border-dark bg-background-dark hidden lg:flex flex-col transition-all duration-300"
    :class="collapsed ? 'w-20' : 'w-64'"
  >
    <div class="p-4 flex flex-col h-full justify-between" :class="collapsed ? 'px-3' : 'p-6'">
      <div class="flex flex-col gap-6">
        <!-- Branding Area -->
        <div
          class="flex items-center gap-3 cursor-pointer"
          :class="collapsed ? 'justify-center px-0' : 'px-2'"
          @click="toggleSidebar"
          title="Toggle sidebar"
        >
          <div class="size-8 rounded bg-primary flex items-center justify-center text-white hover:bg-primary/80 transition-colors">
            <span class="material-symbols-outlined text-[20px]">hub</span>
          </div>
          <h1 v-if="!collapsed" class="text-lg font-bold tracking-tight text-white">IoTo</h1>
        </div>

        <!-- Navigation -->
        <nav class="flex flex-col gap-2">
          <a
            v-for="item in filteredMenuItems"
            :key="item.id"
            @click="props.onPageChange(item.id)"
            class="flex items-center gap-3 py-2.5 rounded-lg cursor-pointer transition-colors"
            :class="[
              props.currentPage === item.id
                ? 'bg-primary/10 text-primary border border-primary/10'
                : 'text-text-secondary hover:bg-surface-dark-highlight hover:text-white',
              collapsed ? 'justify-center px-2' : 'px-3'
            ]"
            :title="collapsed ? item.label : ''"
          >
            <span
              class="material-symbols-outlined text-[24px]"
              :class="props.currentPage === item.id ? 'fill-1' : ''"
            >{{ item.icon }}</span>
            <span v-if="!collapsed" class="text-sm font-medium">{{ item.label }}</span>
          </a>

          <!-- Settings - Admin users only -->
          <a
            v-if="canAccessSettings"
            @click="props.onPageChange('settings')"
            class="flex items-center gap-3 py-2.5 rounded-lg cursor-pointer transition-colors"
            :class="[
              props.currentPage === 'settings'
                ? 'bg-primary/10 text-primary border border-primary/10'
                : 'text-text-secondary hover:bg-surface-dark-highlight hover:text-white',
              collapsed ? 'justify-center px-2' : 'px-3'
            ]"
            :title="collapsed ? 'Settings' : ''"
          >
            <span
              class="material-symbols-outlined text-[24px]"
              :class="props.currentPage === 'settings' ? 'fill-1' : ''"
            >settings</span>
            <span v-if="!collapsed" class="text-sm font-medium">Settings</span>
          </a>
        </nav>
      </div>

      <!-- User Profile Bottom -->
      <div class="flex flex-col gap-4">
        <!-- Logout Button -->
        <button
          @click="props.onLogout"
          class="flex items-center gap-3 py-2.5 rounded-lg text-text-secondary hover:bg-red-500/10 hover:text-red-400 transition-colors"
          :class="collapsed ? 'justify-center px-2' : 'px-3'"
          :title="collapsed ? 'Log Out' : ''"
        >
          <span class="material-symbols-outlined text-[24px]">logout</span>
          <span v-if="!collapsed" class="text-sm font-medium">Log Out</span>
        </button>

        <!-- User Info Card -->
        <div
          class="flex items-center gap-3 py-3 rounded-lg border border-border-dark bg-surface-dark"
          :class="collapsed ? 'justify-center px-2' : 'px-3'"
          :title="collapsed ? `${userProfile.name} - ${userProfile.role}` : ''"
        >
          <div
            class="bg-center bg-no-repeat bg-cover rounded-full size-10 flex-shrink-0 flex items-center justify-center bg-primary text-white font-bold"
          >
            {{ userProfile.name.charAt(0) }}
          </div>
          <div v-if="!collapsed" class="flex flex-col min-w-0 flex-1">
            <p class="text-sm font-semibold truncate text-white">{{ userProfile.name }}</p>
            <p class="text-xs text-text-secondary truncate">{{ userProfile.role }}</p>
          </div>
        </div>
      </div>
    </div>
  </aside>

  <!-- Mobile Bottom Navigation (visible on small screens) -->
  <nav class="lg:hidden fixed bottom-0 left-0 right-0 bg-surface-dark border-t border-border-dark z-50">
    <div class="flex items-center justify-around py-2">
      <button
        v-for="item in filteredMenuItems"
        :key="item.id"
        @click="props.onPageChange(item.id)"
        class="flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors"
        :class="props.currentPage === item.id ? 'text-primary' : 'text-text-secondary'"
      >
        <span class="material-symbols-outlined text-[24px]">{{ item.icon }}</span>
        <span class="text-xs font-medium">{{ item.label }}</span>
      </button>
      <!-- Settings button for mobile (admin users only) -->
      <button
        v-if="canAccessSettings"
        @click="props.onPageChange('settings')"
        class="flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors"
        :class="props.currentPage === 'settings' ? 'text-primary' : 'text-text-secondary'"
      >
        <span class="material-symbols-outlined text-[24px]">settings</span>
        <span class="text-xs font-medium">Settings</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
/* No additional styles needed - all styling is done via Tailwind classes */
</style>
