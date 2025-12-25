<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Navigation from './Navigation.vue'
import WelcomePage from './WelcomePage.vue'
import DeviceList from './DeviceList.vue'
import SIMCardManagement from './SIMCardManagement.vue'
import ConsumptionPage from './consumption/ConsumptionPage.vue'
import UserSettings from './UserSettings.vue'
import AboutPage from './AboutPage.vue'
import AskBobPane from './consumption/AskBobPane.vue'

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
const currentPage = ref('dashboard')

// LLM enabled state (controlled by Super Admin)
const llmEnabled = ref(false)

// Ask Bob state
const showAskBob = ref(false)
const dateRange = ref({
  start: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1).toISOString().split('T')[0],
  end: new Date().toISOString().split('T')[0]
})

const loadLLMEnabled = () => {
  const stored = localStorage.getItem('sim-portal-llm-enabled')
  llmEnabled.value = stored === 'true'
}

// Listen for storage changes (in case Super Admin toggles it in another tab or same session)
const handleStorageChange = () => {
  loadLLMEnabled()
}

onMounted(() => {
  loadLLMEnabled()
  window.addEventListener('storage', handleStorageChange)
})

const handlePageChange = (page: string) => {
  currentPage.value = page
  // Re-check LLM enabled when navigating (in case it was changed in settings)
  loadLLMEnabled()
}

const handleRefresh = () => {
  window.location.reload()
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
          {{ currentPage === 'dashboard' ? 'System Overview' : currentPage === 'devices' ? 'Device Management' : currentPage === 'sim-cards' ? 'SIM Management' : currentPage === 'consumption' ? 'Consumption Analytics' : currentPage === 'settings' ? 'User Settings' : currentPage === 'about' ? 'About IoTo' : 'Support' }}
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
          <button class="p-2 text-text-secondary hover:text-primary transition-colors relative">
            <span class="material-symbols-outlined">notifications</span>
            <span class="absolute top-1.5 right-1.5 size-2 bg-red-500 rounded-full border-2 border-surface-dark"></span>
          </button>
          <button class="p-2 text-text-secondary hover:text-primary transition-colors">
            <span class="material-symbols-outlined">help</span>
          </button>
        </div>
      </header>

      <!-- Scrollable Content -->
      <div class="flex-1 overflow-y-auto">
        <WelcomePage v-if="currentPage === 'dashboard'" :onLogout="props.onLogout" :onNavigate="handlePageChange" />
        <DeviceList v-else-if="currentPage === 'devices'" />
        <SIMCardManagement v-else-if="currentPage === 'sim-cards'" />
        <ConsumptionPage v-else-if="currentPage === 'consumption'" />
        <UserSettings v-else-if="currentPage === 'settings'" :currentUser="props.currentUser" />
        <AboutPage v-else-if="currentPage === 'about'" />
        <div v-else-if="currentPage === 'support'" class="p-6 lg:p-8 overflow-y-auto">
          <div class="max-w-4xl mx-auto">
            <!-- Header -->
            <div class="text-center mb-8">
              <span class="material-symbols-outlined text-6xl text-primary mb-4">help</span>
              <h1 class="text-3xl font-bold text-white mb-2">User Guide</h1>
              <p class="text-text-secondary">Complete guide to using the IoTo Portal</p>
            </div>

            <!-- Table of Contents -->
            <div class="bg-surface-dark border border-border-dark rounded-xl p-6 mb-6">
              <h2 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span class="material-symbols-outlined text-primary">toc</span>
                Table of Contents
              </h2>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <a href="#getting-started" class="text-primary hover:underline">1. Getting Started</a>
                <a href="#dashboard" class="text-primary hover:underline">2. Dashboard Overview</a>
                <a href="#devices" class="text-primary hover:underline">3. Device Management</a>
                <a href="#sim-cards" class="text-primary hover:underline">4. SIM Card Management</a>
                <a href="#settings" class="text-primary hover:underline">5. User Settings (Admin)</a>
                <a href="#roles" class="text-primary hover:underline">6. User Roles & Permissions</a>
              </div>
            </div>

            <!-- 1. Getting Started -->
            <div id="getting-started" class="bg-surface-dark border border-border-dark rounded-xl p-6 mb-6">
              <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <span class="material-symbols-outlined text-green-400">rocket_launch</span>
                1. Getting Started
              </h2>
              <div class="space-y-4 text-text-secondary">
                <p>Welcome to the <span class="text-white font-medium">IoTo Portal</span> - your central hub for managing IoT devices and SIM cards.</p>

                <h3 class="text-white font-medium mt-4">Logging In</h3>
                <ul class="list-disc list-inside space-y-1 ml-2">
                  <li>Navigate to the login page</li>
                  <li>Enter your username and password provided by your administrator</li>
                  <li>Click "Log In" to access the portal</li>
                </ul>

                <h3 class="text-white font-medium mt-4">Navigation</h3>
                <ul class="list-disc list-inside space-y-1 ml-2">
                  <li><span class="text-white">Sidebar Menu</span> - Access all main sections (Dashboard, Devices, SIM Cards, Support)</li>
                  <li><span class="text-white">Refresh Button</span> - Reload the current page data</li>
                  <li><span class="text-white">User Profile</span> - View your account info at the bottom of the sidebar</li>
                  <li><span class="text-white">Log Out</span> - Securely exit the portal</li>
                </ul>
              </div>
            </div>

            <!-- 2. Dashboard -->
            <div id="dashboard" class="bg-surface-dark border border-border-dark rounded-xl p-6 mb-6">
              <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <span class="material-symbols-outlined text-primary">dashboard</span>
                2. Dashboard Overview
              </h2>
              <div class="space-y-4 text-text-secondary">
                <p>The Dashboard provides a quick overview of your entire IoT fleet.</p>

                <h3 class="text-white font-medium mt-4">KPI Cards</h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 ml-2">
                  <div class="flex items-start gap-2">
                    <span class="material-symbols-outlined text-primary text-lg">router</span>
                    <div>
                      <span class="text-white">Active Devices</span>
                      <p class="text-sm">Number of devices currently online</p>
                    </div>
                  </div>
                  <div class="flex items-start gap-2">
                    <span class="material-symbols-outlined text-teal-400 text-lg">sim_card</span>
                    <div>
                      <span class="text-white">Active SIMs</span>
                      <p class="text-sm">Number of SIM cards with active connections</p>
                    </div>
                  </div>
                  <div class="flex items-start gap-2">
                    <span class="material-symbols-outlined text-red-400 text-lg">signal_disconnected</span>
                    <div>
                      <span class="text-white">Offline Devices</span>
                      <p class="text-sm">Devices requiring attention</p>
                    </div>
                  </div>
                  <div class="flex items-start gap-2">
                    <span class="material-symbols-outlined text-amber-400 text-lg">schedule</span>
                    <div>
                      <span class="text-white">Expiring SIMs</span>
                      <p class="text-sm">SIMs expiring within 30 days</p>
                    </div>
                  </div>
                </div>

                <h3 class="text-white font-medium mt-4">Quick Actions</h3>
                <p>Click on any Quick Action card to navigate directly to that section.</p>

                <h3 class="text-white font-medium mt-4">Recent Activity</h3>
                <p>View the latest devices and SIM cards with their current status.</p>
              </div>
            </div>

            <!-- 3. Device Management -->
            <div id="devices" class="bg-surface-dark border border-border-dark rounded-xl p-6 mb-6">
              <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <span class="material-symbols-outlined text-primary">router</span>
                3. Device Management
              </h2>
              <div class="space-y-4 text-text-secondary">
                <p>Manage and monitor all your IoT devices from a single interface.</p>

                <h3 class="text-white font-medium mt-4">Device List</h3>
                <ul class="list-disc list-inside space-y-1 ml-2">
                  <li><span class="text-white">Search</span> - Filter devices by name, ID, or location</li>
                  <li><span class="text-white">Sort</span> - Click column headers to sort the table</li>
                  <li><span class="text-white">Status Filter</span> - Filter by Active, Offline, or Maintenance status</li>
                </ul>

                <h3 class="text-white font-medium mt-4">Device Details</h3>
                <p>Click on any device row to view detailed information:</p>
                <ul class="list-disc list-inside space-y-1 ml-2">
                  <li><span class="text-white">Overview</span> - Device name, type, status, and location</li>
                  <li><span class="text-white">SIM Card Info</span> - Associated SIM card details</li>
                  <li><span class="text-white">Signal Strength</span> - Current connection quality</li>
                  <li><span class="text-white">Data Usage</span> - Current period data consumption</li>
                  <li><span class="text-white">Sensor History</span> - Historical sensor readings chart</li>
                  <li><span class="text-white">Route History</span> - GPS tracking map (if available)</li>
                </ul>

                <h3 class="text-white font-medium mt-4">Device Status Indicators</h3>
                <div class="flex flex-wrap gap-3 ml-2">
                  <span class="px-2 py-1 rounded text-xs bg-green-500/10 text-green-400">Active - Online and working</span>
                  <span class="px-2 py-1 rounded text-xs bg-red-500/10 text-red-400">Offline - No connection</span>
                  <span class="px-2 py-1 rounded text-xs bg-amber-500/10 text-amber-400">Maintenance - Under service</span>
                </div>
              </div>
            </div>

            <!-- 4. SIM Card Management -->
            <div id="sim-cards" class="bg-surface-dark border border-border-dark rounded-xl p-6 mb-6">
              <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <span class="material-symbols-outlined text-teal-400">sim_card</span>
                4. SIM Card Management
              </h2>
              <div class="space-y-4 text-text-secondary">
                <p>Track and manage all SIM cards in your fleet.</p>

                <h3 class="text-white font-medium mt-4">SIM Card List</h3>
                <ul class="list-disc list-inside space-y-1 ml-2">
                  <li><span class="text-white">ICCID</span> - Unique SIM card identifier</li>
                  <li><span class="text-white">Carrier</span> - Network provider</li>
                  <li><span class="text-white">Status</span> - Active, Inactive, or Suspended</li>
                  <li><span class="text-white">Data Usage</span> - Current usage vs. limit</li>
                  <li><span class="text-white">Expiry Date</span> - When the SIM plan expires</li>
                </ul>

                <h3 class="text-white font-medium mt-4">SIM Card Actions</h3>
                <ul class="list-disc list-inside space-y-1 ml-2">
                  <li><span class="text-white">View Details</span> - See full SIM card information</li>
                  <li><span class="text-white">Edit</span> - Update SIM card settings</li>
                  <li><span class="text-white">Activate/Deactivate</span> - Change SIM status</li>
                </ul>

                <h3 class="text-white font-medium mt-4">Data Usage Monitoring</h3>
                <p>The usage bar shows data consumption as a percentage of the total limit:</p>
                <div class="flex flex-wrap gap-3 ml-2 mt-2">
                  <span class="px-2 py-1 rounded text-xs bg-green-500/10 text-green-400">0-70% - Normal usage</span>
                  <span class="px-2 py-1 rounded text-xs bg-amber-500/10 text-amber-400">70-90% - High usage</span>
                  <span class="px-2 py-1 rounded text-xs bg-red-500/10 text-red-400">90%+ - Critical</span>
                </div>
              </div>
            </div>

            <!-- 5. User Settings -->
            <div id="settings" class="bg-surface-dark border border-border-dark rounded-xl p-6 mb-6">
              <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <span class="material-symbols-outlined text-purple-400">settings</span>
                5. User Settings (Admin Only)
              </h2>
              <div class="space-y-4 text-text-secondary">
                <p>Administrators can manage user accounts from the Settings page.</p>

                <div class="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-amber-300 text-sm">
                  <span class="material-symbols-outlined text-lg align-middle mr-1">info</span>
                  This section is only visible to users with Admin roles.
                </div>

                <h3 class="text-white font-medium mt-4">User Management</h3>
                <ul class="list-disc list-inside space-y-1 ml-2">
                  <li><span class="text-white">Add User</span> - Create new user accounts</li>
                  <li><span class="text-white">Edit User</span> - Update username, email, role, or status</li>
                  <li><span class="text-white">Reset Password</span> - Set a new password for a user</li>
                  <li><span class="text-white">Activate/Deactivate</span> - Enable or disable user access</li>
                  <li><span class="text-white">Delete User</span> - Remove user accounts (except Super Admin)</li>
                </ul>

                <h3 class="text-white font-medium mt-4">User Status</h3>
                <div class="flex flex-wrap gap-3 ml-2">
                  <span class="px-2 py-1 rounded text-xs bg-green-500/10 text-green-400">Active - Can log in</span>
                  <span class="px-2 py-1 rounded text-xs bg-red-500/10 text-red-400">Inactive - Access disabled</span>
                  <span class="px-2 py-1 rounded text-xs bg-yellow-500/10 text-yellow-400">Pending - Awaiting activation</span>
                </div>
              </div>
            </div>

            <!-- 6. User Roles -->
            <div id="roles" class="bg-surface-dark border border-border-dark rounded-xl p-6 mb-6">
              <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <span class="material-symbols-outlined text-indigo-400">admin_panel_settings</span>
                6. User Roles & Permissions
              </h2>
              <div class="space-y-4 text-text-secondary">
                <p>The portal uses role-based access control to manage permissions.</p>

                <h3 class="text-white font-medium mt-4">Role Hierarchy</h3>
                <div class="overflow-x-auto">
                  <table class="w-full text-sm mt-2">
                    <thead>
                      <tr class="border-b border-border-dark">
                        <th class="text-left py-2 px-3 text-text-secondary font-medium">Role</th>
                        <th class="text-left py-2 px-3 text-text-secondary font-medium">Access</th>
                        <th class="text-left py-2 px-3 text-text-secondary font-medium">Can Manage</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-border-dark">
                      <tr>
                        <td class="py-2 px-3"><span class="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400">Super Admin</span></td>
                        <td class="py-2 px-3 text-white">All pages</td>
                        <td class="py-2 px-3">All user roles</td>
                      </tr>
                      <tr>
                        <td class="py-2 px-3"><span class="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400">Admin</span></td>
                        <td class="py-2 px-3 text-white">All pages</td>
                        <td class="py-2 px-3">Admin, Viewer</td>
                      </tr>
                      <tr>
                        <td class="py-2 px-3"><span class="px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-400">FMP</span></td>
                        <td class="py-2 px-3 text-white">All pages</td>
                        <td class="py-2 px-3">FMP, FMP Viewer</td>
                      </tr>
                      <tr>
                        <td class="py-2 px-3"><span class="px-2 py-0.5 rounded text-xs bg-orange-500/20 text-orange-400">DMP</span></td>
                        <td class="py-2 px-3 text-white">Dashboard, Devices, Support</td>
                        <td class="py-2 px-3">DMP, DMP Viewer</td>
                      </tr>
                      <tr>
                        <td class="py-2 px-3"><span class="px-2 py-0.5 rounded text-xs bg-pink-500/20 text-pink-400">CMP</span></td>
                        <td class="py-2 px-3 text-white">Dashboard, SIM Cards, Support</td>
                        <td class="py-2 px-3">CMP, CMP Viewer</td>
                      </tr>
                      <tr>
                        <td class="py-2 px-3"><span class="px-2 py-0.5 rounded text-xs bg-gray-500/20 text-gray-400">Viewer</span></td>
                        <td class="py-2 px-3 text-white">All pages (read-only)</td>
                        <td class="py-2 px-3">None</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <h3 class="text-white font-medium mt-4">Portal Types</h3>
                <ul class="list-disc list-inside space-y-1 ml-2">
                  <li><span class="text-white">FMP</span> - Fleet Management Portal (full access)</li>
                  <li><span class="text-white">DMP</span> - Device Management Portal (devices only)</li>
                  <li><span class="text-white">CMP</span> - Connectivity Management Portal (SIM cards only)</li>
                </ul>
              </div>
            </div>

            <!-- Contact Support -->
            <div class="bg-surface-dark border border-border-dark rounded-xl p-6">
              <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <span class="material-symbols-outlined text-primary">support_agent</span>
                Need Help?
              </h2>
              <div class="space-y-4 text-text-secondary">
                <p>If you need further assistance, please contact our support team:</p>
                <div class="flex flex-col sm:flex-row gap-4">
                  <a href="mailto:support@ioto.com" class="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
                    <span class="material-symbols-outlined">mail</span>
                    support@ioto.com
                  </a>
                  <a href="tel:+1234567890" class="flex items-center gap-2 px-4 py-2 bg-surface-dark-highlight text-white rounded-lg hover:bg-border-dark transition-colors">
                    <span class="material-symbols-outlined">call</span>
                    +1 (234) 567-890
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

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
