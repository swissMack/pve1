/**
 * Local API server for development
 * Connects to the local PostgreSQL database (Docker)
 *
 * Run: node scripts/local-api-server.js
 * API will be available at http://localhost:3001
 */

import dotenv from 'dotenv'
import { fileURLToPath as urlToPath } from 'url'
import { dirname as dirnamePath, join as joinPath } from 'path'

// Load .env first, then .env.local to override
const __dir = dirnamePath(urlToPath(import.meta.url))
dotenv.config({ path: joinPath(__dir, '..', '.env') })
dotenv.config({ path: joinPath(__dir, '..', '.env.local'), override: true })

import express from 'express'
import cors from 'cors'
import pg from 'pg'
import Anthropic from '@anthropic-ai/sdk'
import { randomUUID } from 'crypto'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Import Provisioning API v1 router
import { createV1Router } from '../dist/api/api/v1/index.js'

// Import Supabase client for when Supabase is configured
import { supabase, isSupabaseConfigured } from '../dist/api/api/lib/supabase.js'
import { getSchemaName } from '../dist/api/api/lib/db.js'

// Import Exchange Rate Service for currency conversion
import {
  initExchangeRateService,
  getDisplayCurrency,
  setDisplayCurrency,
  getExchangeRate,
  convertFromEUR,
  fetchECBRates,
  getAllRates,
  SUPPORTED_CURRENCIES
} from '../dist/api/api/lib/exchange-rate.service.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// MQTT Bridge process reference
let mqttBridgeProcess = null

const { Pool } = pg

// Initialize Anthropic client (will use ANTHROPIC_API_KEY env variable)
const anthropic = new Anthropic()

const app = express()
const PORT = parseInt(process.env.API_PORT || '3001', 10)

// PostgreSQL connection pool - uses environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Fallback to individual env vars if DATABASE_URL not set
  user: process.env.DATABASE_URL ? undefined : (process.env.DB_USER || 'simportal'),
  password: process.env.DATABASE_URL ? undefined : process.env.DB_PASSWORD,
  host: process.env.DATABASE_URL ? undefined : (process.env.DB_HOST || 'localhost'),
  port: process.env.DATABASE_URL ? undefined : parseInt(process.env.DB_PORT || '5434', 10),
  database: process.env.DATABASE_URL ? undefined : (process.env.DB_NAME || 'simcardportal'),
  // Connection pool settings
  max: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
})

// Schema prefix - empty for Supabase (public schema), schema name for local dev
// Set USE_PUBLIC_SCHEMA=true to use public schema (Supabase mode)
const SCHEMA = process.env.USE_PUBLIC_SCHEMA === 'true' ? '' : '"sim-card-portal-v2".'

// Middleware
app.use(cors())
app.use(express.json())

// Mount Provisioning API v1 Router
// Endpoints: /api/v1/sims, /api/v1/webhooks, /api/v1/usage
app.use('/api/v1', createV1Router(pool))

// Utility to convert snake_case to camelCase and handle Date objects
function toCamelCase(obj) {
  if (Array.isArray(obj)) {
    return obj.map(v => toCamelCase(v))
  } else if (obj instanceof Date) {
    return obj.toISOString()
  } else if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((result, key) => {
      const camelKey = key.replace(/_([a-z])/g, g => g[1].toUpperCase())
      result[camelKey] = toCamelCase(obj[key])
      return result
    }, {})
  }
  return obj
}

// GET /api/devices
app.get('/api/devices', async (req, res) => {
  try {
    const { id } = req.query

    // Use Supabase if configured, otherwise fall back to PostgreSQL pool
    if (isSupabaseConfigured() && supabase) {
      if (id) {
        const { data, error } = await supabase
          .schema(getSchemaName())
          .from('devices')
          .select(`*, device_types:device_type_id(name), locations:location_id(name)`)
          .eq('id', id)
          .single()

        if (error || !data) {
          return res.status(404).json({ success: false, error: 'Device not found' })
        }

        return res.json({ success: true, data: toCamelCase(data) })
      }

      const { data, error } = await supabase
        .schema(getSchemaName())
        .from('devices')
        .select(`*, device_types:device_type_id(name), locations:location_id(name)`)
        .order('name')

      if (error) {
        console.error('Supabase error fetching devices:', error)
        return res.status(500).json({ success: false, error: 'Database error' })
      }

      return res.json({ success: true, data: toCamelCase(data || []) })
    }

    // Fall back to PostgreSQL pool
    if (id) {
      // Get single device
      const result = await pool.query(`
        SELECT d.*, dt.name as device_type_name, l.name as location_name
        FROM ${SCHEMA}devices d
        LEFT JOIN ${SCHEMA}device_types dt ON d.device_type_id = dt.id
        LEFT JOIN ${SCHEMA}locations l ON d.location_id = l.id
        WHERE d.id = $1
      `, [id])

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Device not found' })
      }

      return res.json({ success: true, data: toCamelCase(result.rows[0]) })
    }

    // Get all devices
    const result = await pool.query(`
      SELECT d.*, dt.name as device_type_name, l.name as location_name
      FROM ${SCHEMA}devices d
      LEFT JOIN ${SCHEMA}device_types dt ON d.device_type_id = dt.id
      LEFT JOIN ${SCHEMA}locations l ON d.location_id = l.id
      ORDER BY d.name
    `)

    res.json({ success: true, data: toCamelCase(result.rows) })
  } catch (error) {
    console.error('Error fetching devices:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// PUT /api/devices - Update device
app.put('/api/devices', async (req, res) => {
  try {
    const { id } = req.query
    const updates = req.body

    if (!id) {
      return res.status(400).json({ success: false, error: 'Device ID is required' })
    }

    // Build dynamic update query
    const updateFields = []
    const values = []
    let paramCount = 0

    // Map camelCase to snake_case for database columns
    const fieldMappings = {
      name: 'name',
      status: 'status',
      simCard: 'sim_card_id',
      deviceType: 'device_type_id',
      location: 'location_id',
      signalStrength: 'signal_strength',
      dataUsage: 'data_usage_mb',
      connectionType: 'connection_type',
      description: 'description',
      latitude: 'latitude',
      longitude: 'longitude',
      temperature: 'temperature',
      humidity: 'humidity',
      light: 'light',
      sensorSamplingInterval: 'sensor_sampling_interval',
      healthStatus: 'health_status',
      batteryLevel: 'battery_level',
      securityStatus: 'security_status',
      assetManagementUrl: 'asset_management_url',
      supplierDeviceUrl: 'supplier_device_url',
      userManualUrl: 'user_manual_url',
      specificationBase64: 'specification_base64'
    }

    for (const [camelKey, snakeKey] of Object.entries(fieldMappings)) {
      if (updates[camelKey] !== undefined) {
        paramCount++
        updateFields.push(`${snakeKey} = $${paramCount}`)
        // Convert connectionType and status to lowercase for database constraints
        let value = updates[camelKey]
        if ((camelKey === 'connectionType' || camelKey === 'status') && typeof value === 'string') {
          value = value.toLowerCase()
        }
        // Parse dataUsage - extract numeric value from strings like "2.4 MB"
        if (camelKey === 'dataUsage' && typeof value === 'string') {
          const match = value.match(/^([\d.]+)/)
          value = match ? parseFloat(match[1]) : 0
        }
        values.push(value)
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' })
    }

    // Add updated_at
    paramCount++
    updateFields.push(`updated_at = $${paramCount}`)
    values.push(new Date().toISOString())

    // Add ID for WHERE clause
    paramCount++
    values.push(id)

    const query = `
      UPDATE ${SCHEMA}devices
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `

    console.log('Update device query:', query, values)

    const result = await pool.query(query, values)

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Device not found' })
    }

    res.json({ success: true, data: toCamelCase(result.rows[0]) })
  } catch (error) {
    console.error('Error updating device:', error)
    res.status(500).json({ success: false, error: 'Database error: ' + error.message })
  }
})

// GET /api/simcards
app.get('/api/simcards', async (req, res) => {
  try {
    const { id } = req.query

    // Use Supabase if configured
    if (isSupabaseConfigured() && supabase) {
      if (id) {
        const { data, error } = await supabase
          .from('sim_cards')
          .select('*')
          .eq('id', id)
          .single()

        if (error || !data) {
          return res.status(404).json({ success: false, error: 'SIM card not found' })
        }

        return res.json({ success: true, data: toCamelCase(data) })
      }

      const { data, error } = await supabase
        .from('sim_cards')
        .select('*')
        .order('id')

      if (error) throw error
      return res.json({ success: true, data: toCamelCase(data || []) })
    }

    // Fall back to pg pool
    if (id) {
      const result = await pool.query(`
        SELECT * FROM ${SCHEMA}sim_cards WHERE id = $1
      `, [id])

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'SIM card not found' })
      }

      return res.json({ success: true, data: toCamelCase(result.rows[0]) })
    }

    const result = await pool.query(`
      SELECT * FROM ${SCHEMA}sim_cards ORDER BY id
    `)

    res.json({ success: true, data: toCamelCase(result.rows) })
  } catch (error) {
    console.error('Error fetching SIM cards:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// PUT /api/simcards - Update SIM card
app.put('/api/simcards', async (req, res) => {
  try {
    const { id } = req.query
    const updates = req.body

    if (!id) {
      return res.status(400).json({ success: false, error: 'SIM card ID is required' })
    }

    // Map camelCase to snake_case for database columns
    const fieldMappings = {
      iccid: 'iccid',
      msisdn: 'msisdn',
      status: 'status',
      carrier: 'carrier',
      plan: 'plan',
      dataUsed: 'data_used',
      dataLimit: 'data_limit',
      activationDate: 'activation_date',
      expiryDate: 'expiry_date'
    }

    // Use Supabase if configured
    if (isSupabaseConfigured() && supabase) {
      const updateData = { updated_at: new Date().toISOString() }
      for (const [camelKey, snakeKey] of Object.entries(fieldMappings)) {
        if (updates[camelKey] !== undefined) {
          updateData[snakeKey] = updates[camelKey]
        }
      }

      if (Object.keys(updateData).length <= 1) {
        return res.status(400).json({ success: false, error: 'No fields to update' })
      }

      const { data, error } = await supabase
        .from('sim_cards')
        .update(updateData)
        .eq('id', id)
        .select('*')
        .single()

      if (error || !data) {
        return res.status(404).json({ success: false, error: 'SIM card not found' })
      }

      return res.json({ success: true, data: toCamelCase(data) })
    }

    // Fall back to pg pool
    // Build dynamic update query
    const updateFields = []
    const values = []
    let paramCount = 0

    for (const [camelKey, snakeKey] of Object.entries(fieldMappings)) {
      if (updates[camelKey] !== undefined) {
        paramCount++
        updateFields.push(`${snakeKey} = $${paramCount}`)
        values.push(updates[camelKey])
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' })
    }

    // Add updated_at
    paramCount++
    updateFields.push(`updated_at = $${paramCount}`)
    values.push(new Date().toISOString())

    // Add ID for WHERE clause
    paramCount++
    values.push(id)

    const query = `
      UPDATE ${SCHEMA}sim_cards
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `

    console.log('Update SIM card query:', query, values)

    const result = await pool.query(query, values)

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'SIM card not found' })
    }

    res.json({ success: true, data: toCamelCase(result.rows[0]) })
  } catch (error) {
    console.error('Error updating SIM card:', error)
    res.status(500).json({ success: false, error: 'Database error: ' + error.message })
  }
})

// POST /api/simcards - Create a new SIM card (legacy table)
app.post('/api/simcards', async (req, res) => {
  try {
    const { id, iccid, msisdn, status, carrier, plan, dataUsed, dataLimit, activationDate, expiryDate } = req.body

    if (!iccid) {
      return res.status(400).json({ success: false, error: 'iccid is required' })
    }

    // Generate ID if not provided
    const simId = id || `SIM${Date.now().toString(36).toUpperCase()}`
    const now = new Date().toISOString()

    // Use Supabase if configured
    if (isSupabaseConfigured() && supabase) {
      const insertData = {
        id: simId,
        iccid,
        msisdn: msisdn || null,
        status: status || 'Active',
        carrier: carrier || 'Swiss Telecom',
        plan: plan || 'IoT Standard',
        data_used: dataUsed || '0 MB',
        data_limit: dataLimit || '1 GB',
        activation_date: activationDate || now.split('T')[0],
        expiry_date: expiryDate || null,
        created_at: now,
        updated_at: now
      }

      const { data, error } = await supabase
        .from('sim_cards')
        .upsert(insertData, { onConflict: 'iccid' })
        .select('*')
        .single()

      if (error) throw error

      console.log(`[SIM Cards] Created/updated SIM: ${iccid}`)
      return res.json({ success: true, data: toCamelCase(data) })
    }

    // Fall back to pg pool
    const result = await pool.query(`
      INSERT INTO ${SCHEMA}sim_cards (id, iccid, msisdn, status, carrier, plan, data_used, data_limit, activation_date, expiry_date, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      ON CONFLICT (iccid) DO UPDATE SET
        msisdn = COALESCE(EXCLUDED.msisdn, sim_cards.msisdn),
        status = COALESCE(EXCLUDED.status, sim_cards.status),
        carrier = COALESCE(EXCLUDED.carrier, sim_cards.carrier),
        plan = COALESCE(EXCLUDED.plan, sim_cards.plan),
        data_used = COALESCE(EXCLUDED.data_used, sim_cards.data_used),
        data_limit = COALESCE(EXCLUDED.data_limit, sim_cards.data_limit),
        updated_at = NOW()
      RETURNING *
    `, [
      simId,
      iccid,
      msisdn || null,
      status || 'Active',
      carrier || 'Swiss Telecom',
      plan || 'IoT Standard',
      dataUsed || '0 MB',
      dataLimit || '1 GB',
      activationDate || new Date().toISOString().split('T')[0],
      expiryDate || null
    ])

    console.log(`[SIM Cards] Created/updated SIM: ${iccid}`)

    res.json({ success: true, data: toCamelCase(result.rows[0]) })
  } catch (error) {
    console.error('Error creating SIM card:', error)
    res.status(500).json({ success: false, error: 'Database error: ' + error.message })
  }
})

// GET /api/device-location-history
app.get('/api/device-location-history', async (req, res) => {
  try {
    const { device_id, start_date, end_date, limit = '1000' } = req.query

    if (!device_id) {
      return res.status(400).json({ success: false, error: 'device_id is required' })
    }

    // Use Supabase if configured
    if (isSupabaseConfigured() && supabase) {
      let query = supabase
        .from('device_location_history')
        .select('*')
        .eq('device_id', device_id)
        .order('recorded_at', { ascending: true })
        .limit(parseInt(limit))

      if (start_date) {
        query = query.gte('recorded_at', start_date)
      }
      if (end_date) {
        query = query.lte('recorded_at', end_date)
      }

      const { data, error } = await query

      if (error) throw error

      return res.json({
        success: true,
        data: toCamelCase(data || []),
        count: (data || []).length
      })
    }

    // Fallback to PostgreSQL
    let query = `
      SELECT * FROM ${SCHEMA}device_location_history
      WHERE device_id = $1
    `
    const params = [device_id]
    let paramCount = 1

    if (start_date) {
      paramCount++
      query += ` AND recorded_at >= $${paramCount}`
      params.push(start_date)
    }

    if (end_date) {
      paramCount++
      query += ` AND recorded_at <= $${paramCount}`
      params.push(end_date)
    }

    query += ` ORDER BY recorded_at ASC LIMIT ${parseInt(limit)}`

    const result = await pool.query(query, params)

    res.json({
      success: true,
      data: toCamelCase(result.rows),
      count: result.rows.length
    })
  } catch (error) {
    console.error('Error fetching location history:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// GET /api/device-sensor-history
app.get('/api/device-sensor-history', async (req, res) => {
  try {
    const { device_id, start_date, end_date, limit = '1000' } = req.query

    if (!device_id) {
      return res.status(400).json({ success: false, error: 'device_id is required' })
    }

    // Use Supabase if configured
    if (isSupabaseConfigured() && supabase) {
      let query = supabase
        .from('device_sensor_history')
        .select('*')
        .eq('device_id', device_id)
        .order('recorded_at', { ascending: true })
        .limit(parseInt(limit))

      if (start_date) {
        query = query.gte('recorded_at', start_date)
      }
      if (end_date) {
        query = query.lte('recorded_at', end_date)
      }

      const { data, error } = await query

      if (error) throw error

      return res.json({
        success: true,
        data: toCamelCase(data || []),
        count: (data || []).length
      })
    }

    // Fallback to PostgreSQL
    let query = `
      SELECT * FROM ${SCHEMA}device_sensor_history
      WHERE device_id = $1
    `
    const params = [device_id]
    let paramCount = 1

    if (start_date) {
      paramCount++
      query += ` AND recorded_at >= $${paramCount}`
      params.push(start_date)
    }

    if (end_date) {
      paramCount++
      query += ` AND recorded_at <= $${paramCount}`
      params.push(end_date)
    }

    query += ` ORDER BY recorded_at ASC LIMIT ${parseInt(limit)}`

    const result = await pool.query(query, params)

    res.json({
      success: true,
      data: toCamelCase(result.rows),
      count: result.rows.length
    })
  } catch (error) {
    console.error('Error fetching sensor history:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// POST /api/auth (stub authentication)
app.post('/api/auth', async (req, res) => {
  const { username, password, action } = req.body

  if (action === 'login') {
    // Simple hardcoded auth for development
    if (username === 'admin' && password === '1234567') {
      return res.json({
        success: true,
        data: {
          token: 'dev-token-12345',
          user: { id: 'admin', username: 'admin', role: 'admin' }
        }
      })
    }
    return res.status(401).json({ success: false, error: 'Invalid credentials' })
  }

  if (action === 'logout') {
    return res.json({ success: true })
  }

  res.status(400).json({ success: false, error: 'Invalid action' })
})

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok', database: 'connected' })
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected' })
  }
})

// GET /api/locations - Get all locations
app.get('/api/locations', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, country, city, latitude, longitude
      FROM ${SCHEMA}locations
      ORDER BY country, city, name
    `)

    res.json({ success: true, data: toCamelCase(result.rows) })
  } catch (error) {
    console.error('Error fetching locations:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// GET /api/device-types - Get all device types
app.get('/api/device-types', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, description
      FROM ${SCHEMA}device_types
      ORDER BY name
    `)

    res.json({ success: true, data: toCamelCase(result.rows) })
  } catch (error) {
    console.error('Error fetching device types:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// GET /api/sim-cards - Get SIM cards (with optional available filter)
app.get('/api/sim-cards', async (req, res) => {
  try {
    const { available } = req.query

    let query = `
      SELECT s.id, s.iccid, s.msisdn, s.status, s.carrier, s.plan,
             s.data_used, s.data_limit, s.expiry_date,
             d.id as device_id, d.name as device_name
      FROM ${SCHEMA}sim_cards s
      LEFT JOIN ${SCHEMA}devices d ON d.sim_card_id = s.id
    `

    // If available=true, only return SIM cards not assigned to any device
    if (available === 'true') {
      query += ` WHERE d.id IS NULL AND s.status = 'active'`
    }

    query += ` ORDER BY s.id`

    const result = await pool.query(query)

    res.json({ success: true, data: toCamelCase(result.rows) })
  } catch (error) {
    console.error('Error fetching SIM cards:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// ============================================================
// SETTINGS API
// ============================================================

// GET /api/settings/currency - Get current display currency
app.get('/api/settings/currency', async (req, res) => {
  try {
    const currency = await getDisplayCurrency()
    res.json({ success: true, currency, supportedCurrencies: SUPPORTED_CURRENCIES })
  } catch (error) {
    console.error('Error getting currency setting:', error)
    res.status(500).json({ success: false, error: 'Failed to get currency setting' })
  }
})

// POST /api/settings/currency - Set display currency
app.post('/api/settings/currency', async (req, res) => {
  try {
    const { currency } = req.body

    if (!currency) {
      return res.status(400).json({ success: false, error: 'Currency is required' })
    }

    if (!SUPPORTED_CURRENCIES.includes(currency)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported currency: ${currency}. Supported: ${SUPPORTED_CURRENCIES.join(', ')}`
      })
    }

    const result = await setDisplayCurrency(currency)
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error })
    }

    res.json({ success: true, currency })
  } catch (error) {
    console.error('Error setting currency:', error)
    res.status(500).json({ success: false, error: 'Failed to set currency' })
  }
})

// GET /api/settings/exchange-rates - Get current exchange rates
app.get('/api/settings/exchange-rates', async (req, res) => {
  try {
    const { rates, rateDate } = await getAllRates()
    const displayCurrency = await getDisplayCurrency()

    res.json({
      success: true,
      baseCurrency: 'EUR',
      displayCurrency,
      rateDate,
      rates
    })
  } catch (error) {
    console.error('Error getting exchange rates:', error)
    res.status(500).json({ success: false, error: 'Failed to get exchange rates' })
  }
})

// POST /api/settings/refresh-rates - Manually refresh exchange rates
app.post('/api/settings/refresh-rates', async (req, res) => {
  try {
    const result = await fetchECBRates()

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error })
    }

    res.json({
      success: true,
      message: 'Exchange rates refreshed successfully',
      rateDate: result.rateDate
    })
  } catch (error) {
    console.error('Error refreshing rates:', error)
    res.status(500).json({ success: false, error: 'Failed to refresh exchange rates' })
  }
})

// ============================================================
// CONSUMPTION DASHBOARD API
// ============================================================

// GET /api/consumption/kpis - Get KPI metrics for dashboard
app.get('/api/consumption/kpis', async (req, res) => {
  try {
    const { start_date, end_date } = req.query

    // Default to current month if no dates provided
    const now = new Date()
    const startDate = start_date || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const endDate = end_date || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

    // Get previous period for comparison (same duration before start_date)
    const startDt = new Date(startDate)
    const endDt = new Date(endDate)
    const duration = endDt.getTime() - startDt.getTime()
    const prevStartDate = new Date(startDt.getTime() - duration).toISOString().split('T')[0]
    const prevEndDate = new Date(startDt.getTime() - 1).toISOString().split('T')[0]

    // Use Supabase if configured
    if (isSupabaseConfigured() && supabase) {
      // Current period aggregations
      const { data: currentData, error: currentError } = await supabase
        .from('usage_aggregations')
        .select('*')
        .gte('period_start', startDate)
        .lte('period_end', endDate)

      if (currentError) throw currentError

      // Previous period aggregations
      const { data: prevData } = await supabase
        .from('usage_aggregations')
        .select('*')
        .gte('period_start', prevStartDate)
        .lte('period_end', prevEndDate)

      // Get active SIM count
      const { count: activeSims } = await supabase
        .from('sim_cards')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Active')

      // Calculate KPIs
      const currentTotals = (currentData || []).reduce((acc, row) => ({
        totalDataBytes: acc.totalDataBytes + (row.total_data_bytes || 0),
        totalCost: acc.totalCost + parseFloat(row.total_cost || 0),
        activeSimCount: activeSims || 0
      }), { totalDataBytes: 0, totalCost: 0, activeSimCount: 0 })

      const prevTotals = (prevData || []).reduce((acc, row) => ({
        totalDataBytes: acc.totalDataBytes + (row.total_data_bytes || 0),
        totalCost: acc.totalCost + parseFloat(row.total_cost || 0)
      }), { totalDataBytes: 0, totalCost: 0 })

      const avgDataPerSim = currentTotals.activeSimCount > 0
        ? currentTotals.totalDataBytes / currentTotals.activeSimCount
        : 0

      // Calculate trends (percentage change)
      const calcTrend = (current, previous) => {
        if (previous === 0) return current > 0 ? 100 : 0
        return ((current - previous) / previous) * 100
      }

      // Get display currency and convert costs
      const displayCurrency = await getDisplayCurrency()
      const rate = await getExchangeRate(displayCurrency)
      const convertedTotalCost = currentTotals.totalCost * rate
      const convertedEstimatedCost = convertedTotalCost * 1.1

      const kpis = {
        totalSpend: {
          value: convertedTotalCost,
          trend: calcTrend(currentTotals.totalCost, prevTotals.totalCost),
          currency: displayCurrency
        },
        dataUsage: {
          value: currentTotals.totalDataBytes,
          valueGB: currentTotals.totalDataBytes / (1024 * 1024 * 1024),
          trend: calcTrend(currentTotals.totalDataBytes, prevTotals.totalDataBytes)
        },
        activeSims: {
          value: currentTotals.activeSimCount,
          trend: 0 // Would need historical data for this
        },
        avgDataPerSim: {
          value: avgDataPerSim,
          valueGB: avgDataPerSim / (1024 * 1024 * 1024),
          trend: 0
        },
        estimatedCost: {
          value: convertedEstimatedCost,
          trend: 0,
          currency: displayCurrency
        }
      }

      return res.json({ success: true, data: kpis, period: { start: startDate, end: endDate } })
    }

    // Fallback to PostgreSQL pool
    const currentResult = await pool.query(`
      SELECT
        COALESCE(SUM(total_data_bytes), 0) as total_data_bytes,
        COALESCE(SUM(total_cost), 0) as total_cost
      FROM usage_aggregations
      WHERE period_start >= $1 AND period_end <= $2
    `, [startDate, endDate])

    const prevResult = await pool.query(`
      SELECT
        COALESCE(SUM(total_data_bytes), 0) as total_data_bytes,
        COALESCE(SUM(total_cost), 0) as total_cost
      FROM usage_aggregations
      WHERE period_start >= $1 AND period_end <= $2
    `, [prevStartDate, prevEndDate])

    const simCountResult = await pool.query(`
      SELECT COUNT(*) as count FROM sim_cards WHERE status = 'Active'
    `)

    const current = currentResult.rows[0]
    const prev = prevResult.rows[0]
    const activeSims = parseInt(simCountResult.rows[0].count)

    const calcTrend = (curr, previous) => {
      const c = parseFloat(curr) || 0
      const p = parseFloat(previous) || 0
      if (p === 0) return c > 0 ? 100 : 0
      return ((c - p) / p) * 100
    }

    const totalDataBytes = parseFloat(current.total_data_bytes) || 0
    const totalCost = parseFloat(current.total_cost) || 0
    const avgDataPerSim = activeSims > 0 ? totalDataBytes / activeSims : 0

    // Get display currency and convert costs
    const displayCurrency = await getDisplayCurrency()
    const rate = await getExchangeRate(displayCurrency)
    const convertedTotalCost = totalCost * rate
    const convertedEstimatedCost = convertedTotalCost * 1.1

    const kpis = {
      totalSpend: {
        value: convertedTotalCost,
        trend: calcTrend(current.total_cost, prev.total_cost),
        currency: displayCurrency
      },
      dataUsage: {
        value: totalDataBytes,
        valueGB: totalDataBytes / (1024 * 1024 * 1024),
        trend: calcTrend(current.total_data_bytes, prev.total_data_bytes)
      },
      activeSims: {
        value: activeSims,
        trend: 0
      },
      avgDataPerSim: {
        value: avgDataPerSim,
        valueGB: avgDataPerSim / (1024 * 1024 * 1024),
        trend: 0
      },
      estimatedCost: {
        value: convertedEstimatedCost,
        trend: 0,
        currency: displayCurrency
      }
    }

    res.json({ success: true, data: kpis, period: { start: startDate, end: endDate } })
  } catch (error) {
    console.error('Error fetching consumption KPIs:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// GET /api/consumption/trends - Get time-series data for trends chart
// Granularity options:
//   - hourly: Last 24 hours, hourly data points
//   - daily: Last 7 days, daily data points
//   - weekly: Last ~5 weeks, weekly aggregates
//   - monthly: Last 6 months, monthly aggregates
app.get('/api/consumption/trends', async (req, res) => {
  try {
    const { start_date, end_date, granularity = 'monthly' } = req.query

    // Default date ranges based on granularity
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    let defaultStart, defaultEnd
    if (granularity === 'hourly') {
      // Last 24 hours
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      defaultStart = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
      defaultEnd = todayStr
    } else if (granularity === 'daily') {
      // Last 7 days
      const weekAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
      defaultStart = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, '0')}-${String(weekAgo.getDate()).padStart(2, '0')}`
      defaultEnd = todayStr
    } else if (granularity === 'weekly') {
      // Last ~5 weeks (35 days)
      const fiveWeeksAgo = new Date(now.getTime() - 34 * 24 * 60 * 60 * 1000)
      defaultStart = `${fiveWeeksAgo.getFullYear()}-${String(fiveWeeksAgo.getMonth() + 1).padStart(2, '0')}-${String(fiveWeeksAgo.getDate()).padStart(2, '0')}`
      defaultEnd = todayStr
    } else {
      // Monthly - Last 6 months
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      defaultStart = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`
      defaultEnd = todayStr
    }

    const startDate = start_date || defaultStart
    const endDate = end_date || defaultEnd

    // Helper to get ISO week number
    const getWeekNumber = (date) => {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
      const dayNum = d.getUTCDay() || 7
      d.setUTCDate(d.getUTCDate() + 4 - dayNum)
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
      return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
    }

    // Helper to get week label like "W51"
    const getWeekLabel = (date) => {
      const weekNum = getWeekNumber(date)
      return `W${weekNum}`
    }

    if (isSupabaseConfigured() && supabase) {
      // Query daily_usage table for granular data
      const { data, error } = await supabase
        .from('daily_usage')
        .select('usage_date, data_bytes, cost, active_sim_count, carrier_id')
        .gte('usage_date', startDate)
        .lte('usage_date', endDate)
        .order('usage_date')

      if (error) throw error

      // Aggregate based on granularity
      const grouped = {}

      if (granularity === 'hourly') {
        // For hourly view, generate 24 hourly data points for the last 24 hours
        // Since we only have daily data, distribute it across hours with realistic variation

        // Create daily totals first
        const dailyTotals = {}
        ;(data || []).forEach(row => {
          const dateKey = row.usage_date
          if (!dailyTotals[dateKey]) {
            dailyTotals[dateKey] = { dataBytes: 0, cost: 0, simCount: 0 }
          }
          dailyTotals[dateKey].dataBytes += row.data_bytes || 0
          dailyTotals[dateKey].cost += parseFloat(row.cost) || 0
          dailyTotals[dateKey].simCount = Math.max(dailyTotals[dateKey].simCount, row.active_sim_count || 0)
        })

        // Generate 24 hourly data points going back from current hour
        for (let i = 0; i < 24; i++) {
          const hourTime = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000)
          const actualHour = hourTime.getHours()
          const dateKey = `${hourTime.getFullYear()}-${String(hourTime.getMonth() + 1).padStart(2, '0')}-${String(hourTime.getDate()).padStart(2, '0')}`

          // Use simple hour label format: "14:00"
          const hourLabel = `${String(actualHour).padStart(2, '0')}:00`

          // Distribute daily usage across hours (with realistic variation)
          // Higher during business hours (8-18), lower at night
          const dailyData = dailyTotals[dateKey] || { dataBytes: 0, cost: 0, simCount: 0 }
          const hourWeight = (actualHour >= 8 && actualHour <= 18) ? 0.06 : 0.025

          grouped[i] = {
            period: hourLabel,
            dataBytes: dailyData.dataBytes * hourWeight,
            cost: dailyData.cost * hourWeight,
            simCount: dailyData.simCount
          }
        }
      } else {
        ;(data || []).forEach(row => {
          let key
          let periodLabel
          const date = new Date(row.usage_date)

          if (granularity === 'daily') {
            // Individual days
            key = row.usage_date
            periodLabel = row.usage_date
          } else if (granularity === 'weekly') {
            // Aggregate by week number - use week label as both key and period
            const weekLabel = getWeekLabel(date)
            key = weekLabel
            periodLabel = weekLabel
          } else {
            // Monthly - first day of month
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
            periodLabel = key
          }

          if (!grouped[key]) {
            grouped[key] = { period: periodLabel, dataBytes: 0, cost: 0, simCount: 0 }
          }
          grouped[key].dataBytes += row.data_bytes || 0
          grouped[key].cost += parseFloat(row.cost) || 0
          grouped[key].simCount = Math.max(grouped[key].simCount, row.active_sim_count || 0)
        })
      }

      // Sort the grouped data appropriately
      let sortedGroups = Object.values(grouped)
      if (granularity === 'weekly') {
        // For weekly, sort by week number numerically
        sortedGroups.sort((a, b) => {
          const weekA = parseInt(a.period.replace('W', ''))
          const weekB = parseInt(b.period.replace('W', ''))
          return weekA - weekB
        })
      } else {
        sortedGroups.sort((a, b) => a.period.localeCompare(b.period))
      }

      // Get display currency and exchange rate for conversion
      const displayCurrency = await getDisplayCurrency()
      const rate = await getExchangeRate(displayCurrency)

      const trends = sortedGroups.map(g => ({
          period: g.period,
          dataUsageGB: g.dataBytes / (1024 * 1024 * 1024),
          cost: g.cost * rate,
          simCount: g.simCount
        }))

      return res.json({ success: true, data: trends, granularity, currency: displayCurrency })
    }

    // Fallback to PostgreSQL - query daily_usage table
    let groupByClause
    let periodSelect

    if (granularity === 'hourly') {
      // For hourly, just get daily data and we'll process it
      periodSelect = 'usage_date as period'
      groupByClause = 'usage_date'
    } else if (granularity === 'daily') {
      periodSelect = 'usage_date as period'
      groupByClause = 'usage_date'
    } else if (granularity === 'weekly') {
      // Use PostgreSQL's EXTRACT to get ISO week number
      periodSelect = "'W' || EXTRACT(WEEK FROM usage_date)::integer as period"
      groupByClause = "EXTRACT(WEEK FROM usage_date)"
    } else {
      periodSelect = "date_trunc('month', usage_date)::date as period"
      groupByClause = "date_trunc('month', usage_date)"
    }

    const result = await pool.query(`
      SELECT
        ${periodSelect},
        SUM(data_bytes) as total_data_bytes,
        SUM(cost) as total_cost,
        MAX(active_sim_count) as active_sim_count
      FROM daily_usage
      WHERE usage_date >= $1 AND usage_date <= $2
      GROUP BY ${groupByClause}
      ORDER BY ${granularity === 'weekly' ? groupByClause : 'period'}
    `, [startDate, endDate])

    // Get display currency and exchange rate for conversion
    const displayCurrency = await getDisplayCurrency()
    const rate = await getExchangeRate(displayCurrency)

    let trends = result.rows.map(row => ({
      period: String(row.period),
      dataUsageGB: parseFloat(row.total_data_bytes) / (1024 * 1024 * 1024),
      cost: parseFloat(row.total_cost) * rate,
      simCount: parseInt(row.active_sim_count)
    }))

    // For hourly, generate synthetic hourly data from daily
    if (granularity === 'hourly') {
      const hourlyTrends = []
      for (let i = 0; i < 24; i++) {
        const hourTime = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000)
        const actualHour = hourTime.getHours()
        const dateKey = `${hourTime.getFullYear()}-${String(hourTime.getMonth() + 1).padStart(2, '0')}-${String(hourTime.getDate()).padStart(2, '0')}`
        const hourLabel = `${String(actualHour).padStart(2, '0')}:00`

        const dailyData = trends.find(t => t.period === dateKey) || { dataUsageGB: 0, cost: 0, simCount: 0 }
        const hourWeight = (actualHour >= 8 && actualHour <= 18) ? 0.06 : 0.025

        hourlyTrends.push({
          period: hourLabel,
          dataUsageGB: dailyData.dataUsageGB * hourWeight,
          cost: dailyData.cost * hourWeight,
          simCount: dailyData.simCount
        })
      }
      trends = hourlyTrends
    }

    res.json({ success: true, data: trends, granularity, currency: displayCurrency })
  } catch (error) {
    console.error('Error fetching consumption trends:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// GET /api/consumption/carriers - Get carrier breakdown
app.get('/api/consumption/carriers', async (req, res) => {
  try {
    const { start_date, end_date } = req.query

    const now = new Date()
    const startDate = start_date || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const endDate = end_date || now.toISOString().split('T')[0]

    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('usage_aggregations')
        .select('carrier_id, total_data_bytes, total_cost, carriers(name)')
        .gte('period_start', startDate)
        .lte('period_end', endDate)

      if (error) throw error

      // Aggregate by carrier
      const carrierMap = {}
      ;(data || []).forEach(row => {
        const carrierId = row.carrier_id
        const carrierName = row.carriers?.name || carrierId
        if (!carrierMap[carrierId]) {
          carrierMap[carrierId] = { id: carrierId, name: carrierName, dataBytes: 0, cost: 0 }
        }
        carrierMap[carrierId].dataBytes += row.total_data_bytes || 0
        carrierMap[carrierId].cost += parseFloat(row.total_cost) || 0
      })

      const carriers = Object.values(carrierMap)
      const totalCost = carriers.reduce((sum, c) => sum + c.cost, 0)
      const totalData = carriers.reduce((sum, c) => sum + c.dataBytes, 0)

      // Get display currency and exchange rate for conversion
      const displayCurrency = await getDisplayCurrency()
      const rate = await getExchangeRate(displayCurrency)

      const result = carriers.map(c => ({
        id: c.id,
        name: c.name,
        dataUsageGB: c.dataBytes / (1024 * 1024 * 1024),
        cost: c.cost * rate,
        costPercentage: totalCost > 0 ? (c.cost / totalCost) * 100 : 0,
        dataPercentage: totalData > 0 ? (c.dataBytes / totalData) * 100 : 0
      }))

      return res.json({ success: true, data: result, currency: displayCurrency })
    }

    // Fallback to PostgreSQL
    const result = await pool.query(`
      SELECT
        ua.carrier_id,
        c.name as carrier_name,
        SUM(ua.total_data_bytes) as total_data_bytes,
        SUM(ua.total_cost) as total_cost
      FROM usage_aggregations ua
      LEFT JOIN carriers c ON c.id = ua.carrier_id
      WHERE ua.period_start >= $1 AND ua.period_end <= $2
      GROUP BY ua.carrier_id, c.name
      ORDER BY total_cost DESC
    `, [startDate, endDate])

    const totalCost = result.rows.reduce((sum, r) => sum + parseFloat(r.total_cost), 0)
    const totalData = result.rows.reduce((sum, r) => sum + parseFloat(r.total_data_bytes), 0)

    // Get display currency and exchange rate for conversion
    const displayCurrency = await getDisplayCurrency()
    const rate = await getExchangeRate(displayCurrency)

    const carriers = result.rows.map(row => ({
      id: row.carrier_id,
      name: row.carrier_name || row.carrier_id,
      dataUsageGB: parseFloat(row.total_data_bytes) / (1024 * 1024 * 1024),
      cost: parseFloat(row.total_cost) * rate,
      costPercentage: totalCost > 0 ? (parseFloat(row.total_cost) / totalCost) * 100 : 0,
      dataPercentage: totalData > 0 ? (parseFloat(row.total_data_bytes) / totalData) * 100 : 0
    }))

    res.json({ success: true, data: carriers, currency: displayCurrency })
  } catch (error) {
    console.error('Error fetching carrier breakdown:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// GET /api/consumption/regional - Get regional usage data
app.get('/api/consumption/regional', async (req, res) => {
  try {
    if (isSupabaseConfigured() && supabase) {
      // Get devices with their locations and data usage
      const { data, error } = await supabase
        .from('devices')
        .select('id, name, latitude, longitude, data_usage_mb, locations(name, latitude, longitude)')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)

      if (error) throw error

      const regional = (data || []).map(d => ({
        id: d.id,
        name: d.name,
        latitude: parseFloat(d.latitude),
        longitude: parseFloat(d.longitude),
        dataUsageMB: parseFloat(d.data_usage_mb) || 0,
        locationName: d.locations?.name
      }))

      return res.json({ success: true, data: regional })
    }

    // Fallback to PostgreSQL
    const result = await pool.query(`
      SELECT
        d.id, d.name, d.latitude, d.longitude, d.data_usage_mb,
        l.name as location_name
      FROM devices d
      LEFT JOIN locations l ON l.id = d.location_id
      WHERE d.latitude IS NOT NULL AND d.longitude IS NOT NULL
    `)

    const regional = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      dataUsageMB: parseFloat(row.data_usage_mb) || 0,
      locationName: row.location_name
    }))

    res.json({ success: true, data: regional })
  } catch (error) {
    console.error('Error fetching regional data:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// GET /api/consumption/invoices - Get invoice history
app.get('/api/consumption/invoices', async (req, res) => {
  try {
    const { page = 1, limit = 10, status, carrier_id } = req.query
    const offset = (parseInt(page) - 1) * parseInt(limit)

    if (isSupabaseConfigured() && supabase) {
      let query = supabase
        .from('invoices')
        .select('*, carriers(name)', { count: 'exact' })

      if (status) query = query.eq('status', status)
      if (carrier_id) query = query.eq('carrier_id', carrier_id)

      const { data, error, count } = await query
        .order('period_start', { ascending: false })
        .range(offset, offset + parseInt(limit) - 1)

      if (error) throw error

      // Get display currency and exchange rate for conversion
      const displayCurrency = await getDisplayCurrency()
      const rate = await getExchangeRate(displayCurrency)

      const invoices = (data || []).map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        carrierId: inv.carrier_id,
        carrierName: inv.carriers?.name || inv.carrier_id,
        periodStart: inv.period_start,
        periodEnd: inv.period_end,
        totalAmount: parseFloat(inv.total_amount) * rate,
        currency: displayCurrency,
        status: inv.status,
        dueDate: inv.due_date,
        paidDate: inv.paid_date,
        pdfUrl: inv.pdf_url,
        erpnextReference: inv.erpnext_reference
      }))

      return res.json({
        success: true,
        data: invoices,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count || 0,
          totalPages: Math.ceil((count || 0) / parseInt(limit))
        },
        displayCurrency
      })
    }

    // Fallback to PostgreSQL
    let query = `
      SELECT i.*, c.name as carrier_name
      FROM invoices i
      LEFT JOIN carriers c ON c.id = i.carrier_id
      WHERE 1=1
    `
    const params = []
    let paramCount = 0

    if (status) {
      paramCount++
      query += ` AND i.status = $${paramCount}`
      params.push(status)
    }
    if (carrier_id) {
      paramCount++
      query += ` AND i.carrier_id = $${paramCount}`
      params.push(carrier_id)
    }

    // Get total count
    const countResult = await pool.query(
      query.replace('SELECT i.*, c.name as carrier_name', 'SELECT COUNT(*) as count'),
      params
    )
    const total = parseInt(countResult.rows[0].count)

    // Get paginated results
    query += ` ORDER BY i.period_start DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`
    params.push(parseInt(limit), offset)

    const result = await pool.query(query, params)

    // Get display currency and exchange rate for conversion
    const displayCurrency = await getDisplayCurrency()
    const rate = await getExchangeRate(displayCurrency)

    const invoices = result.rows.map(row => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      carrierId: row.carrier_id,
      carrierName: row.carrier_name || row.carrier_id,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      totalAmount: parseFloat(row.total_amount) * rate,
      currency: displayCurrency,
      status: row.status,
      dueDate: row.due_date,
      paidDate: row.paid_date,
      pdfUrl: row.pdf_url,
      erpnextReference: row.erpnext_reference
    }))

    res.json({
      success: true,
      data: invoices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      },
      displayCurrency
    })
  } catch (error) {
    console.error('Error fetching invoices:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// POST /api/llm/chart - Generate chart configuration from natural language
app.post('/api/llm/chart', async (req, res) => {
  try {
    const { query, dateRange, currency = 'CHF' } = req.body

    if (!query) {
      return res.status(400).json({ success: false, error: 'Query is required' })
    }

    // Build context with available data
    let dataContext = ''

    if (isSupabaseConfigured() && supabase) {
      // Get carriers
      const { data: carriers } = await supabase.from('carriers').select('id, name')
      dataContext += `\nCarriers: ${(carriers || []).map(c => c.name).join(', ')}`

      // Get recent aggregations summary
      const { data: aggr } = await supabase
        .from('usage_aggregations')
        .select('period_start, carrier_id, total_data_bytes, total_cost')
        .order('period_start', { ascending: false })
        .limit(20)

      if (aggr && aggr.length > 0) {
        dataContext += `\n\nRecent usage data (last ${aggr.length} records):\n`
        aggr.forEach(a => {
          dataContext += `- ${a.period_start}: carrier=${a.carrier_id}, data=${(a.total_data_bytes / (1024*1024*1024)).toFixed(2)}GB, cost=${a.total_cost} ${currency}\n`
        })
      }
    }

    const systemPrompt = `You are Bob, a data analyst for SIM card usage analytics.

Available data:${dataContext}

IMPORTANT: All costs should be displayed in ${currency} (the user's configured currency).

When the user asks for data visualization, respond with ONLY a valid JSON object (no markdown, no explanation) in this exact format:
{
  "type": "chart" | "table" | "text",
  "chartType": "bar" | "line" | "pie" | "doughnut" (only if type is "chart"),
  "title": "Chart title",
  "data": {
    "labels": ["Label1", "Label2"],
    "datasets": [{
      "label": "Dataset name",
      "data": [10, 20],
      "backgroundColor": ["#137fec", "#10b981"]
    }]
  }
}

For tables:
{
  "type": "table",
  "title": "Table title",
  "columns": ["Column1", "Column2"],
  "rows": [["Value1", "Value2"]]
}

For text responses:
{
  "type": "text",
  "content": "Your response here"
}

IMPORTANT: For questions that involve strategic decisions, optimization suggestions, complex analysis, cost reduction strategies, carrier comparisons, deployment recommendations, or any topic where professional consultation would be valuable, ALWAYS end your response with this exact text:

"For expert guidance on optimizing your IoT deployment, our IoTo consultants can help. Would you like an IoTo representative to reach out to discuss your needs? Press the 'Contact IoTo' button below to initiate the request."

When labeling cost-related data, always use "${currency}" as the currency code. For example:
- Dataset label: "Cost (${currency})" or "Average Cost (${currency})"
- Chart title: "Monthly Costs in ${currency}"
- Table headers: "Cost (${currency})"

Current date: ${new Date().toISOString().split('T')[0]}
${dateRange ? `Date range: ${dateRange.start} to ${dateRange.end}` : ''}`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        { role: 'user', content: query }
      ]
    })

    const responseText = response.content[0].text

    // Try to parse the JSON response
    try {
      const chartConfig = JSON.parse(responseText)
      res.json({ success: true, data: chartConfig })
    } catch {
      // If not valid JSON, return as text response
      res.json({
        success: true,
        data: {
          type: 'text',
          content: responseText
        }
      })
    }
  } catch (error) {
    console.error('Error generating chart:', error)
    res.status(500).json({ success: false, error: 'Failed to generate chart: ' + error.message })
  }
})

// ============================================================
// LLM COMMAND INTERFACE
// ============================================================

// Rate limiting store (in-memory for development)
const rateLimitStore = new Map()
const RATE_LIMIT_WINDOW = 60000 // 1 minute
const RATE_LIMIT_MAX = 20 // 20 requests per minute

function checkRateLimit(userId) {
  const now = Date.now()
  const userRequests = rateLimitStore.get(userId) || []

  // Filter out old requests
  const recentRequests = userRequests.filter(time => now - time < RATE_LIMIT_WINDOW)

  if (recentRequests.length >= RATE_LIMIT_MAX) {
    return false
  }

  recentRequests.push(now)
  rateLimitStore.set(userId, recentRequests)
  return true
}

// Role-based access configuration
// NOTE: Bob LLM agent is READ-ONLY - no modifications allowed for devices or SIM cards
const rolePermissions = {
  'Super Admin': { canQuery: ['devices', 'simcards', 'users'], canModify: [] },
  'Admin': { canQuery: ['devices', 'simcards', 'users'], canModify: [] },
  'FMP': { canQuery: ['devices', 'simcards', 'users'], canModify: [] },
  'FMP Viewer': { canQuery: ['devices', 'simcards', 'users'], canModify: [] },
  'DMP': { canQuery: ['devices'], canModify: [] },
  'DMP Viewer': { canQuery: ['devices'], canModify: [] },
  'CMP': { canQuery: ['simcards'], canModify: [] },
  'CMP Viewer': { canQuery: ['simcards'], canModify: [] },
  'Viewer': { canQuery: ['devices', 'simcards'], canModify: [] }
}

// Build system prompt with context based on user role
async function buildSystemPrompt(userRole) {
  const permissions = rolePermissions[userRole] || { canQuery: [], canModify: [] }

  let dataContext = ''

  // Fetch relevant data based on role permissions
  if (permissions.canQuery.includes('devices')) {
    let devicesData = []
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('devices')
        .select('id, name, status, connection_type, signal_strength, data_usage_mb, latitude, longitude, temperature, humidity, light, battery_level, locations(name), device_types(name)')
        .order('name')
        .limit(50)
      if (!error && data) {
        devicesData = data.map(d => ({
          ...d,
          location_name: d.locations?.name,
          device_type_name: d.device_types?.name
        }))
      }
    } else {
      const devices = await pool.query(`
        SELECT d.id, d.name, d.status, d.connection_type, d.signal_strength, d.data_usage_mb,
               d.latitude, d.longitude, d.temperature, d.humidity, d.light, d.battery_level,
               l.name as location_name, dt.name as device_type_name
        FROM ${SCHEMA}devices d
        LEFT JOIN ${SCHEMA}locations l ON d.location_id = l.id
        LEFT JOIN ${SCHEMA}device_types dt ON d.device_type_id = dt.id
        ORDER BY d.name LIMIT 50
      `)
      devicesData = devices.rows
    }
    dataContext += `\n\nAvailable Devices (${devicesData.length} total):\n`
    devicesData.forEach(d => {
      let deviceInfo = `- ${d.id}: ${d.name} (status: ${d.status}, type: ${d.device_type_name || 'Unknown'}, connection: ${d.connection_type})`
      if (d.location_name) deviceInfo += `, location: ${d.location_name}`
      if (d.latitude && d.longitude) deviceInfo += `, coordinates: ${d.latitude}, ${d.longitude}`
      if (d.temperature !== null) deviceInfo += `, temp: ${d.temperature}°C`
      if (d.humidity !== null) deviceInfo += `, humidity: ${d.humidity}%`
      if (d.battery_level !== null) deviceInfo += `, battery: ${d.battery_level}%`
      dataContext += deviceInfo + '\n'
    })
  }

  if (permissions.canQuery.includes('simcards')) {
    let simcardsData = []
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('sim_cards')
        .select('id, iccid, msisdn, status, carrier, plan, data_used, data_limit, expiry_date, devices(name, latitude, longitude, locations(name))')
        .order('status')
        .limit(50)
      if (!error && data) {
        simcardsData = data.map(s => ({
          ...s,
          device_name: s.devices?.[0]?.name,
          location_name: s.devices?.[0]?.locations?.name,
          latitude: s.devices?.[0]?.latitude,
          longitude: s.devices?.[0]?.longitude
        }))
      }
    } else {
      const simcards = await pool.query(`
        SELECT s.id, s.iccid, s.msisdn, s.status, s.carrier, s.plan, s.data_used, s.data_limit, s.expiry_date,
               d.name as device_name, l.name as location_name, d.latitude, d.longitude
        FROM ${SCHEMA}sim_cards s
        LEFT JOIN ${SCHEMA}devices d ON d.sim_card_id = s.id
        LEFT JOIN ${SCHEMA}locations l ON d.location_id = l.id
        ORDER BY
          CASE WHEN s.status = 'Active' THEN 0 ELSE 1 END,
          CASE WHEN d.id IS NOT NULL THEN 0 ELSE 1 END,
          s.id
        LIMIT 50
      `)
      simcardsData = simcards.rows
    }
    dataContext += `\n\nAvailable SIM Cards (${simcardsData.length} total):\n`
    simcardsData.forEach(s => {
      let simInfo = `- ${s.id}: ICCID ${s.iccid}, MSISDN ${s.msisdn} (status: ${s.status}, carrier: ${s.carrier}, plan: ${s.plan})`
      if (s.device_name) simInfo += `, device: ${s.device_name}`
      if (s.location_name) simInfo += `, location: ${s.location_name}`
      if (s.latitude && s.longitude) simInfo += `, coordinates: ${s.latitude}, ${s.longitude}`
      if (s.data_used && s.data_limit) simInfo += `, usage: ${s.data_used}/${s.data_limit}`
      if (s.expiry_date) simInfo += `, expires: ${s.expiry_date}`
      dataContext += simInfo + '\n'
    })
  }

  const canModifyText = permissions.canModify.length > 0
    ? `You CAN propose modifications to: ${permissions.canModify.join(', ')}.`
    : 'You CANNOT propose any modifications - read-only access.'

  return `You are Bob, a friendly AI assistant for the IoTo Portal, a SIM card and IoT device management system.

Current user role: ${userRole}
${canModifyText}

Your capabilities:
1. Answer questions about devices, SIM cards, and system data
2. Help users find specific information
3. Provide insights and analytics about the IoT fleet

IMPORTANT RULES:
- You are READ-ONLY. You CANNOT create, modify, or delete any devices or SIM cards.
- If users ask you to make changes, politely explain that modifications must be done through the portal UI.
- Be concise and helpful

CONSULTANT REFERRAL RULE:
When users ask questions that are OUTSIDE of data analysis or portal operations, such as:
- How to optimise their IoT deployment
- Best practices for fleet management
- Strategic advice on connectivity or device selection
- Cost optimization strategies
- Integration with external systems
- Custom development or advanced configurations
- Any "how do I improve/optimize" questions beyond simple data queries

You should:
1. Provide whatever helpful information you can
2. At the END of your response, add: "For expert guidance on optimizing your IoT deployment, our IoTo consultants can help. Would you like an IoTo representative to reach out to discuss your needs? Press the 'Contact IoTo' button below to initiate the request."

Available data context:${dataContext}

Valid device statuses: active, inactive, maintenance, offline
Valid device connection types: 4g, 5g, lte, wifi
Valid SIM card statuses: active, inactive, suspended`
}

// Parse actions from Claude's response
function parseActionsFromResponse(responseText) {
  const actions = []
  const actionRegex = /```action\s*([\s\S]*?)```/g
  let match

  while ((match = actionRegex.exec(responseText)) !== null) {
    try {
      const actionJson = JSON.parse(match[1].trim())
      actions.push({
        id: randomUUID(),
        ...actionJson
      })
    } catch (e) {
      console.error('Failed to parse action JSON:', e)
    }
  }

  return actions
}

// Clean response text (remove action blocks for display)
function cleanResponseText(responseText) {
  return responseText.replace(/```action[\s\S]*?```/g, '').trim()
}

// Validate action against user permissions
function validateAction(action, userRole) {
  const permissions = rolePermissions[userRole] || { canModify: [] }

  if (!permissions.canModify.includes(action.resource)) {
    return { valid: false, error: `Your role (${userRole}) cannot modify ${action.resource}s` }
  }

  // Validate action type
  if (!['update', 'create', 'delete'].includes(action.type)) {
    return { valid: false, error: `Invalid action type: ${action.type}` }
  }

  // Validate resource type
  if (!['device', 'simcard', 'user'].includes(action.resource)) {
    return { valid: false, error: `Invalid resource type: ${action.resource}` }
  }

  return { valid: true }
}

// POST /api/llm/chat - Send message to Claude
app.post('/api/llm/chat', async (req, res) => {
  try {
    const { message, userContext } = req.body

    if (!message || !userContext) {
      return res.status(400).json({ success: false, error: 'Message and userContext are required' })
    }

    const { username, role } = userContext

    // Check rate limit
    if (!checkRateLimit(username)) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Please wait a moment before sending another message.'
      })
    }

    // Sanitize input (basic protection)
    const sanitizedMessage = message.slice(0, 2000).replace(/[<>]/g, '')

    // Build system prompt with role-based context
    const systemPrompt = await buildSystemPrompt(role)

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        { role: 'user', content: sanitizedMessage }
      ]
    })

    const responseText = response.content[0].text

    // Parse any proposed actions
    const actions = parseActionsFromResponse(responseText)

    // Validate actions against user permissions
    const validatedActions = actions.map(action => {
      const validation = validateAction(action, role)
      return { ...action, ...validation }
    }).filter(action => action.valid)

    // Store pending actions in database (skip for Supabase - tables may not exist)
    if (!isSupabaseConfigured()) {
      for (const action of validatedActions) {
        await pool.query(`
          INSERT INTO ${SCHEMA}pending_actions
          (id, user_id, user_role, action_type, resource_type, resource_id, changes, description, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
        `, [action.id, username, role, action.type, action.resource, action.resourceId, JSON.stringify(action.changes), action.description])
      }

      // Log the interaction
      await pool.query(`
        INSERT INTO ${SCHEMA}llm_audit_log
        (user_id, user_role, action_type, request_message, response_message, actions_proposed, tokens_used)
        VALUES ($1, $2, 'chat', $3, $4, $5, $6)
      `, [username, role, sanitizedMessage, responseText, JSON.stringify(validatedActions), response.usage?.input_tokens + response.usage?.output_tokens])
    }

    res.json({
      success: true,
      message: cleanResponseText(responseText),
      actions: validatedActions.map(a => ({
        id: a.id,
        type: a.type,
        resource: a.resource,
        resourceId: a.resourceId,
        changes: a.changes,
        description: a.description
      }))
    })
  } catch (error) {
    console.error('LLM chat error:', error)

    // Check for specific Anthropic errors
    if (error.status === 401) {
      return res.status(500).json({
        success: false,
        error: 'API key not configured. Please set ANTHROPIC_API_KEY environment variable.'
      })
    }

    res.status(500).json({ success: false, error: 'Failed to process message: ' + error.message })
  }
})

// POST /api/llm/execute - Execute an approved action
app.post('/api/llm/execute', async (req, res) => {
  try {
    const { actionId, approved, userContext } = req.body

    if (!actionId || approved === undefined || !userContext) {
      return res.status(400).json({ success: false, error: 'actionId, approved, and userContext are required' })
    }

    const { username, role } = userContext

    // Get the pending action
    const actionResult = await pool.query(`
      SELECT * FROM ${SCHEMA}pending_actions
      WHERE id = $1 AND user_id = $2 AND status = 'pending'
    `, [actionId, username])

    if (actionResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Action not found or already processed' })
    }

    const action = actionResult.rows[0]

    // Check if expired
    if (new Date(action.expires_at) < new Date()) {
      await pool.query(`
        UPDATE ${SCHEMA}pending_actions SET status = 'expired' WHERE id = $1
      `, [actionId])
      return res.status(400).json({ success: false, error: 'Action has expired' })
    }

    if (!approved) {
      // User rejected the action
      await pool.query(`
        UPDATE ${SCHEMA}pending_actions SET status = 'rejected' WHERE id = $1
      `, [actionId])

      // Log rejection
      await pool.query(`
        INSERT INTO ${SCHEMA}llm_audit_log
        (user_id, user_role, action_type, request_message)
        VALUES ($1, $2, 'action_rejected', $3)
      `, [username, role, `Rejected action: ${action.description}`])

      return res.json({ success: true, message: 'Action rejected' })
    }

    // Execute the action
    let result
    const changes = typeof action.changes === 'string' ? JSON.parse(action.changes) : action.changes

    try {
      if (action.action_type === 'update') {
        if (action.resource_type === 'device') {
          // Build update query for device
          const updateFields = []
          const values = []
          let paramCount = 0

          const fieldMappings = {
            name: 'name', status: 'status', connectionType: 'connection_type',
            signalStrength: 'signal_strength', description: 'description'
          }

          for (const [key, dbField] of Object.entries(fieldMappings)) {
            if (changes[key] !== undefined) {
              paramCount++
              updateFields.push(`${dbField} = $${paramCount}`)
              let value = changes[key]
              if ((key === 'status' || key === 'connectionType') && typeof value === 'string') {
                value = value.toLowerCase()
              }
              values.push(value)
            }
          }

          if (updateFields.length > 0) {
            paramCount++
            updateFields.push(`updated_at = $${paramCount}`)
            values.push(new Date().toISOString())

            paramCount++
            values.push(action.resource_id)

            const updateQuery = `
              UPDATE ${SCHEMA}devices
              SET ${updateFields.join(', ')}
              WHERE id = $${paramCount}
              RETURNING *
            `
            result = await pool.query(updateQuery, values)
          }
        } else if (action.resource_type === 'simcard') {
          // Build update query for SIM card
          const updateFields = []
          const values = []
          let paramCount = 0

          const fieldMappings = {
            status: 'status', carrier: 'carrier', plan: 'plan'
          }

          for (const [key, dbField] of Object.entries(fieldMappings)) {
            if (changes[key] !== undefined) {
              paramCount++
              updateFields.push(`${dbField} = $${paramCount}`)
              values.push(changes[key])
            }
          }

          if (updateFields.length > 0) {
            paramCount++
            updateFields.push(`updated_at = $${paramCount}`)
            values.push(new Date().toISOString())

            paramCount++
            values.push(action.resource_id)

            const updateQuery = `
              UPDATE ${SCHEMA}sim_cards
              SET ${updateFields.join(', ')}
              WHERE id = $${paramCount}
              RETURNING *
            `
            result = await pool.query(updateQuery, values)
          }
        }
      }

      // Mark action as executed
      await pool.query(`
        UPDATE ${SCHEMA}pending_actions
        SET status = 'executed', executed_at = NOW(), execution_result = $2
        WHERE id = $1
      `, [actionId, JSON.stringify(result?.rows?.[0] || {})])

      // Log execution
      await pool.query(`
        INSERT INTO ${SCHEMA}llm_audit_log
        (user_id, user_role, action_type, request_message, response_message)
        VALUES ($1, $2, 'action_executed', $3, $4)
      `, [username, role, `Executed action: ${action.description}`, JSON.stringify(result?.rows?.[0] || {})])

      res.json({
        success: true,
        message: 'Action executed successfully',
        result: result?.rows?.[0] ? toCamelCase(result.rows[0]) : null
      })
    } catch (execError) {
      // Mark action as failed
      await pool.query(`
        UPDATE ${SCHEMA}pending_actions
        SET status = 'rejected', execution_result = $2
        WHERE id = $1
      `, [actionId, JSON.stringify({ error: execError.message })])

      throw execError
    }
  } catch (error) {
    console.error('LLM execute error:', error)
    res.status(500).json({ success: false, error: 'Failed to execute action: ' + error.message })
  }
})

// GET /api/llm/pending-actions - Get user's pending actions
app.get('/api/llm/pending-actions', async (req, res) => {
  try {
    const { user_id } = req.query

    if (!user_id) {
      return res.status(400).json({ success: false, error: 'user_id is required' })
    }

    // Expire old actions first
    await pool.query(`SELECT ${SCHEMA}expire_pending_actions()`)

    const result = await pool.query(`
      SELECT * FROM ${SCHEMA}pending_actions
      WHERE user_id = $1 AND status = 'pending'
      ORDER BY created_at DESC
    `, [user_id])

    res.json({ success: true, data: toCamelCase(result.rows) })
  } catch (error) {
    console.error('Error fetching pending actions:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// Start MQTT Bridge as child process
function startMqttBridge() {
  const mqttBridgePath = join(__dirname, '..', 'services', 'mqtt-bridge', 'index.js')

  console.log('\n[MQTT Bridge] Starting MQTT Bridge service...')

  // Build environment - our values must override .env file values
  const bridgeEnv = { ...process.env }
  bridgeEnv.DB_PORT = '5434'
  bridgeEnv.WEBSOCKET_PORT = '3003'
  // Use local network MQTT broker, not Docker hostname
  bridgeEnv.MQTT_BROKER_URL = 'mqtt://localhost:1883'

  mqttBridgeProcess = spawn('node', [mqttBridgePath], {
    env: bridgeEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: join(__dirname, '..', 'services', 'mqtt-bridge')
  })

  mqttBridgeProcess.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n')
    lines.forEach(line => {
      if (line.trim()) console.log(`[MQTT Bridge] ${line}`)
    })
  })

  mqttBridgeProcess.stderr.on('data', (data) => {
    console.error(`[MQTT Bridge ERROR] ${data.toString().trim()}`)
  })

  mqttBridgeProcess.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.log(`[MQTT Bridge] Process exited with code ${code}`)
    }
    mqttBridgeProcess = null
  })

  mqttBridgeProcess.on('error', (err) => {
    console.error(`[MQTT Bridge] Failed to start: ${err.message}`)
    mqttBridgeProcess = null
  })
}

// Stop MQTT Bridge
function stopMqttBridge() {
  if (mqttBridgeProcess) {
    console.log('\n[MQTT Bridge] Stopping MQTT Bridge service...')
    mqttBridgeProcess.kill('SIGTERM')
    mqttBridgeProcess = null
  }
}

// Graceful shutdown handler
function gracefulShutdown(signal) {
  console.log(`\n[Server] Received ${signal}, shutting down gracefully...`)

  stopMqttBridge()

  pool.end(() => {
    console.log('[Server] Database pool closed')
    process.exit(0)
  })

  // Force exit after 5 seconds if graceful shutdown fails
  setTimeout(() => {
    console.log('[Server] Forcing shutdown...')
    process.exit(1)
  }, 5000)
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

app.listen(PORT, () => {
  console.log(`Local API server running at http://localhost:${PORT}`)
  console.log('Endpoints:')
  console.log('  GET  /api/devices')
  console.log('  GET  /api/simcards')
  console.log('  GET  /api/device-location-history?device_id=DEV003')
  console.log('  POST /api/auth')
  console.log('  GET  /api/health')
  console.log('  POST /api/llm/chat')
  console.log('  POST /api/llm/execute')
  console.log('  POST /api/llm/chart')
  console.log('  GET  /api/llm/pending-actions')
  console.log('')
  console.log('Consumption Dashboard API:')
  console.log('  GET  /api/consumption/kpis')
  console.log('  GET  /api/consumption/trends')
  console.log('  GET  /api/consumption/carriers')
  console.log('  GET  /api/consumption/regional')
  console.log('  GET  /api/consumption/invoices')
  console.log('')
  console.log('Provisioning API v1:')
  console.log('  GET    /api/v1/health')
  console.log('  POST   /api/v1/sims')
  console.log('  GET    /api/v1/sims')
  console.log('  GET    /api/v1/sims/:simId')
  console.log('  PATCH  /api/v1/sims/:simId')
  console.log('  POST   /api/v1/sims/:simId/activate')
  console.log('  POST   /api/v1/sims/:simId/deactivate')
  console.log('  POST   /api/v1/sims/:simId/block')
  console.log('  POST   /api/v1/sims/:simId/unblock')
  console.log('  GET    /api/v1/sims/:simId/usage')
  console.log('  POST   /api/v1/webhooks')
  console.log('  GET    /api/v1/webhooks')
  console.log('  GET    /api/v1/webhooks/:webhookId')
  console.log('  DELETE /api/v1/webhooks/:webhookId')
  console.log('  POST   /api/v1/usage')
  console.log('  POST   /api/v1/usage/batch')
  console.log('  POST   /api/v1/usage/reset')

  // Start MQTT Bridge after API server is ready
  startMqttBridge()
})
