<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import Navigation from './Navigation.vue'
import WelcomePage from './WelcomePage.vue'
import DeviceList from './DeviceList.vue'
import SIMCardManagement from './SIMCardManagement.vue'
import ConsumptionPage from './consumption/ConsumptionPage.vue'
import UserSettings from './UserSettings.vue'
import AboutPage from './AboutPage.vue'
import AskBobPane from './consumption/AskBobPane.vue'
import AssetsPage from './AssetsPage.vue'
import AssetDetailPage from './AssetDetailPage.vue'
import GeozonesPage from './GeozonesPage.vue'
import GeozoneDetailPage from './GeozoneDetailPage.vue'
import GeozoneEditorPage from './GeozoneEditorPage.vue'
import CustomerDashboardPage from './CustomerDashboardPage.vue'
// Sprint 4: Alerts & Geofencing
import AlertDashboardPage from './AlertDashboardPage.vue'
import AlertDetailPage from './AlertDetailPage.vue'
import AlertRulesPage from './AlertRulesPage.vue'
import AlertRuleEditorPage from './AlertRuleEditorPage.vue'
import NotificationsPage from './NotificationsPage.vue'
// Sprint 5: Bulk Operations
import BulkOperationsPage from './BulkOperationsPage.vue'
// Sprint 6: NLQ + Chat
import BobSupportPage from './BobSupportPage.vue'

// API Base URL
const API_BASE_URL = window.location.origin

// User type definition
interface User {
  username: string
  name: string
  role: string
  email: string
}

interface DashboardProps {
  onLogout: () => void
  currentUser: User | null
}

const props = defineProps<DashboardProps>()

// Valid pages list
const validPages = ['dashboard', 'devices', 'sim-cards', 'assets', 'geozones', 'consumption', 'customer-dashboard', 'alerts', 'alert-rules', 'alert-rule-editor', 'bulk-operations', 'notifications', 'settings', 'about', 'support']

// Sprint 3: Asset & Geozone detail/editor state
const selectedAssetId = ref<string | null>(null)
const selectedGeozoneId = ref<string | null>(null)
const showGeozoneEditor = ref(false)
const editingGeozoneId = ref<string | null>(null)

const handleSelectAsset = (assetId: string) => {
  selectedAssetId.value = assetId
}
const handleCloseAssetDetail = () => {
  selectedAssetId.value = null
}
const handleSelectGeozone = (geozoneId: string) => {
  selectedGeozoneId.value = geozoneId
}
const handleCloseGeozoneDetail = () => {
  selectedGeozoneId.value = null
}
const handleCreateGeozone = () => {
  editingGeozoneId.value = null
  showGeozoneEditor.value = true
}
const handleEditGeozone = () => {
  editingGeozoneId.value = selectedGeozoneId.value
  selectedGeozoneId.value = null
  showGeozoneEditor.value = true
}
const handleCloseGeozoneEditor = () => {
  showGeozoneEditor.value = false
  editingGeozoneId.value = null
}
const handleGeozoneSaved = () => {
  showGeozoneEditor.value = false
  editingGeozoneId.value = null
  refreshKey.value++
}

// Sprint 4: Alert & Notification state
const selectedAlertId = ref<string | null>(null)
const editingAlertRuleId = ref<string | null>(null)
const unreadNotificationCount = ref(0)
let notificationPollInterval: ReturnType<typeof setInterval> | null = null

const handleSelectAlert = (alertId: string) => {
  selectedAlertId.value = alertId
}
const handleCloseAlertDetail = () => {
  selectedAlertId.value = null
}
const handleNavigateToRules = () => {
  currentPage.value = 'alert-rules'
}
const handleCreateAlertRule = () => {
  editingAlertRuleId.value = null
  currentPage.value = 'alert-rule-editor'
}
const handleEditAlertRule = (ruleId: string) => {
  editingAlertRuleId.value = ruleId
  currentPage.value = 'alert-rule-editor'
}
const handleAlertRuleEditorClose = () => {
  currentPage.value = 'alert-rules'
  editingAlertRuleId.value = null
}
const handleAlertRuleSaved = () => {
  currentPage.value = 'alert-rules'
  editingAlertRuleId.value = null
  refreshKey.value++
}
const handleNavigateToNotifications = () => {
  currentPage.value = 'notifications'
}

const fetchUnreadCount = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/notifications/unread-count`)
    const result = await response.json()
    if (result.success) {
      unreadNotificationCount.value = result.data.count
    }
  } catch {
    // Silently fail for polling
  }
}

// Load saved page from localStorage or default to 'dashboard'
const savedPage = localStorage.getItem('sim-portal-current-page')
const initialPage = savedPage && validPages.includes(savedPage) ? savedPage : 'dashboard'
const currentPage = ref(initialPage)

// Persist current page to localStorage when it changes
watch(currentPage, (newPage) => {
  localStorage.setItem('sim-portal-current-page', newPage)
})

// Refresh key - incrementing triggers data refresh in child components
const refreshKey = ref(0)

// LLM enabled state (controlled by Super Admin)
const llmEnabled = ref(false)

// Ask Bob state
const showAskBob = ref(false)
const dateRange = ref({
  start: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1).toISOString().split('T')[0],
  end: new Date().toISOString().split('T')[0]
})

const loadLLMEnabled = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/settings/llm`)
    const result = await response.json()
    if (result.success) {
      llmEnabled.value = result.data.enabled || false
      // Also sync to localStorage for backward compatibility
      localStorage.setItem('sim-portal-llm-enabled', String(llmEnabled.value))
    }
  } catch (error) {
    // Fallback to localStorage if API fails
    const stored = localStorage.getItem('sim-portal-llm-enabled')
    llmEnabled.value = stored === 'true'
  }
}

// Listen for storage changes (in case Super Admin toggles it in another tab or same session)
const handleStorageChange = () => {
  loadLLMEnabled()
}

onMounted(() => {
  loadLLMEnabled()
  window.addEventListener('storage', handleStorageChange)
  // Sprint 4: Start notification polling
  fetchUnreadCount()
  notificationPollInterval = setInterval(fetchUnreadCount, 30000)
})

onUnmounted(() => {
  if (notificationPollInterval) clearInterval(notificationPollInterval)
})

const handlePageChange = (page: string) => {
  currentPage.value = page
  // Re-check LLM enabled when navigating (in case it was changed in settings)
  loadLLMEnabled()
}

const handleRefresh = () => {
  refreshKey.value++
}

const toggleAskBob = () => {
  showAskBob.value = !showAskBob.value
}
</script>

<template>
  <div class="flex h-screen w-full overflow-hidden bg-background-dark">
    <!-- Sidebar Navigation -->
    <Navigation
      :currentPage="currentPage"
      :onPageChange="handlePageChange"
      :onLogout="props.onLogout"
      :currentUser="props.currentUser"
    />

    <!-- Main Content Area -->
    <main class="flex-1 flex flex-col min-w-0 overflow-hidden bg-background-dark">
      <!-- Top Header Bar -->
      <header class="h-16 border-b border-border-dark bg-surface-dark px-4 lg:px-6 flex items-center gap-4 shrink-0 z-[10000]">
        <!-- Page Title (hidden on mobile to save space) -->
        <h2 class="text-lg font-bold text-white hidden lg:block whitespace-nowrap">
          {{ currentPage === 'dashboard' ? 'System Overview' : currentPage === 'devices' ? 'Device Management' : currentPage === 'sim-cards' ? 'SIM Management' : currentPage === 'assets' ? 'Asset Management' : currentPage === 'geozones' ? 'Geozone Management' : currentPage === 'consumption' ? 'Consumption Analytics' : currentPage === 'customer-dashboard' ? 'Customer Dashboard' : currentPage === 'alerts' ? 'Alert Dashboard' : currentPage === 'alert-rules' ? 'Alert Rules' : currentPage === 'alert-rule-editor' ? (editingAlertRuleId ? 'Edit Alert Rule' : 'New Alert Rule') : currentPage === 'bulk-operations' ? 'Bulk Operations' : currentPage === 'notifications' ? 'Notifications' : currentPage === 'settings' ? 'User Settings' : currentPage === 'about' ? 'About IoTo' : 'Bob Support' }}
        </h2>

        <!-- Spacer to push actions to the right -->
        <div class="flex-1"></div>

        <!-- Right side actions -->
        <div class="flex items-center gap-2 shrink-0">
          <!-- Ask Bob button (only when LLM is enabled and not on consumption page) -->
          <button
            v-if="llmEnabled && currentPage !== 'consumption'"
            @click="toggleAskBob"
            :class="[
              'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
              showAskBob ? 'bg-primary text-white' : 'bg-primary/10 text-primary hover:bg-primary/20'
            ]"
          >
            <span class="material-symbols-outlined text-[18px]">smart_toy</span>
            <span class="hidden sm:inline">Ask Bob</span>
          </button>
          <button @click="handleRefresh" class="flex items-center gap-2 px-3 py-1.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors shadow-sm shadow-blue-500/20">
            <span class="material-symbols-outlined text-[18px]">refresh</span>
            <span class="hidden sm:inline">Refresh</span>
          </button>
          <button @click="handleNavigateToNotifications" class="p-2 text-text-secondary hover:text-primary transition-colors relative">
            <span class="material-symbols-outlined">notifications</span>
            <span v-if="unreadNotificationCount > 0" class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 rounded-full border-2 border-surface-dark text-[10px] font-bold text-white px-1">
              {{ unreadNotificationCount > 99 ? '99+' : unreadNotificationCount }}
            </span>
          </button>
          <button class="p-2 text-text-secondary hover:text-primary transition-colors">
            <span class="material-symbols-outlined">help</span>
          </button>
        </div>
      </header>

      <!-- Scrollable Content -->
      <div class="flex-1 overflow-y-auto">
        <WelcomePage v-if="currentPage === 'dashboard'" :key="'welcome-' + refreshKey" :onLogout="props.onLogout" :onNavigate="handlePageChange" />
        <DeviceList v-else-if="currentPage === 'devices'" :key="'devices-' + refreshKey" />
        <SIMCardManagement v-else-if="currentPage === 'sim-cards'" :key="'sim-' + refreshKey" />
        <AssetsPage v-else-if="currentPage === 'assets'" :key="'assets-' + refreshKey" @selectAsset="handleSelectAsset" />
        <GeozonesPage v-else-if="currentPage === 'geozones'" :key="'geozones-' + refreshKey" @selectGeozone="handleSelectGeozone" @createGeozone="handleCreateGeozone" />
        <CustomerDashboardPage v-else-if="currentPage === 'customer-dashboard'" :key="'cust-dash-' + refreshKey" @selectAsset="handleSelectAsset" />
        <ConsumptionPage v-else-if="currentPage === 'consumption'" :key="'consumption-' + refreshKey" />
        <AlertDashboardPage v-else-if="currentPage === 'alerts'" :key="'alerts-' + refreshKey" @selectAlert="handleSelectAlert" @navigateToRules="handleNavigateToRules" @navigateToNotifications="handleNavigateToNotifications" />
        <AlertRulesPage v-else-if="currentPage === 'alert-rules'" :key="'alert-rules-' + refreshKey" @editRule="handleEditAlertRule" @createRule="handleCreateAlertRule" />
        <AlertRuleEditorPage v-else-if="currentPage === 'alert-rule-editor'" :ruleId="editingAlertRuleId" @close="handleAlertRuleEditorClose" @saved="handleAlertRuleSaved" />
        <BulkOperationsPage v-else-if="currentPage === 'bulk-operations'" :key="'bulk-ops-' + refreshKey" />
        <NotificationsPage v-else-if="currentPage === 'notifications'" :key="'notifications-' + refreshKey" @selectAlert="handleSelectAlert" />
        <UserSettings v-else-if="currentPage === 'settings'" :currentUser="props.currentUser" />
        <AboutPage v-else-if="currentPage === 'about'" />
        <BobSupportPage v-else-if="currentPage === 'support'" :key="'support-' + refreshKey" />
      </div>
    </main>

    <!-- Sprint 3: Asset Detail Dialog -->
    <AssetDetailPage
      v-if="selectedAssetId"
      :assetId="selectedAssetId"
      :onClose="handleCloseAssetDetail"
    />

    <!-- Sprint 4: Alert Detail Dialog -->
    <AlertDetailPage
      v-if="selectedAlertId"
      :alertId="selectedAlertId"
      @close="handleCloseAlertDetail"
      @selectAsset="handleSelectAsset"
      @selectGeozone="handleSelectGeozone"
    />

    <!-- Sprint 3: Geozone Detail Dialog -->
    <GeozoneDetailPage
      v-if="selectedGeozoneId"
      :geozoneId="selectedGeozoneId"
      :onClose="handleCloseGeozoneDetail"
      @editGeozone="handleEditGeozone"
    />

    <!-- Sprint 3: Geozone Editor Dialog -->
    <GeozoneEditorPage
      v-if="showGeozoneEditor"
      :geozoneId="editingGeozoneId"
      :onClose="handleCloseGeozoneEditor"
      :onSaved="handleGeozoneSaved"
    />

    <!-- Global Ask Bob Side Panel -->
    <Transition name="slide">
      <div
        v-if="showAskBob && llmEnabled && currentPage !== 'consumption'"
        class="fixed right-0 top-[64px] bottom-0 w-full lg:w-[400px] bg-surface-dark border-l border-border-dark z-[9999] flex flex-col"
      >
        <AskBobPane :dateRange="dateRange" @close="showAskBob = false" />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Ask Bob slide animation */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>
