import { ref, computed, watch } from 'vue'

// Supported currencies (EUR is now the base currency)
export const SUPPORTED_CURRENCIES = [
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' }
] as const

export type CurrencyCode = typeof SUPPORTED_CURRENCIES[number]['code']

const STORAGE_KEY = 'sim-portal-app-settings'

interface AppSettings {
  currency: CurrencyCode
}

const defaultSettings: AppSettings = {
  currency: 'EUR' // Changed to EUR as base currency
}

// Reactive settings state (shared across all components)
const settings = ref<AppSettings>(loadSettings())
const isLoading = ref(false)
const isSynced = ref(false)

function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return { ...defaultSettings, ...parsed }
    }
  } catch (e) {
    console.error('Failed to load app settings:', e)
  }
  return { ...defaultSettings }
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))
  } catch (e) {
    console.error('Failed to save app settings:', e)
  }
}

// Watch for changes and persist to localStorage
watch(settings, saveSettings, { deep: true })

/**
 * Fetch currency setting from backend API
 */
async function fetchCurrencyFromBackend(): Promise<CurrencyCode | null> {
  try {
    const response = await fetch('/api/settings/currency')
    const result = await response.json()
    if (result.success && result.currency) {
      return result.currency as CurrencyCode
    }
  } catch (e) {
    console.error('Failed to fetch currency from backend:', e)
  }
  return null
}

/**
 * Save currency setting to backend API
 */
async function saveCurrencyToBackend(currency: CurrencyCode): Promise<boolean> {
  try {
    const response = await fetch('/api/settings/currency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currency })
    })
    const result = await response.json()
    return result.success === true
  } catch (e) {
    console.error('Failed to save currency to backend:', e)
    return false
  }
}

/**
 * Initialize settings from backend (call once on app startup)
 */
async function initFromBackend(): Promise<void> {
  if (isSynced.value) return

  isLoading.value = true
  try {
    const backendCurrency = await fetchCurrencyFromBackend()
    if (backendCurrency) {
      settings.value.currency = backendCurrency
      isSynced.value = true
    }
  } finally {
    isLoading.value = false
  }
}

// Auto-initialize on first import
initFromBackend()

export function useAppSettings() {
  const currency = computed({
    get: () => settings.value.currency,
    set: (value: CurrencyCode) => {
      settings.value.currency = value
    }
  })

  const currencyInfo = computed(() => {
    return SUPPORTED_CURRENCIES.find(c => c.code === settings.value.currency) || SUPPORTED_CURRENCIES[0]
  })

  const formatCurrency = (value: number, currencyOverride?: CurrencyCode, decimals: number = 2) => {
    const code = currencyOverride || settings.value.currency
    return new Intl.NumberFormat('en-CH', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value)
  }

  /**
   * Set currency and sync to backend
   * @param code Currency code
   * @param syncToBackend Whether to save to backend (default: true)
   * @returns Promise<boolean> Success status
   */
  const setCurrency = async (code: CurrencyCode, syncToBackend: boolean = true): Promise<boolean> => {
    const previousCurrency = settings.value.currency
    settings.value.currency = code

    if (syncToBackend) {
      const success = await saveCurrencyToBackend(code)
      if (!success) {
        // Revert on failure
        settings.value.currency = previousCurrency
        return false
      }
    }
    return true
  }

  /**
   * Refresh currency from backend
   */
  const refreshFromBackend = async (): Promise<void> => {
    await initFromBackend()
  }

  return {
    currency,
    currencyInfo,
    formatCurrency,
    setCurrency,
    refreshFromBackend,
    isLoading: computed(() => isLoading.value),
    SUPPORTED_CURRENCIES
  }
}
