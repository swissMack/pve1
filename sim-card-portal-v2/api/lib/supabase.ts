import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// ============================================================================
// Supabase Client Configuration (Lazy Initialization)
// ============================================================================

// Lazily initialized clients to ensure environment variables are loaded first
let _supabase: SupabaseClient<Database> | null = null
let _supabaseAnon: SupabaseClient<Database> | null = null
let _initialized = false

/**
 * Check if Supabase is configured (checks at call time)
 */
export function isSupabaseConfigured(): boolean {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  return Boolean(supabaseUrl && supabaseServiceRoleKey)
}

/**
 * Initialize Supabase clients (called lazily on first access)
 */
function initializeClients(): void {
  if (_initialized) return
  _initialized = true

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseServiceRoleKey) {
    _supabase = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  }

  if (supabaseUrl && supabaseAnonKey) {
    _supabaseAnon = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true
      }
    })
  }

  if (!_supabase && process.env.NODE_ENV !== 'development') {
    console.warn('Missing Supabase environment variables. Some features may not work.')
  }
}

// ============================================================================
// Typed Supabase Client (Lazy Getters)
// ============================================================================

/**
 * Service role client - bypasses RLS, use for backend operations
 * This client has full access to all tables
 */
export const supabase: SupabaseClient<Database> = new Proxy({} as SupabaseClient<Database>, {
  get(target, prop) {
    initializeClients()
    if (!_supabase) return undefined
    return (_supabase as any)[prop]
  }
})

/**
 * Anon client - respects RLS, use for client-side operations
 * This client has limited access based on RLS policies
 */
export const supabaseAnon: SupabaseClient<Database> | null = new Proxy({} as SupabaseClient<Database>, {
  get(target, prop) {
    initializeClients()
    if (!_supabaseAnon) return undefined
    return (_supabaseAnon as any)[prop]
  }
})

// ============================================================================
// Database Types (Core Tables)
// ============================================================================

export interface DatabaseDevice {
  id: string
  name: string
  status: 'active' | 'inactive' | 'maintenance' | 'offline'
  sim_card_id: string | null
  device_type_id: string | null
  location_id: string | null
  last_seen: string | null
  signal_strength: number | null
  data_usage_mb: number | null
  connection_type: '3g' | '4g' | '5g' | 'wifi' | null
  firmware_version: string | null
  hardware_version: string | null
  serial_number: string | null
  manufacturer: string | null
  model: string | null
  notes: string | null
  description: string | null
  is_active: boolean | null
  test1: 'value1' | 'value2' | null
  latitude: number | null
  longitude: number | null
  temperature: number | null
  humidity: number | null
  light: number | null
  sensor_sampling_interval: number | null
  health_status: 'healthy' | 'warning' | 'critical' | 'unknown' | null
  battery_level: number | null
  security_status: 'secure' | 'vulnerable' | 'compromised' | 'unknown' | null
  asset_management_url: string | null
  supplier_device_url: string | null
  user_manual_url: string | null
  specification_base64: string | null
  created_at: string
  updated_at: string
}

export interface DatabaseSIMCard {
  id: string
  iccid: string
  msisdn: string | null
  status: 'Active' | 'Inactive' | 'Suspended' | 'Terminated'
  carrier: string | null
  plan: string | null
  data_used: string | null
  data_limit: string | null
  data_used_bytes: number | null
  data_limit_bytes: number | null
  activation_date: string | null
  expiry_date: string | null
  created_at: string
  updated_at: string
}

export interface DatabaseDeviceType {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface DatabaseLocation {
  id: string
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  created_at: string
  updated_at: string
}

export interface DatabaseDeviceLocationHistory {
  id: string
  device_id: string
  latitude: number
  longitude: number
  altitude: number | null
  accuracy: number | null
  speed: number | null
  heading: number | null
  recorded_at: string
  location_source: string | null
  battery_level: number | null
  signal_strength: number | null
  notes: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface DatabaseDeviceSensorHistory {
  id: string
  device_id: string
  temperature: number | null
  humidity: number | null
  light: number | null
  recorded_at: string
  battery_level: number | null
  signal_strength: number | null
  notes: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

// ============================================================================
// Database Types (Provisioning API Tables)
// ============================================================================

export interface DatabaseProvisionedSim {
  sim_id: string
  iccid: string
  imsi: string
  msisdn: string
  imei: string | null
  puk1: string | null
  puk2: string | null
  pin1: string | null
  pin2: string | null
  ki: string | null
  opc: string | null
  apn: string
  rate_plan_id: string
  data_limit_bytes: number | null
  billing_account_id: string
  customer_id: string
  status: 'PROVISIONED' | 'ACTIVE' | 'INACTIVE' | 'BLOCKED'
  previous_status: string | null
  block_reason: string | null
  block_notes: string | null
  blocked_at: string | null
  blocked_by: 'SYSTEM' | 'USER' | 'API' | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  activated_at: string | null
  deactivated_at: string | null
}

export interface DatabaseApiClient {
  id: string
  name: string
  description: string | null
  api_key_hash: string
  api_key_prefix: string
  permissions: string[]
  rate_limit_override: Record<string, unknown> | null
  is_active: boolean
  created_at: string
  updated_at: string
  last_used_at: string | null
}

export interface DatabaseWebhook {
  id: string
  url: string
  events: string[]
  secret_hash: string
  status: 'ACTIVE' | 'PAUSED' | 'FAILED'
  failure_count: number
  client_id: string | null
  created_at: string
  updated_at: string
  last_delivery_at: string | null
  last_success_at: string | null
  last_failure_at: string | null
}

export interface DatabaseUsageRecord {
  id: number
  record_id: string
  iccid: string
  sim_id: string | null
  period_start: string
  period_end: string
  data_upload_bytes: number
  data_download_bytes: number
  total_bytes: number
  sms_count: number
  voice_seconds: number
  source: string | null
  batch_id: string | null
  status: 'PROCESSED' | 'DUPLICATE' | 'FAILED'
  processed_at: string
}

export interface DatabaseUsageCycle {
  id: number
  sim_id: string
  iccid: string
  cycle_id: string
  cycle_start: string
  cycle_end: string
  total_upload_bytes: number
  total_download_bytes: number
  total_bytes: number
  sms_count: number
  voice_seconds: number
  is_current: boolean
  archived_at: string | null
  final_usage: Record<string, unknown> | null
  created_at: string
  last_updated: string
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert snake_case database row to camelCase object
 */
export function toCamelCase<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  if (Array.isArray(obj)) {
    return obj.map(v => toCamelCase(v as Record<string, unknown>)) as unknown as Record<string, unknown>
  } else if (obj instanceof Date) {
    return obj.toISOString() as unknown as Record<string, unknown>
  } else if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((result, key) => {
      const camelKey = key.replace(/_([a-z])/g, g => g[1].toUpperCase())
      const value = obj[key]
      result[camelKey] = value !== null && typeof value === 'object'
        ? toCamelCase(value as Record<string, unknown>)
        : value
      return result
    }, {} as Record<string, unknown>)
  }
  return obj
}

/**
 * Convert camelCase object to snake_case for database
 */
export function toSnakeCase<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  if (Array.isArray(obj)) {
    return obj.map(v => toSnakeCase(v as Record<string, unknown>)) as unknown as Record<string, unknown>
  } else if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((result, key) => {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
      const value = obj[key]
      result[snakeKey] = value !== null && typeof value === 'object'
        ? toSnakeCase(value as Record<string, unknown>)
        : value
      return result
    }, {} as Record<string, unknown>)
  }
  return obj
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, i)

  return `${value.toFixed(2)} ${units[i]}`
}

/**
 * Parse data string (e.g., "2.4 MB") to bytes
 */
export function parseDataToBytes(dataStr: string | null): number {
  if (!dataStr || dataStr.trim() === '') return 0

  const match = dataStr.match(/^([\d.]+)\s*(\w+)?$/i)
  if (!match) return 0

  const value = parseFloat(match[1])
  const unit = (match[2] || 'MB').toUpperCase()

  const multipliers: Record<string, number> = {
    'B': 1,
    'KB': 1024,
    'K': 1024,
    'MB': 1024 * 1024,
    'M': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'G': 1024 * 1024 * 1024,
    'TB': 1024 * 1024 * 1024 * 1024,
    'T': 1024 * 1024 * 1024 * 1024,
  }

  return Math.round(value * (multipliers[unit] || multipliers['MB']))
}

/**
 * Ensure numeric value from potential string (for BIGINT columns)
 */
export function ensureNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value) || 0
  return 0
}

// ============================================================================
// Database Query Helpers
// ============================================================================

export interface QueryResult<T> {
  data: T | null
  error: Error | null
  count?: number
}

/**
 * Get a single device by ID
 */
export async function getDeviceById(id: string): Promise<QueryResult<DatabaseDevice>> {
  if (!supabase) {
    return { data: null, error: new Error('Supabase not configured') }
  }

  const { data, error } = await supabase
    .from('devices')
    .select('*')
    .eq('id', id)
    .single()

  return { data: data as DatabaseDevice | null, error }
}

/**
 * Get all devices with optional filters
 */
export async function getDevices(options?: {
  status?: 'active' | 'inactive' | 'maintenance' | 'offline'
  deviceTypeId?: string
  locationId?: string
  limit?: number
  offset?: number
}): Promise<QueryResult<DatabaseDevice[]>> {
  if (!supabase) {
    return { data: null, error: new Error('Supabase not configured') }
  }

  let query = supabase.from('devices').select('*', { count: 'exact' })

  if (options?.status) {
    query = query.eq('status', options.status)
  }
  if (options?.deviceTypeId) {
    query = query.eq('device_type_id', options.deviceTypeId)
  }
  if (options?.locationId) {
    query = query.eq('location_id', options.locationId)
  }
  if (options?.limit) {
    query = query.limit(options.limit)
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
  }

  const { data, error, count } = await query.order('name')

  return { data: data as DatabaseDevice[] | null, error, count: count ?? undefined }
}

/**
 * Get a single SIM card by ID
 */
export async function getSimCardById(id: string): Promise<QueryResult<DatabaseSIMCard>> {
  if (!supabase) {
    return { data: null, error: new Error('Supabase not configured') }
  }

  const { data, error } = await supabase
    .from('sim_cards')
    .select('*')
    .eq('id', id)
    .single()

  return { data: data as DatabaseSIMCard | null, error }
}

/**
 * Get all SIM cards with optional filters
 */
export async function getSimCards(options?: {
  status?: 'Active' | 'Inactive' | 'Suspended' | 'Terminated'
  carrier?: string
  limit?: number
  offset?: number
}): Promise<QueryResult<DatabaseSIMCard[]>> {
  if (!supabase) {
    return { data: null, error: new Error('Supabase not configured') }
  }

  let query = supabase.from('sim_cards').select('*', { count: 'exact' })

  if (options?.status) {
    query = query.eq('status', options.status)
  }
  if (options?.carrier) {
    query = query.eq('carrier', options.carrier)
  }
  if (options?.limit) {
    query = query.limit(options.limit)
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
  }

  const { data, error, count } = await query.order('id')

  return { data: data as DatabaseSIMCard[] | null, error, count: count ?? undefined }
}

/**
 * Get device location history
 */
export async function getDeviceLocationHistory(
  deviceId: string,
  options?: {
    startDate?: string
    endDate?: string
    limit?: number
  }
): Promise<QueryResult<DatabaseDeviceLocationHistory[]>> {
  if (!supabase) {
    return { data: null, error: new Error('Supabase not configured') }
  }

  let query = supabase
    .from('device_location_history')
    .select('*')
    .eq('device_id', deviceId)

  if (options?.startDate) {
    query = query.gte('recorded_at', options.startDate)
  }
  if (options?.endDate) {
    query = query.lte('recorded_at', options.endDate)
  }

  query = query.order('recorded_at', { ascending: true })

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  return { data: data as DatabaseDeviceLocationHistory[] | null, error }
}

/**
 * Get device sensor history
 */
export async function getDeviceSensorHistory(
  deviceId: string,
  options?: {
    startDate?: string
    endDate?: string
    limit?: number
  }
): Promise<QueryResult<DatabaseDeviceSensorHistory[]>> {
  if (!supabase) {
    return { data: null, error: new Error('Supabase not configured') }
  }

  let query = supabase
    .from('device_sensor_history')
    .select('*')
    .eq('device_id', deviceId)

  if (options?.startDate) {
    query = query.gte('recorded_at', options.startDate)
  }
  if (options?.endDate) {
    query = query.lte('recorded_at', options.endDate)
  }

  query = query.order('recorded_at', { ascending: true })

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  return { data: data as DatabaseDeviceSensorHistory[] | null, error }
}

/**
 * Get provisioned SIM by ICCID
 */
export async function getProvisionedSimByIccid(iccid: string): Promise<QueryResult<DatabaseProvisionedSim>> {
  if (!supabase) {
    return { data: null, error: new Error('Supabase not configured') }
  }

  const { data, error } = await supabase
    .from('provisioned_sims')
    .select('*')
    .eq('iccid', iccid)
    .single()

  return { data: data as DatabaseProvisionedSim | null, error }
}

/**
 * Get current usage cycle for a SIM
 */
export async function getCurrentUsageCycle(simId: string): Promise<QueryResult<DatabaseUsageCycle>> {
  if (!supabase) {
    return { data: null, error: new Error('Supabase not configured') }
  }

  const { data, error } = await supabase
    .from('usage_cycles')
    .select('*')
    .eq('sim_id', simId)
    .eq('is_current', true)
    .single()

  return { data: data as DatabaseUsageCycle | null, error }
}

// ============================================================================
// Legacy Type Exports (for backwards compatibility)
// ============================================================================

export interface DatabaseUser {
  id: string
  username: string
  password_hash: string
  role: string
  created_at?: string
  updated_at?: string
}

export interface DatabaseUserSession {
  id?: number
  user_id: string
  token: string
  expires_at: string
  created_at?: string
  updated_at?: string
}
