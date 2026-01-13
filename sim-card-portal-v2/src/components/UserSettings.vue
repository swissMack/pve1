<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Toast from 'primevue/toast'
import ConfirmDialog from 'primevue/confirmdialog'
import Password from 'primevue/password'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { FilterMatchMode } from '@primevue/core/api'
import { useAppSettings, SUPPORTED_CURRENCIES } from '../composables/useAppSettings'

// User type definition
interface User {
  username: string
  name: string
  role: string
  email: string
}

// API Key configuration interface
interface ApiKeyConfig {
  hashedKey: string
  provider: string
  maskedKey: string
  createdAt: string
}

// API Client (Mediation) interface
interface MediationApiClient {
  id: string
  name: string
  description: string | null
  apiKeyPrefix: string
  permissions: string[]
  isActive: boolean
  lastUsedAt: string | null
  createdAt: string
  updatedAt: string
}

type UserRole = 'Super Admin' | 'Admin' | 'Viewer' | 'FMP' | 'FMP Viewer' | 'DMP' | 'DMP Viewer' | 'CMP' | 'CMP Viewer'

interface ManagedUser {
  id: string
  username: string
  email: string
  role: UserRole
  status: 'Active' | 'Inactive' | 'Pending'
  lastLogin: string
  createdAt: string
}

interface Props {
  currentUser: User | null
}

const props = defineProps<Props>()

const toast = useToast()
const confirm = useConfirm()

// App Settings (currency)
const { currency, setCurrency } = useAppSettings()
const currencyOptions = SUPPORTED_CURRENCIES.map(c => ({ label: `${c.code} - ${c.name}`, value: c.code }))

const isSavingCurrency = ref(false)

async function handleCurrencyChange(newCurrency: string) {
  isSavingCurrency.value = true
  try {
    const success = await setCurrency(newCurrency as any)
    if (success) {
      toast.add({
        severity: 'success',
        summary: 'Currency Updated',
        detail: `Display currency changed to ${newCurrency}. Reload the Consumption page to see updated values.`,
        life: 4000
      })
    } else {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to save currency setting to server',
        life: 3000
      })
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to save currency setting',
      life: 3000
    })
  } finally {
    isSavingCurrency.value = false
  }
}

// User profile computed
const userProfile = computed(() => ({
  name: props.currentUser?.name || 'Admin User',
  role: props.currentUser?.role || 'Super Admin'
}))

// Role hierarchy - defines which roles each admin type can manage/create
const roleCreationPermissions: Record<string, string[]> = {
  'Super Admin': ['Super Admin', 'Admin', 'Viewer', 'FMP', 'FMP Viewer', 'DMP', 'DMP Viewer', 'CMP', 'CMP Viewer'],
  'Admin': ['Admin', 'Viewer'],
  'FMP': ['FMP', 'FMP Viewer'],
  'DMP': ['DMP', 'DMP Viewer'],
  'CMP': ['CMP', 'CMP Viewer'],
  'Viewer': [],
  'FMP Viewer': [],
  'DMP Viewer': [],
  'CMP Viewer': [],
}

// Viewer roles can only reset their own password
const viewerRoles = ['Viewer', 'FMP Viewer', 'DMP Viewer', 'CMP Viewer']

// Check if current user is a viewer
const isViewer = computed(() => viewerRoles.includes(userProfile.value.role))

// Check if current user can manage other users
const canManageUsers = computed(() => !isViewer.value)

// Mock user data
const allUsers = ref<ManagedUser[]>([
  { id: '1', username: 'admin', email: 'admin@ioto.com', role: 'Super Admin', status: 'Active', lastLogin: '2024-01-15 14:30', createdAt: '2023-06-01' },
  { id: '2', username: 'john.admin', email: 'john@ioto.com', role: 'Admin', status: 'Active', lastLogin: '2024-01-15 10:15', createdAt: '2023-08-15' },
  { id: '3', username: 'fmp.manager', email: 'fmp.manager@ioto.com', role: 'FMP', status: 'Active', lastLogin: '2024-01-14 16:45', createdAt: '2023-09-20' },
  { id: '4', username: 'fmp.user1', email: 'fmp.user1@ioto.com', role: 'FMP Viewer', status: 'Active', lastLogin: '2024-01-15 08:30', createdAt: '2023-10-05' },
  { id: '5', username: 'fmp.user2', email: 'fmp.user2@ioto.com', role: 'FMP Viewer', status: 'Inactive', lastLogin: '2024-01-10 12:00', createdAt: '2023-11-12' },
  { id: '6', username: 'dmp.manager', email: 'dmp.manager@ioto.com', role: 'DMP', status: 'Active', lastLogin: '2024-01-15 09:20', createdAt: '2023-09-22' },
  { id: '7', username: 'dmp.user1', email: 'dmp.user1@ioto.com', role: 'DMP Viewer', status: 'Active', lastLogin: '2024-01-14 15:30', createdAt: '2023-10-18' },
  { id: '8', username: 'dmp.user2', email: 'dmp.user2@ioto.com', role: 'DMP Viewer', status: 'Pending', lastLogin: 'Never', createdAt: '2024-01-10' },
  { id: '9', username: 'cmp.manager', email: 'cmp.manager@ioto.com', role: 'CMP', status: 'Active', lastLogin: '2024-01-15 11:45', createdAt: '2023-09-25' },
  { id: '10', username: 'cmp.user1', email: 'cmp.user1@ioto.com', role: 'CMP Viewer', status: 'Active', lastLogin: '2024-01-15 13:00', createdAt: '2023-10-22' },
  { id: '11', username: 'cmp.user2', email: 'cmp.user2@ioto.com', role: 'CMP Viewer', status: 'Inactive', lastLogin: '2024-01-05 10:15', createdAt: '2023-11-30' },
  { id: '12', username: 'viewer1', email: 'viewer1@ioto.com', role: 'Viewer', status: 'Active', lastLogin: '2024-01-14 14:00', createdAt: '2023-12-01' },
])

// Filter users based on current admin's role
const managedUsers = computed(() => {
  const currentRole = userProfile.value.role
  const currentUsername = props.currentUser?.username
  const allowedRoles = roleCreationPermissions[currentRole] || []

  // Viewers can only see themselves
  if (isViewer.value) {
    return allUsers.value.filter(user => user.username === currentUsername)
  }

  // Super Admin sees all users
  if (currentRole === 'Super Admin') {
    return allUsers.value
  }

  // Other admins see only users with roles they can manage
  return allUsers.value.filter(user => allowedRoles.includes(user.role))
})

// Computed role options based on current user's role
const roleOptions = computed(() => {
  const currentRole = userProfile.value.role
  return (roleCreationPermissions[currentRole] || []).map(role => ({ label: role, value: role }))
})

const statusOptions = [
  { label: 'Active', value: 'Active' },
  { label: 'Inactive', value: 'Inactive' },
  { label: 'Pending', value: 'Pending' }
]

// DataTable filters
const filters = ref({
  global: { value: null, matchMode: FilterMatchMode.CONTAINS }
})

// Dialog states
const showAddUserDialog = ref(false)
const showEditUserDialog = ref(false)
const showResetPasswordDialog = ref(false)

// Selected user for editing
const selectedUser = ref<ManagedUser | null>(null)

// New user form
const newUser = ref({
  username: '',
  email: '',
  role: '' as UserRole | '',
  password: ''
})

// Edit user form
const editUserForm = ref({
  username: '',
  email: '',
  role: '' as UserRole | '',
  status: 'Active' as 'Active' | 'Inactive' | 'Pending'
})

// Reset password form
const resetPasswordForm = ref({
  newPassword: '',
  confirmPassword: ''
})

// API Key Management (Super Admin only)
const isSuperAdmin = computed(() => userProfile.value.role === 'Super Admin')
const apiKeyConfig = ref<ApiKeyConfig | null>(null)
const showAddApiKeyDialog = ref(false)
const apiKeyForm = ref({
  apiKey: '',
  provider: 'OpenAI'
})
const isSavingApiKey = ref(false)

// LLM Enable/Disable (Super Admin only - affects all users)
const llmEnabled = ref(false)

const llmProviderOptions = [
  { label: 'OpenAI', value: 'OpenAI' },
  { label: 'Anthropic', value: 'Anthropic' },
  { label: 'Google Gemini', value: 'Google Gemini' },
  { label: 'Azure OpenAI', value: 'Azure OpenAI' },
  { label: 'Cohere', value: 'Cohere' },
  { label: 'Other', value: 'Other' }
]

// API Base URL for backend calls
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Load API key config from backend
async function loadApiKeyConfig() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/settings/llm`)
    const result = await response.json()
    if (result.success && result.data.hasApiKey) {
      apiKeyConfig.value = {
        hashedKey: '', // Not returned from backend
        provider: result.data.provider,
        maskedKey: result.data.maskedKey,
        createdAt: new Date().toISOString()
      }
    } else {
      apiKeyConfig.value = null
    }
  } catch (error) {
    console.error('Error loading LLM config:', error)
    apiKeyConfig.value = null
  }
}

// Save API key config to backend
async function saveApiKey() {
  if (!apiKeyForm.value.apiKey) {
    toast.add({ severity: 'error', summary: 'Validation Error', detail: 'Please enter an API key', life: 3000 })
    return
  }

  isSavingApiKey.value = true

  try {
    // Send API key to backend (stored securely server-side)
    const response = await fetch(`${API_BASE_URL}/api/settings/llm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: apiKeyForm.value.apiKey,
        provider: apiKeyForm.value.provider
      })
    })

    const result = await response.json()
    if (!result.success) {
      throw new Error(result.error || 'Failed to save API key')
    }

    // Reload config from backend to get masked key
    await loadApiKeyConfig()

    showAddApiKeyDialog.value = false
    apiKeyForm.value = { apiKey: '', provider: 'Anthropic' }
    toast.add({ severity: 'success', summary: 'Success', detail: 'API key saved successfully', life: 3000 })
  } catch (error) {
    console.error('Error saving API key:', error)
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to save API key', life: 3000 })
  } finally {
    isSavingApiKey.value = false
  }
}

// Delete API key
function deleteApiKey() {
  confirm.require({
    message: 'Are you sure you want to delete the API key? This action cannot be undone.',
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Cancel',
    acceptLabel: 'Delete',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/settings/llm`, {
          method: 'DELETE'
        })
        const result = await response.json()
        if (!result.success) {
          throw new Error(result.error || 'Failed to delete API key')
        }
        apiKeyConfig.value = null
        toast.add({ severity: 'success', summary: 'Success', detail: 'API key deleted successfully', life: 3000 })
      } catch (error) {
        console.error('Error deleting API key:', error)
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete API key', life: 3000 })
      }
    }
  })
}

// Open add API key dialog
function openAddApiKeyDialog() {
  apiKeyForm.value = { apiKey: '', provider: 'Anthropic' }
  showAddApiKeyDialog.value = true
}

// LLM Enable/Disable functions
async function loadLLMEnabled() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/settings/llm`)
    const result = await response.json()
    if (result.success) {
      llmEnabled.value = result.data.enabled || false
    }
  } catch (error) {
    console.error('Error loading LLM enabled status:', error)
  }
}

async function toggleLLMEnabled() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/settings/llm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: llmEnabled.value })
    })
    const result = await response.json()
    if (!result.success) {
      throw new Error(result.error)
    }
    // Also update localStorage for other components that might still use it
    localStorage.setItem('sim-portal-llm-enabled', String(llmEnabled.value))
    toast.add({
      severity: llmEnabled.value ? 'success' : 'info',
      summary: llmEnabled.value ? 'LLM Enabled' : 'LLM Disabled',
      detail: llmEnabled.value
        ? 'Ask Bob is now available for all users'
        : 'Ask Bob is now hidden for all users',
      life: 3000
    })
  } catch (error) {
    console.error('Error toggling LLM:', error)
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to update LLM setting', life: 3000 })
  }
}

// ============ API Clients Management (Mediation) ============
const apiClients = ref<MediationApiClient[]>([])
const isLoadingApiClients = ref(false)
const showCreateApiClientDialog = ref(false)
const showNewApiKeyDialog = ref(false)
const newApiClientForm = ref({ name: '', description: '' })
const newlyGeneratedApiKey = ref('')
const isCreatingApiClient = ref(false)

async function loadApiClients() {
  isLoadingApiClients.value = true
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/api-clients`, {
      headers: {
        'Content-Type': 'application/json'
      }
    })
    if (response.ok) {
      const result = await response.json()
      apiClients.value = result.data || []
    } else {
      console.error('Failed to load API clients:', response.status)
      // Don't show error toast if it's just 401 (not authenticated)
      if (response.status !== 401) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load API clients', life: 3000 })
      }
    }
  } catch (error) {
    console.error('Error loading API clients:', error)
  } finally {
    isLoadingApiClients.value = false
  }
}

function openCreateApiClientDialog() {
  newApiClientForm.value = { name: '', description: '' }
  showCreateApiClientDialog.value = true
}

async function createApiClient() {
  if (!newApiClientForm.value.name.trim()) {
    toast.add({ severity: 'error', summary: 'Validation Error', detail: 'Client name is required', life: 3000 })
    return
  }

  isCreatingApiClient.value = true
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/api-clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newApiClientForm.value.name.trim(),
        description: newApiClientForm.value.description.trim() || undefined
      })
    })

    if (response.ok) {
      const result = await response.json()
      newlyGeneratedApiKey.value = result.apiKey
      showCreateApiClientDialog.value = false
      showNewApiKeyDialog.value = true
      await loadApiClients()
      toast.add({ severity: 'success', summary: 'Success', detail: 'API client created successfully', life: 3000 })
    } else {
      const error = await response.json()
      toast.add({ severity: 'error', summary: 'Error', detail: error.error?.message || 'Failed to create API client', life: 3000 })
    }
  } catch (error) {
    console.error('Error creating API client:', error)
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to create API client', life: 3000 })
  } finally {
    isCreatingApiClient.value = false
  }
}

async function toggleApiClientStatus(client: MediationApiClient) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/api-clients/${client.id}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    if (response.ok) {
      await loadApiClients()
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: `API client ${client.isActive ? 'disabled' : 'enabled'}`,
        life: 3000
      })
    } else {
      toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to toggle API client status', life: 3000 })
    }
  } catch (error) {
    console.error('Error toggling API client:', error)
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to toggle API client status', life: 3000 })
  }
}

async function regenerateApiKey(client: MediationApiClient) {
  confirm.require({
    message: `Are you sure you want to regenerate the API key for "${client.name}"? The old key will stop working immediately.`,
    header: 'Confirm Regenerate',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Cancel',
    acceptLabel: 'Regenerate',
    acceptClass: 'p-button-warning',
    accept: async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/api-clients/${client.id}/regenerate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })

        if (response.ok) {
          const result = await response.json()
          newlyGeneratedApiKey.value = result.apiKey
          showNewApiKeyDialog.value = true
          await loadApiClients()
          toast.add({ severity: 'success', summary: 'Success', detail: 'API key regenerated', life: 3000 })
        } else {
          toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to regenerate API key', life: 3000 })
        }
      } catch (error) {
        console.error('Error regenerating API key:', error)
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to regenerate API key', life: 3000 })
      }
    }
  })
}

function deleteApiClient(client: MediationApiClient) {
  confirm.require({
    message: `Are you sure you want to delete "${client.name}"? This action cannot be undone.`,
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Cancel',
    acceptLabel: 'Delete',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/api-clients/${client.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        })

        if (response.ok || response.status === 204) {
          await loadApiClients()
          toast.add({ severity: 'success', summary: 'Success', detail: 'API client deleted', life: 3000 })
        } else {
          toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete API client', life: 3000 })
        }
      } catch (error) {
        console.error('Error deleting API client:', error)
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete API client', life: 3000 })
      }
    }
  })
}

function copyApiKeyToClipboard() {
  navigator.clipboard.writeText(newlyGeneratedApiKey.value)
  toast.add({ severity: 'info', summary: 'Copied', detail: 'API key copied to clipboard', life: 2000 })
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  return new Date(dateStr).toLocaleString()
}

// Load API key config on mount
onMounted(() => {
  loadApiKeyConfig()
  loadLLMEnabled()
  if (isSuperAdmin.value) {
    loadApiClients()
  }
})

// Helper functions
function getStatusSeverity(status: string): "success" | "danger" | "warn" | "secondary" | "info" | "contrast" | undefined {
  switch (status) {
    case 'Active': return 'success'
    case 'Inactive': return 'danger'
    case 'Pending': return 'warn'
    default: return 'secondary'
  }
}

function getRoleSeverity(role: string): "success" | "danger" | "warn" | "secondary" | "info" | "contrast" | undefined {
  switch (role) {
    case 'Super Admin': return 'contrast'
    case 'Admin': return 'info'
    case 'Viewer': return 'secondary'
    case 'FMP':
    case 'FMP Viewer': return 'success'
    case 'DMP':
    case 'DMP Viewer': return 'warn'
    case 'CMP':
    case 'CMP Viewer': return 'danger'
    default: return 'secondary'
  }
}

// Dialog actions
function openAddUserDialog() {
  const defaultRole = roleOptions.value[0]?.value || 'Viewer'
  newUser.value = { username: '', email: '', role: defaultRole as UserRole, password: '' }
  showAddUserDialog.value = true
}

function saveNewUser() {
  if (!newUser.value.username || !newUser.value.email || !newUser.value.role || !newUser.value.password) {
    toast.add({ severity: 'error', summary: 'Validation Error', detail: 'Please fill in all fields', life: 3000 })
    return
  }

  const newId = (Math.max(...allUsers.value.map(u => parseInt(u.id))) + 1).toString()
  allUsers.value.push({
    id: newId,
    username: newUser.value.username,
    email: newUser.value.email,
    role: newUser.value.role as UserRole,
    status: 'Pending',
    lastLogin: 'Never',
    createdAt: new Date().toISOString().split('T')[0]
  })

  showAddUserDialog.value = false
  toast.add({ severity: 'success', summary: 'Success', detail: 'User added successfully', life: 3000 })
}

function openEditUserDialog(user: ManagedUser) {
  selectedUser.value = user
  editUserForm.value = {
    username: user.username,
    email: user.email,
    role: user.role,
    status: user.status
  }
  showEditUserDialog.value = true
}

function saveEditUser() {
  if (!editUserForm.value.username || !editUserForm.value.email || !editUserForm.value.role) {
    toast.add({ severity: 'error', summary: 'Validation Error', detail: 'Please fill in all fields', life: 3000 })
    return
  }

  if (selectedUser.value) {
    const index = allUsers.value.findIndex(u => u.id === selectedUser.value!.id)
    if (index !== -1) {
      allUsers.value[index] = {
        ...allUsers.value[index],
        username: editUserForm.value.username,
        email: editUserForm.value.email,
        role: editUserForm.value.role as UserRole,
        status: editUserForm.value.status
      }
    }
  }

  showEditUserDialog.value = false
  selectedUser.value = null
  toast.add({ severity: 'success', summary: 'Success', detail: 'User updated successfully', life: 3000 })
}

function openResetPasswordDialog(user: ManagedUser) {
  selectedUser.value = user
  resetPasswordForm.value = { newPassword: '', confirmPassword: '' }
  showResetPasswordDialog.value = true
}

function resetPassword() {
  if (!resetPasswordForm.value.newPassword || !resetPasswordForm.value.confirmPassword) {
    toast.add({ severity: 'error', summary: 'Validation Error', detail: 'Please fill in all fields', life: 3000 })
    return
  }

  if (resetPasswordForm.value.newPassword !== resetPasswordForm.value.confirmPassword) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Passwords do not match', life: 3000 })
    return
  }

  // TODO: Implement actual password reset via API
  showResetPasswordDialog.value = false
  selectedUser.value = null
  toast.add({ severity: 'success', summary: 'Success', detail: 'Password reset successfully', life: 3000 })
}

function toggleUserStatus(user: ManagedUser) {
  const newStatus = user.status === 'Active' ? 'Inactive' : 'Active'
  confirm.require({
    message: `Are you sure you want to ${newStatus === 'Active' ? 'activate' : 'deactivate'} ${user.username}?`,
    header: 'Confirm Status Change',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Cancel',
    acceptLabel: 'Confirm',
    accept: () => {
      user.status = newStatus
      toast.add({ severity: 'success', summary: 'Success', detail: `User ${newStatus === 'Active' ? 'activated' : 'deactivated'}`, life: 3000 })
    }
  })
}

function deleteUser(user: ManagedUser) {
  confirm.require({
    message: `Are you sure you want to delete ${user.username}? This action cannot be undone.`,
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Cancel',
    acceptLabel: 'Delete',
    acceptClass: 'p-button-danger',
    accept: () => {
      allUsers.value = allUsers.value.filter(u => u.id !== user.id)
      toast.add({ severity: 'success', summary: 'Success', detail: 'User deleted successfully', life: 3000 })
    }
  })
}
</script>

<template>
  <div class="p-6 lg:p-8">
    <Toast />
    <ConfirmDialog />

    <!-- Page Header -->
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-white">{{ isViewer ? 'My Account' : 'User Management' }}</h1>
        <p class="text-text-secondary mt-1">{{ isViewer ? 'Manage your account settings' : 'Manage user accounts and permissions' }}</p>
      </div>
      <Button
        v-if="canManageUsers"
        label="Add User"
        icon="pi pi-user-plus"
        @click="openAddUserDialog"
        class="w-full lg:w-auto"
      />
    </div>

    <!-- Stats Cards (hidden for viewers) -->
    <div v-if="canManageUsers" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div class="bg-surface-dark border border-border-dark rounded-xl p-4">
        <div class="flex items-center gap-3">
          <div class="p-3 rounded-lg bg-primary/20">
            <span class="material-symbols-outlined text-primary">group</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ managedUsers.length }}</p>
            <p class="text-sm text-text-secondary">Total Users</p>
          </div>
        </div>
      </div>
      <div class="bg-surface-dark border border-border-dark rounded-xl p-4">
        <div class="flex items-center gap-3">
          <div class="p-3 rounded-lg bg-green-500/20">
            <span class="material-symbols-outlined text-green-400">check_circle</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ managedUsers.filter(u => u.status === 'Active').length }}</p>
            <p class="text-sm text-text-secondary">Active</p>
          </div>
        </div>
      </div>
      <div class="bg-surface-dark border border-border-dark rounded-xl p-4">
        <div class="flex items-center gap-3">
          <div class="p-3 rounded-lg bg-yellow-500/20">
            <span class="material-symbols-outlined text-yellow-400">schedule</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ managedUsers.filter(u => u.status === 'Pending').length }}</p>
            <p class="text-sm text-text-secondary">Pending</p>
          </div>
        </div>
      </div>
      <div class="bg-surface-dark border border-border-dark rounded-xl p-4">
        <div class="flex items-center gap-3">
          <div class="p-3 rounded-lg bg-red-500/20">
            <span class="material-symbols-outlined text-red-400">cancel</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ managedUsers.filter(u => u.status === 'Inactive').length }}</p>
            <p class="text-sm text-text-secondary">Inactive</p>
          </div>
        </div>
      </div>
    </div>

    <!-- LLM Configuration Section (Super Admin Only) -->
    <div v-if="isSuperAdmin" class="mb-6">
      <div class="bg-surface-dark border border-border-dark rounded-xl p-5">
        <!-- Header with Toggle -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div class="flex items-center gap-3">
            <div class="p-3 rounded-lg bg-purple-500/20">
              <span class="material-symbols-outlined text-purple-400">smart_toy</span>
            </div>
            <div>
              <h2 class="text-lg font-semibold text-white">Ask Bob (LLM Agent)</h2>
              <p class="text-sm text-text-secondary">AI assistant configuration and API key management</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-sm" :class="llmEnabled ? 'text-green-400' : 'text-text-secondary'">
              {{ llmEnabled ? 'Enabled' : 'Disabled' }}
            </span>
            <ToggleSwitch v-model="llmEnabled" @update:modelValue="toggleLLMEnabled" />
          </div>
        </div>

        <!-- Warning if enabled but no API key -->
        <div v-if="!apiKeyConfig && llmEnabled" class="mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
          <div class="flex items-start gap-2">
            <span class="material-symbols-outlined text-yellow-400 text-[18px] mt-0.5">warning</span>
            <p class="text-xs text-yellow-300">
              LLM is enabled but no API key is configured. Add an API key below for the AI assistant to work properly.
            </p>
          </div>
        </div>

        <!-- No API Key Configured -->
        <div v-if="!apiKeyConfig" class="bg-background-dark border border-border-dark rounded-lg p-4">
          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div class="flex-1">
              <p class="text-white font-medium">No API key configured</p>
              <p class="text-sm text-text-secondary mt-1">Add an API key to enable AI-powered features</p>
            </div>
            <Button
              label="Add API Key"
              icon="pi pi-plus"
              @click="openAddApiKeyDialog"
              class="w-full sm:w-auto"
            />
          </div>
        </div>

        <!-- API Key Configured -->
        <div v-else class="bg-background-dark border border-border-dark rounded-lg p-4">
          <div class="flex flex-col gap-4">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div class="flex items-center gap-3">
                <Tag :value="apiKeyConfig.provider" severity="info" class="text-xs" />
                <span class="text-white font-mono text-sm">{{ apiKeyConfig.maskedKey }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs text-text-secondary">
                  Added {{ new Date(apiKeyConfig.createdAt).toLocaleDateString() }}
                </span>
              </div>
            </div>
            <div class="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border-dark">
              <Button
                label="Replace Key"
                icon="pi pi-refresh"
                severity="secondary"
                size="small"
                @click="openAddApiKeyDialog"
                class="flex-1 sm:flex-none"
              />
              <Button
                label="Delete Key"
                icon="pi pi-trash"
                severity="danger"
                size="small"
                @click="deleteApiKey"
                class="flex-1 sm:flex-none"
              />
            </div>
          </div>
        </div>

        <p class="text-xs text-text-secondary mt-3">
          <span class="material-symbols-outlined text-[14px] align-middle mr-1">info</span>
          Your API key is hashed before being stored. The original key cannot be recovered.
        </p>
      </div>
    </div>

    <!-- Display Settings Section (Super Admin Only) -->
    <div v-if="isSuperAdmin" class="mb-6">
      <div class="bg-surface-dark border border-border-dark rounded-xl p-5">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="p-3 rounded-lg bg-green-500/20">
              <span class="material-symbols-outlined text-green-400">payments</span>
            </div>
            <div>
              <h2 class="text-lg font-semibold text-white">Display Settings</h2>
              <p class="text-sm text-text-secondary">Configure display preferences for all users</p>
            </div>
          </div>
        </div>

        <div class="mt-4 bg-background-dark border border-border-dark rounded-lg p-4">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p class="text-white font-medium">Currency</p>
              <p class="text-sm text-text-secondary mt-1">Select the currency for displaying costs and invoices</p>
            </div>
            <Select
              :modelValue="currency"
              @update:modelValue="handleCurrencyChange"
              :options="currencyOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Select currency"
              :disabled="isSavingCurrency"
              :loading="isSavingCurrency"
              class="w-full sm:w-56"
            />
          </div>
        </div>

        <p class="text-xs text-text-secondary mt-3">
          <span class="material-symbols-outlined text-[14px] align-middle mr-1">info</span>
          This setting affects how currency values are displayed across the Consumption Dashboard for all users.
        </p>
      </div>
    </div>

    <!-- API Clients Management Section (Super Admin Only) -->
    <div v-if="isSuperAdmin" class="mb-6">
      <div class="bg-surface-dark border border-border-dark rounded-xl p-5">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div class="flex items-center gap-3">
            <div class="p-3 rounded-lg bg-blue-500/20">
              <span class="material-symbols-outlined text-blue-400">api</span>
            </div>
            <div>
              <h2 class="text-lg font-semibold text-white">API Clients (Mediation)</h2>
              <p class="text-sm text-text-secondary">Manage API clients for external mediation systems</p>
            </div>
          </div>
          <Button
            label="Generate API Client"
            icon="pi pi-plus"
            @click="openCreateApiClientDialog"
            class="w-full sm:w-auto"
          />
        </div>

        <!-- No API Clients -->
        <div v-if="apiClients.length === 0 && !isLoadingApiClients" class="bg-background-dark border border-border-dark rounded-lg p-4">
          <div class="flex flex-col items-center gap-3 py-4">
            <span class="material-symbols-outlined text-4xl text-text-secondary">key_off</span>
            <p class="text-white font-medium">No API clients configured</p>
            <p class="text-sm text-text-secondary text-center">Create an API client to allow external systems to send usage data</p>
          </div>
        </div>

        <!-- Loading -->
        <div v-else-if="isLoadingApiClients" class="bg-background-dark border border-border-dark rounded-lg p-4">
          <div class="flex items-center justify-center gap-3 py-4">
            <i class="pi pi-spin pi-spinner text-primary"></i>
            <span class="text-text-secondary">Loading API clients...</span>
          </div>
        </div>

        <!-- API Clients Table -->
        <div v-else class="bg-background-dark border border-border-dark rounded-lg overflow-hidden">
          <DataTable
            :value="apiClients"
            dataKey="id"
            class="p-datatable-dark"
            :paginator="apiClients.length > 5"
            :rows="5"
          >
            <Column field="name" header="Name">
              <template #body="{ data }">
                <div>
                  <p class="font-medium text-white">{{ data.name }}</p>
                  <p v-if="data.description" class="text-xs text-text-secondary">{{ data.description }}</p>
                </div>
              </template>
            </Column>
            <Column field="apiKeyPrefix" header="Key Prefix">
              <template #body="{ data }">
                <span class="font-mono text-sm text-text-secondary">{{ data.apiKeyPrefix }}...</span>
              </template>
            </Column>
            <Column field="isActive" header="Status">
              <template #body="{ data }">
                <Tag :value="data.isActive ? 'Active' : 'Disabled'" :severity="data.isActive ? 'success' : 'danger'" class="text-xs" />
              </template>
            </Column>
            <Column field="lastUsedAt" header="Last Used">
              <template #body="{ data }">
                <span class="text-sm text-text-secondary">{{ formatDate(data.lastUsedAt) }}</span>
              </template>
            </Column>
            <Column header="Actions" :exportable="false">
              <template #body="{ data }">
                <div class="flex items-center gap-1">
                  <Button
                    :icon="data.isActive ? 'pi pi-pause' : 'pi pi-play'"
                    :severity="data.isActive ? 'warn' : 'success'"
                    text
                    rounded
                    size="small"
                    @click="toggleApiClientStatus(data)"
                    v-tooltip.top="data.isActive ? 'Disable' : 'Enable'"
                  />
                  <Button
                    icon="pi pi-refresh"
                    severity="info"
                    text
                    rounded
                    size="small"
                    @click="regenerateApiKey(data)"
                    v-tooltip.top="'Regenerate Key'"
                  />
                  <Button
                    icon="pi pi-trash"
                    severity="danger"
                    text
                    rounded
                    size="small"
                    @click="deleteApiClient(data)"
                    v-tooltip.top="'Delete'"
                  />
                </div>
              </template>
            </Column>
          </DataTable>
        </div>

        <p class="text-xs text-text-secondary mt-3">
          <span class="material-symbols-outlined text-[14px] align-middle mr-1">info</span>
          API clients can send usage data to <code class="bg-background-dark px-1 rounded">POST /api/v1/usage</code> and <code class="bg-background-dark px-1 rounded">POST /api/v1/usage/batch</code>
        </p>
      </div>
    </div>

    <!-- Users DataTable -->
    <div class="max-w-5xl">
      <div class="bg-surface-dark border border-border-dark rounded-xl overflow-hidden">
        <DataTable
          :value="managedUsers"
          :paginator="true"
          :rows="10"
          :rowsPerPageOptions="[5, 10, 20, 50]"
          v-model:filters="filters"
          filterDisplay="row"
          :globalFilterFields="['username', 'email', 'role', 'status']"
          dataKey="id"
          removableSort
          class="p-datatable-dark"
        >
          <template #header>
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-2 py-1">
              <span class="text-white font-semibold">Users</span>
              <div class="relative w-full sm:w-auto">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-[18px]">search</span>
                <InputText
                  v-model="filters['global'].value"
                  placeholder="Search users..."
                  class="pl-9 w-full sm:w-56 text-sm"
                />
              </div>
            </div>
          </template>

        <template #empty>
          <div class="text-center py-8 text-text-secondary">
            <span class="material-symbols-outlined text-4xl mb-2">person_search</span>
            <p>No users found.</p>
          </div>
        </template>

        <Column field="username" header="User" sortable>
          <template #body="{ data }">
            <div class="flex items-center gap-3">
              <div class="size-8 rounded-lg flex items-center justify-center text-white font-medium text-xs bg-primary/20 text-primary">
                {{ data.username.charAt(0).toUpperCase() }}
              </div>
              <div>
                <p class="font-medium text-white text-sm">{{ data.username }}</p>
                <p class="text-xs text-text-secondary">{{ data.email }}</p>
              </div>
            </div>
          </template>
        </Column>

        <Column field="role" header="Role" sortable>
          <template #body="{ data }">
            <Tag :value="data.role" :severity="getRoleSeverity(data.role)" class="text-xs" />
          </template>
        </Column>

        <Column field="status" header="Status" sortable>
          <template #body="{ data }">
            <Tag :value="data.status" :severity="getStatusSeverity(data.status)" class="text-xs" />
          </template>
        </Column>

        <Column field="lastLogin" header="Last Login" sortable>
          <template #body="{ data }">
            <span class="text-text-secondary text-sm">{{ data.lastLogin }}</span>
          </template>
        </Column>

        <Column field="createdAt" header="Created" sortable>
          <template #body="{ data }">
            <span class="text-text-secondary text-sm">{{ data.createdAt }}</span>
          </template>
        </Column>

        <Column header="Actions" :exportable="false">
          <template #body="{ data }">
            <div class="flex items-center gap-1">
              <!-- Edit button - only for admins -->
              <Button
                v-if="canManageUsers"
                icon="pi pi-pencil"
                severity="secondary"
                text
                rounded
                @click="openEditUserDialog(data)"
                v-tooltip.top="'Edit user'"
              />
              <!-- Password reset - always available (viewers can reset their own) -->
              <Button
                icon="pi pi-key"
                severity="info"
                text
                rounded
                @click="openResetPasswordDialog(data)"
                v-tooltip.top="'Reset password'"
              />
              <!-- Status toggle - only for admins -->
              <Button
                v-if="canManageUsers"
                :icon="data.status === 'Active' ? 'pi pi-user-minus' : 'pi pi-user-plus'"
                :severity="data.status === 'Active' ? 'warn' : 'success'"
                text
                rounded
                @click="toggleUserStatus(data)"
                v-tooltip.top="data.status === 'Active' ? 'Deactivate' : 'Activate'"
              />
              <!-- Delete button - only for admins and not for Super Admin users -->
              <Button
                v-if="canManageUsers && data.role !== 'Super Admin'"
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                @click="deleteUser(data)"
                v-tooltip.top="'Delete user'"
              />
            </div>
          </template>
        </Column>
        </DataTable>
      </div>
    </div>

    <!-- Add User Dialog -->
    <Dialog
      v-model:visible="showAddUserDialog"
      modal
      header="Add New User"
      :style="{ width: '28rem' }"
      :draggable="false"
    >
      <div class="flex flex-col gap-4 pt-4">
        <div class="flex flex-col gap-2">
          <label for="new-username" class="text-sm font-medium text-white">Username</label>
          <InputText
            id="new-username"
            v-model="newUser.username"
            placeholder="Enter username"
            class="w-full"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label for="new-email" class="text-sm font-medium text-white">Email</label>
          <InputText
            id="new-email"
            v-model="newUser.email"
            type="email"
            placeholder="Enter email"
            class="w-full"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label for="new-role" class="text-sm font-medium text-white">Role</label>
          <Select
            id="new-role"
            v-model="newUser.role"
            :options="roleOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select a role"
            class="w-full"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label for="new-password" class="text-sm font-medium text-white">Password</label>
          <Password
            id="new-password"
            v-model="newUser.password"
            placeholder="Enter password"
            toggleMask
            class="w-full"
            :inputClass="'w-full'"
          />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" @click="showAddUserDialog = false" />
        <Button label="Add User" @click="saveNewUser" />
      </template>
    </Dialog>

    <!-- Edit User Dialog -->
    <Dialog
      v-model:visible="showEditUserDialog"
      modal
      header="Edit User"
      :style="{ width: '28rem' }"
      :draggable="false"
    >
      <div class="flex flex-col gap-4 pt-4">
        <div class="flex flex-col gap-2">
          <label for="edit-username" class="text-sm font-medium text-white">Username</label>
          <InputText
            id="edit-username"
            v-model="editUserForm.username"
            placeholder="Enter username"
            class="w-full"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label for="edit-email" class="text-sm font-medium text-white">Email</label>
          <InputText
            id="edit-email"
            v-model="editUserForm.email"
            type="email"
            placeholder="Enter email"
            class="w-full"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label for="edit-role" class="text-sm font-medium text-white">Role</label>
          <Select
            id="edit-role"
            v-model="editUserForm.role"
            :options="roleOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select a role"
            class="w-full"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label for="edit-status" class="text-sm font-medium text-white">Status</label>
          <Select
            id="edit-status"
            v-model="editUserForm.status"
            :options="statusOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select status"
            class="w-full"
          />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" @click="showEditUserDialog = false" />
        <Button label="Save Changes" @click="saveEditUser" />
      </template>
    </Dialog>

    <!-- Reset Password Dialog -->
    <Dialog
      v-model:visible="showResetPasswordDialog"
      modal
      header="Reset Password"
      :style="{ width: '24rem' }"
      :draggable="false"
    >
      <div class="flex flex-col gap-4 pt-4">
        <p class="text-text-secondary text-sm">
          Reset password for <span class="text-white font-medium">{{ selectedUser?.username }}</span>
        </p>
        <div class="flex flex-col gap-2">
          <label for="reset-new-password" class="text-sm font-medium text-white">New Password</label>
          <Password
            id="reset-new-password"
            v-model="resetPasswordForm.newPassword"
            placeholder="Enter new password"
            toggleMask
            class="w-full"
            :inputClass="'w-full'"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label for="reset-confirm-password" class="text-sm font-medium text-white">Confirm Password</label>
          <Password
            id="reset-confirm-password"
            v-model="resetPasswordForm.confirmPassword"
            placeholder="Confirm new password"
            toggleMask
            :feedback="false"
            class="w-full"
            :inputClass="'w-full'"
          />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" @click="showResetPasswordDialog = false" />
        <Button label="Reset Password" severity="info" @click="resetPassword" />
      </template>
    </Dialog>

    <!-- Add/Replace API Key Dialog -->
    <Dialog
      v-model:visible="showAddApiKeyDialog"
      modal
      :header="apiKeyConfig ? 'Replace API Key' : 'Add API Key'"
      :style="{ width: '28rem' }"
      :draggable="false"
    >
      <div class="flex flex-col gap-4 pt-4">
        <p class="text-text-secondary text-sm">
          {{ apiKeyConfig ? 'Enter a new API key to replace the existing one.' : 'Enter your LLM provider API key.' }}
          The key will be hashed before storage.
        </p>
        <div class="flex flex-col gap-2">
          <label for="api-provider" class="text-sm font-medium text-white">Provider</label>
          <Select
            id="api-provider"
            v-model="apiKeyForm.provider"
            :options="llmProviderOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select provider"
            class="w-full"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label for="api-key" class="text-sm font-medium text-white">API Key</label>
          <Password
            id="api-key"
            v-model="apiKeyForm.apiKey"
            placeholder="Enter your API key"
            toggleMask
            :feedback="false"
            class="w-full"
            :inputClass="'w-full font-mono text-sm'"
          />
        </div>
        <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
          <div class="flex items-start gap-2">
            <span class="material-symbols-outlined text-yellow-400 text-[18px] mt-0.5">warning</span>
            <p class="text-xs text-yellow-300">
              Your API key will be hashed using SHA-256 before being stored.
              You will not be able to view or recover the original key after saving.
            </p>
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" @click="showAddApiKeyDialog = false" :disabled="isSavingApiKey" />
        <Button
          :label="apiKeyConfig ? 'Replace Key' : 'Save Key'"
          icon="pi pi-check"
          @click="saveApiKey"
          :loading="isSavingApiKey"
        />
      </template>
    </Dialog>

    <!-- Create API Client Dialog -->
    <Dialog
      v-model:visible="showCreateApiClientDialog"
      modal
      header="Create API Client"
      :style="{ width: '28rem' }"
      :draggable="false"
    >
      <div class="flex flex-col gap-4 pt-4">
        <p class="text-text-secondary text-sm">
          Create a new API client for external mediation systems to send usage data.
        </p>
        <div class="flex flex-col gap-2">
          <label for="client-name" class="text-sm font-medium text-white">Client Name *</label>
          <InputText
            id="client-name"
            v-model="newApiClientForm.name"
            placeholder="e.g., MQTT Mediation Simulator"
            class="w-full"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label for="client-description" class="text-sm font-medium text-white">Description</label>
          <InputText
            id="client-description"
            v-model="newApiClientForm.description"
            placeholder="e.g., 3rd party mediation system"
            class="w-full"
          />
        </div>
        <div class="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
          <div class="flex items-start gap-2">
            <span class="material-symbols-outlined text-blue-400 text-[18px] mt-0.5">info</span>
            <p class="text-xs text-blue-300">
              An API key will be generated automatically. Make sure to copy it - it will only be shown once!
            </p>
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" @click="showCreateApiClientDialog = false" :disabled="isCreatingApiClient" />
        <Button
          label="Generate Client"
          icon="pi pi-key"
          @click="createApiClient"
          :loading="isCreatingApiClient"
        />
      </template>
    </Dialog>

    <!-- New API Key Display Dialog -->
    <Dialog
      v-model:visible="showNewApiKeyDialog"
      modal
      header="Your New API Key"
      :style="{ width: '32rem' }"
      :draggable="false"
      :closable="false"
    >
      <div class="flex flex-col gap-4 pt-4">
        <div class="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
          <div class="flex items-start gap-2">
            <span class="material-symbols-outlined text-green-400 text-[18px] mt-0.5">check_circle</span>
            <p class="text-sm text-green-300">API client created successfully!</p>
          </div>
        </div>

        <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
          <div class="flex items-start gap-2">
            <span class="material-symbols-outlined text-yellow-400 text-[18px] mt-0.5">warning</span>
            <p class="text-xs text-yellow-300">
              <strong>Copy this key now!</strong> It will not be shown again. Store it securely.
            </p>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-white">API Key</label>
          <div class="flex gap-2">
            <InputText
              :modelValue="newlyGeneratedApiKey"
              readonly
              class="w-full font-mono text-sm"
            />
            <Button
              icon="pi pi-copy"
              severity="secondary"
              @click="copyApiKeyToClipboard"
              v-tooltip.top="'Copy to clipboard'"
            />
          </div>
        </div>

        <div class="bg-background-dark border border-border-dark rounded-lg p-3">
          <p class="text-xs text-text-secondary mb-2">Usage in mqtt-control-panel:</p>
          <code class="text-xs text-blue-300">Connection Settings → API Key</code>
        </div>
      </div>
      <template #footer>
        <Button
          label="I've Copied the Key"
          icon="pi pi-check"
          @click="showNewApiKeyDialog = false"
        />
      </template>
    </Dialog>
  </div>
</template>

<style>
/* Dark theme styles for PrimeVue DataTable - matching DeviceList style */
.p-datatable-dark {
  --p-datatable-header-background: transparent;
  --p-datatable-header-border-color: var(--border-dark);
  --p-datatable-row-background: transparent;
  --p-datatable-row-hover-background: var(--surface-dark-highlight);
  --p-datatable-body-cell-border-color: var(--border-dark);
}

.p-datatable-dark .p-datatable-thead > tr > th {
  background: var(--background-dark);
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--border-dark);
  padding: 0.75rem 1rem;
}

.p-datatable-dark .p-datatable-tbody > tr {
  background: transparent;
  color: var(--text-secondary);
}

.p-datatable-dark .p-datatable-tbody > tr:hover {
  background: var(--surface-dark-highlight);
}

.p-datatable-dark .p-datatable-tbody > tr > td {
  border-bottom: 1px solid var(--border-dark);
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
}

.p-datatable-dark .p-paginator {
  background: transparent;
  border-top: 1px solid var(--border-dark);
  padding: 0.75rem 1rem;
  color: var(--text-secondary);
  font-size: 0.75rem;
}

/* Dialog dark theme */
.p-dialog {
  background: var(--surface-dark);
  border: 1px solid var(--border-dark);
}

.p-dialog .p-dialog-header {
  background: var(--surface-dark);
  border-bottom: 1px solid var(--border-dark);
  color: white;
}

.p-dialog .p-dialog-content {
  background: var(--surface-dark);
  color: white;
}

.p-dialog .p-dialog-footer {
  background: var(--surface-dark);
  border-top: 1px solid var(--border-dark);
}

/* InputText dark theme */
.p-inputtext {
  background: var(--background-dark);
  border-color: var(--border-dark);
  color: white;
}

.p-inputtext:enabled:hover {
  border-color: var(--primary);
}

.p-inputtext:enabled:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.p-inputtext::placeholder {
  color: var(--text-secondary);
}

/* Select dark theme */
.p-select {
  background: var(--background-dark);
  border-color: var(--border-dark);
  color: white;
}

.p-select:not(.p-disabled):hover {
  border-color: var(--primary);
}

.p-select:not(.p-disabled).p-focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.p-select-panel {
  background: var(--surface-dark);
  border: 1px solid var(--border-dark);
}

.p-select-option {
  color: white;
}

.p-select-option:hover {
  background: rgba(59, 130, 246, 0.1);
}

/* Password dark theme */
.p-password-input {
  background: var(--background-dark);
  border-color: var(--border-dark);
  color: white;
}

</style>
