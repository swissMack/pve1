/**
 * MCCMNC Service
 * Client for MCCMNC-to-carrier-name lookup with localStorage caching
 * @see specs/003-consumption-filters-llm/research.md
 */

import type { NetworkMapping } from '@/types/analytics'

// ============================================================================
// Configuration
// ============================================================================

const API_BASE_URL = '/api/mccmnc'
const CACHE_KEY = 'mccmnc-cache'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

// ============================================================================
// Cache Types
// ============================================================================

interface CacheEntry {
  data: Record<string, NetworkMapping>
  timestamp: number
}

// ============================================================================
// Fallback Carriers
// ============================================================================

// Common carriers for immediate display while API lookup is pending
const FALLBACK_CARRIERS: Record<string, NetworkMapping> = {
  '22288': { mccmnc: '22288', carrierName: 'TIM Italy', countryCode: 'IT', networkType: 'GSM' },
  '22210': { mccmnc: '22210', carrierName: 'Vodafone Italy', countryCode: 'IT', networkType: 'GSM' },
  '22201': { mccmnc: '22201', carrierName: 'TIM Italy', countryCode: 'IT', networkType: 'GSM' },
  '22299': { mccmnc: '22299', carrierName: 'Tre Italy', countryCode: 'IT', networkType: 'GSM' },
  '26201': { mccmnc: '26201', carrierName: 'T-Mobile Germany', countryCode: 'DE', networkType: 'GSM' },
  '26202': { mccmnc: '26202', carrierName: 'Vodafone Germany', countryCode: 'DE', networkType: 'GSM' },
  '26203': { mccmnc: '26203', carrierName: 'O2 Germany', countryCode: 'DE', networkType: 'GSM' },
  '23410': { mccmnc: '23410', carrierName: 'O2 UK', countryCode: 'GB', networkType: 'GSM' },
  '23415': { mccmnc: '23415', carrierName: 'Vodafone UK', countryCode: 'GB', networkType: 'GSM' },
  '23420': { mccmnc: '23420', carrierName: 'Three UK', countryCode: 'GB', networkType: 'GSM' },
  '23430': { mccmnc: '23430', carrierName: 'EE UK', countryCode: 'GB', networkType: 'GSM' },
  '20801': { mccmnc: '20801', carrierName: 'Orange France', countryCode: 'FR', networkType: 'GSM' },
  '20810': { mccmnc: '20810', carrierName: 'SFR France', countryCode: 'FR', networkType: 'GSM' },
  '20820': { mccmnc: '20820', carrierName: 'Bouygues France', countryCode: 'FR', networkType: 'GSM' },
  '31026': { mccmnc: '31026', carrierName: 'T-Mobile US', countryCode: 'US', networkType: 'GSM' },
  '310260': { mccmnc: '310260', carrierName: 'T-Mobile US', countryCode: 'US', networkType: 'LTE' },
  '311480': { mccmnc: '311480', carrierName: 'Verizon US', countryCode: 'US', networkType: 'LTE' },
  '310410': { mccmnc: '310410', carrierName: 'AT&T US', countryCode: 'US', networkType: 'GSM' }
}

// ============================================================================
// Cache Utilities
// ============================================================================

/**
 * Load cache from localStorage
 */
function loadCache(): Record<string, NetworkMapping> {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      const entry: CacheEntry = JSON.parse(cached)
      // Check if cache is still valid
      if (entry.timestamp + CACHE_TTL_MS > Date.now()) {
        return entry.data
      }
    }
  } catch (error) {
    console.warn('Failed to load MCCMNC cache:', error)
  }
  return {}
}

/**
 * Save cache to localStorage
 */
function saveCache(data: Record<string, NetworkMapping>): void {
  try {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now()
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch (error) {
    console.warn('Failed to save MCCMNC cache:', error)
  }
}

/**
 * Clear MCCMNC cache
 */
export function clearMccmncCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch (error) {
    console.warn('Failed to clear MCCMNC cache:', error)
  }
}

// ============================================================================
// In-memory cache (initialized from localStorage)
// ============================================================================

let memoryCache: Record<string, NetworkMapping> = { ...FALLBACK_CARRIERS, ...loadCache() }

// ============================================================================
// API Methods
// ============================================================================

/**
 * Lookup carrier name for a single MCCMNC code
 */
export function getCarrierName(mccmnc: string): string {
  const mapping = memoryCache[mccmnc]
  if (mapping) {
    return mapping.carrierName
  }
  return `Network ${mccmnc}`
}

/**
 * Get full network mapping for a single MCCMNC code
 */
export function getNetworkMapping(mccmnc: string): NetworkMapping | null {
  return memoryCache[mccmnc] || null
}

/**
 * Format MCCMNC with carrier name for display
 * Returns: "TIM Italy (22288)" or just "22288" if not found
 */
export function formatMccmncLabel(mccmnc: string): string {
  const mapping = memoryCache[mccmnc]
  if (mapping) {
    return `${mapping.carrierName} (${mccmnc})`
  }
  return mccmnc
}

/**
 * Lookup multiple MCCMNC codes and update cache
 * Returns mappings for all requested codes
 */
export async function lookupMccmnc(codes: string[]): Promise<NetworkMapping[]> {
  // Filter codes not in cache
  const uncachedCodes = codes.filter(code => !memoryCache[code])

  // If all codes are cached, return from cache
  if (uncachedCodes.length === 0) {
    return codes.map(code => memoryCache[code] || {
      mccmnc: code,
      carrierName: `Network ${code}`,
      countryCode: code.substring(0, 3)
    })
  }

  try {
    // Fetch uncached codes from API
    const queryParams = uncachedCodes.map(c => `codes=${c}`).join('&')
    const response = await fetch(`${API_BASE_URL}/lookup?${queryParams}`)

    if (response.ok) {
      const result = await response.json()

      if (result.success && result.data) {
        // Update memory cache with new mappings
        for (const mapping of result.data) {
          memoryCache[mapping.mccmnc] = mapping
        }

        // Persist to localStorage
        saveCache(memoryCache)
      }
    }
  } catch (error) {
    console.warn('Failed to lookup MCCMNC codes:', error)
  }

  // Return all requested codes from cache (or generic fallback)
  return codes.map(code => memoryCache[code] || {
    mccmnc: code,
    carrierName: `Network ${code}`,
    countryCode: code.substring(0, 3)
  })
}

/**
 * Preload carrier mappings for a list of MCCMNC codes
 * Call this when consumption data is loaded to populate cache
 */
export async function preloadCarrierMappings(codes: string[]): Promise<void> {
  const uniqueCodes = [...new Set(codes)]
  await lookupMccmnc(uniqueCodes)
}

/**
 * Get all cached network mappings
 */
export function getAllCachedMappings(): NetworkMapping[] {
  return Object.values(memoryCache)
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  getCarrierName,
  getNetworkMapping,
  formatMccmncLabel,
  lookupMccmnc,
  preloadCarrierMappings,
  clearMccmncCache,
  getAllCachedMappings
}
