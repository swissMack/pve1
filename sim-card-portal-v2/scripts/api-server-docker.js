/**
 * Docker API server for SIM Card Portal
 * Reads database connection from environment variables
 */

import express from 'express'
import cors from 'cors'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { createHash, randomBytes } from 'crypto'

const { Pool } = pg

// Initialize Anthropic client (reads ANTHROPIC_API_KEY from env)
let anthropic = null
if (process.env.ANTHROPIC_API_KEY) {
  anthropic = new Anthropic()
  console.log('Anthropic client initialized')
}

// Supabase client setup
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
let supabase = null

if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  console.log('Supabase client initialized for:', supabaseUrl)
}

function isSupabaseConfigured() {
  return supabase !== null
}

const app = express()
const PORT = process.env.PORT || 3001

// Schema prefix - empty for Supabase (public schema), "sim-card-portal-v2". for local dev
// Set USE_PUBLIC_SCHEMA=true to use public schema (Supabase mode)
const usePublicSchema = process.env.USE_PUBLIC_SCHEMA === 'true' || isSupabaseConfigured()
const SCHEMA = usePublicSchema ? '' : '"sim-card-portal-v2".'

// PostgreSQL connection pool using environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Fallback to individual env vars if DATABASE_URL not set
  user: process.env.DATABASE_URL ? undefined : (process.env.DB_USER || 'simportal'),
  password: process.env.DATABASE_URL ? undefined : process.env.DB_PASSWORD,
  host: process.env.DATABASE_URL ? undefined : (process.env.DB_HOST || 'localhost'),
  port: process.env.DATABASE_URL ? undefined : parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DATABASE_URL ? undefined : (process.env.DB_NAME || 'simcardportal'),
  // Connection pool settings
  max: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
})

// ============================================================================
// USAGE DATA AGGREGATION JOB
// Syncs usage_records -> daily_usage every 5 minutes
// ============================================================================
async function runUsageAggregation() {
  try {
    const result = await pool.query(`SELECT ${SCHEMA}aggregate_usage_to_daily() as rows_affected`)
    const rowsAffected = result.rows[0]?.rows_affected || 0
    console.log(`[Aggregation] Synced ${rowsAffected} rows from usage_records to daily_usage`)
    return rowsAffected
  } catch (error) {
    console.error('[Aggregation] Error running usage aggregation:', error.message)
    return 0
  }
}

// Run aggregation on startup (after 10 second delay to let DB initialize)
setTimeout(async () => {
  console.log('[Aggregation] Running initial sync...')
  await runUsageAggregation()
}, 10000)

// Schedule aggregation every 5 minutes (300000ms)
setInterval(async () => {
  await runUsageAggregation()
}, 5 * 60 * 1000)

// Middleware
app.use(cors())
app.use(express.json({ limit: '50mb' }))  // Increased for batch usage submissions

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

    if (id) {
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

    // Look up device_type_id from name if deviceType is provided as a name
    if (updates.deviceType && typeof updates.deviceType === 'string' && !updates.deviceType.startsWith('DT')) {
      const dtResult = await pool.query(
        `SELECT id FROM ${SCHEMA}device_types WHERE name = $1`,
        [updates.deviceType]
      )
      if (dtResult.rows.length > 0) {
        updates.deviceType = dtResult.rows[0].id
      } else {
        // If device type not found, set to null to avoid FK violation
        updates.deviceType = null
      }
    }

    // Look up location_id from name if location is provided as a name
    if (updates.location && typeof updates.location === 'string' && !updates.location.startsWith('LOC')) {
      const locResult = await pool.query(
        `SELECT id FROM ${SCHEMA}locations WHERE name = $1`,
        [updates.location]
      )
      if (locResult.rows.length > 0) {
        updates.location = locResult.rows[0].id
      } else {
        // If location not found, set to null
        updates.location = null
      }
    }

    const updateFields = []
    const values = []
    let paramCount = 0

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
        updateFields.push(snakeKey + ' = $' + paramCount)
        // Convert connectionType and status to lowercase for database constraints
        let value = updates[camelKey]
        if ((camelKey === 'connectionType' || camelKey === 'status') && typeof value === 'string') {
          value = value.toLowerCase()
        }
        values.push(value)
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' })
    }

    paramCount++
    updateFields.push('updated_at = $' + paramCount)
    values.push(new Date().toISOString())

    paramCount++
    values.push(id)

    const query = 'UPDATE ' + SCHEMA + 'devices SET ' + updateFields.join(', ') + ' WHERE id = $' + paramCount + ' RETURNING *'

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

    // Helper to format bytes as human readable
    const formatBytes = (bytes) => {
      if (!bytes || bytes === 0) return '0 MB'
      const gb = bytes / (1024 * 1024 * 1024)
      if (gb >= 1) return gb.toFixed(2) + ' GB'
      const mb = bytes / (1024 * 1024)
      return mb.toFixed(2) + ' MB'
    }

    // Helper to transform row to expected format
    const transformSimCard = (row) => ({
      id: row.id,
      iccid: row.iccid,
      imsi: row.imsi,
      msisdn: row.msisdn,
      status: row.status,
      carrier: row.carrier_name || 'Unknown',
      carrierId: row.carrier_id,
      plan: row.plan_name || 'Unknown',
      planId: row.plan_id,
      dataUsed: formatBytes(parseInt(row.data_usage_bytes) || 0),
      dataLimit: formatBytes(parseInt(row.data_limit_bytes) || 0),
      dataUsageBytes: row.data_usage_bytes,
      dataLimitBytes: row.data_limit_bytes,
      activationDate: row.activation_date,
      expiryDate: row.expiry_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })

    if (id) {
      const result = await pool.query(`
        SELECT s.*, c.name as carrier_name, p.name as plan_name
        FROM ${SCHEMA}sim_cards s
        LEFT JOIN ${SCHEMA}carriers c ON s.carrier_id = c.id
        LEFT JOIN ${SCHEMA}plans p ON s.plan_id = p.id
        WHERE s.id = $1
      `, [id])

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'SIM card not found' })
      }

      return res.json({ success: true, data: transformSimCard(result.rows[0]) })
    }

    const result = await pool.query(`
      SELECT s.*, c.name as carrier_name, p.name as plan_name
      FROM ${SCHEMA}sim_cards s
      LEFT JOIN ${SCHEMA}carriers c ON s.carrier_id = c.id
      LEFT JOIN ${SCHEMA}plans p ON s.plan_id = p.id
      ORDER BY s.id
    `)

    res.json({ success: true, data: result.rows.map(transformSimCard) })
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

    const updateFields = []
    const values = []
    let paramCount = 0

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

    for (const [camelKey, snakeKey] of Object.entries(fieldMappings)) {
      if (updates[camelKey] !== undefined) {
        paramCount++
        updateFields.push(`${snakeKey} = $${paramCount}`)
        if (camelKey === 'status' && typeof updates[camelKey] === 'string') { values.push(updates[camelKey].toUpperCase()) } else { values.push(updates[camelKey]) }
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' })
    }

    paramCount++
    updateFields.push(`updated_at = $${paramCount}`)
    values.push(new Date().toISOString())

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

// GET /api/device-location-history
app.get('/api/device-location-history', async (req, res) => {
  try {
    const { device_id, start_date, end_date, limit = '1000' } = req.query

    if (!device_id) {
      return res.status(400).json({ success: false, error: 'device_id is required' })
    }

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

    let query = 'SELECT * FROM ' + SCHEMA + 'device_sensor_history WHERE device_id = $1'
    const params = [device_id]
    let paramCount = 1

    if (start_date) {
      paramCount++
      query += ' AND recorded_at >= $' + paramCount
      params.push(start_date)
    }

    if (end_date) {
      paramCount++
      query += ' AND recorded_at <= $' + paramCount
      params.push(end_date)
    }

    query += ' ORDER BY recorded_at ASC LIMIT ' + parseInt(limit)

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

// POST /api/auth
app.post('/api/auth', async (req, res) => {
  const { username, password, action } = req.body

  if (action === 'login') {
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

// ============================================================================
// MEDIATION / USAGE ENDPOINTS
// ============================================================================

// POST /api/v1/usage - Submit single usage record (Mediation API)
app.post('/api/v1/usage', async (req, res) => {
  try {
    const { iccid, periodStart, periodEnd, usage, source, recordId } = req.body

    // Validate required fields
    if (!iccid || !usage || !usage.totalBytes) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'iccid and usage.totalBytes are required'
        }
      })
    }

    // Generate recordId if not provided
    const usageRecordId = recordId || 'CDR-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)

    // Check for duplicate record
    const existing = await pool.query(
      'SELECT id, processed_at FROM ' + SCHEMA + 'usage_records WHERE record_id = $1',
      [usageRecordId]
    )

    if (existing.rows.length > 0) {
      return res.status(202).json({
        recordId: usageRecordId,
        status: 'DUPLICATE',
        processedAt: existing.rows[0].processed_at
      })
    }

    // Get SIM by ICCID from provisioned_sims
    const simResult = await pool.query(
      'SELECT sim_id FROM ' + SCHEMA + 'provisioned_sims WHERE iccid = $1',
      [iccid]
    )
    const simId = simResult.rows[0]?.sim_id || null

    // Insert usage record
    const result = await pool.query(
      'INSERT INTO ' + SCHEMA + 'usage_records ' +
      '(record_id, iccid, sim_id, period_start, period_end, ' +
      'data_upload_bytes, data_download_bytes, total_bytes, sms_count, voice_seconds, ' +
      'source, status) ' +
      'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ' +
      'RETURNING processed_at',
      [
        usageRecordId,
        iccid,
        simId,
        periodStart || new Date().toISOString(),
        periodEnd || new Date().toISOString(),
        usage.dataUploadBytes || 0,
        usage.dataDownloadBytes || 0,
        usage.totalBytes,
        usage.smsCount || 0,
        usage.voiceSeconds || 0,
        source || 'API',
        'PROCESSED'
      ]
    )

    // Accumulate to current usage cycle if SIM exists
    if (simId) {
      const now = new Date()
      const cycleId = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
      const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

      // Upsert usage cycle
      await pool.query(
        'INSERT INTO ' + SCHEMA + 'usage_cycles ' +
        '(sim_id, iccid, cycle_id, cycle_start, cycle_end, ' +
        'total_upload_bytes, total_download_bytes, total_bytes, sms_count, voice_seconds, is_current) ' +
        'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true) ' +
        'ON CONFLICT (sim_id, cycle_id) DO UPDATE SET ' +
        'total_upload_bytes = ' + SCHEMA + 'usage_cycles.total_upload_bytes + $6, ' +
        'total_download_bytes = ' + SCHEMA + 'usage_cycles.total_download_bytes + $7, ' +
        'total_bytes = ' + SCHEMA + 'usage_cycles.total_bytes + $8, ' +
        'sms_count = ' + SCHEMA + 'usage_cycles.sms_count + $9, ' +
        'voice_seconds = ' + SCHEMA + 'usage_cycles.voice_seconds + $10, ' +
        'last_updated = NOW()',
        [
          simId,
          iccid,
          cycleId,
          cycleStart.toISOString(),
          cycleEnd.toISOString(),
          usage.dataUploadBytes || 0,
          usage.dataDownloadBytes || 0,
          usage.totalBytes,
          usage.smsCount || 0,
          usage.voiceSeconds || 0
        ]
      )
    }

    console.log('Mediation: Recorded usage for ICCID', iccid, '- Total bytes:', usage.totalBytes)

    res.status(202).json({
      recordId: usageRecordId,
      status: 'ACCEPTED',
      processedAt: result.rows[0].processed_at
    })
  } catch (error) {
    console.error('Error submitting usage record:', error)
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process usage record: ' + error.message
      }
    })
  }
})

// POST /api/v1/usage/batch - Submit batch of usage records
app.post('/api/v1/usage/batch', async (req, res) => {
  try {
    const { batchId, source, records } = req.body

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'records array is required and must not be empty'
        }
      })
    }

    const processedAt = new Date().toISOString()
    let recordsProcessed = 0
    let recordsFailed = 0
    const errors = []

    for (const record of records) {
      try {
        const usageRecordId = record.recordId || 'CDR-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)

        // Check for duplicate
        const existing = await pool.query(
          'SELECT id FROM ' + SCHEMA + 'usage_records WHERE record_id = $1',
          [usageRecordId]
        )

        if (existing.rows.length > 0) {
          recordsProcessed++
          continue // Duplicate - count as processed (idempotent)
        }

        // Get SIM by ICCID
        const simResult = await pool.query(
          'SELECT sim_id FROM ' + SCHEMA + 'provisioned_sims WHERE iccid = $1',
          [record.iccid]
        )
        const simId = simResult.rows[0]?.sim_id || null

        // Insert record
        await pool.query(
          'INSERT INTO ' + SCHEMA + 'usage_records ' +
          '(record_id, iccid, sim_id, period_start, period_end, ' +
          'data_upload_bytes, data_download_bytes, total_bytes, sms_count, voice_seconds, ' +
          'source, batch_id, status) ' +
          'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)',
          [
            usageRecordId,
            record.iccid,
            simId,
            record.periodStart || new Date().toISOString(),
            record.periodEnd || new Date().toISOString(),
            record.usage?.dataUploadBytes || 0,
            record.usage?.dataDownloadBytes || 0,
            record.usage?.totalBytes || 0,
            record.usage?.smsCount || 0,
            record.usage?.voiceSeconds || 0,
            record.source || source || 'API',
            batchId,
            'PROCESSED'
          ]
        )

        // Accumulate usage if SIM exists
        if (simId && record.usage?.totalBytes) {
          const now = new Date()
          const cycleId = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
          const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1)
          const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

          await pool.query(
            'INSERT INTO ' + SCHEMA + 'usage_cycles ' +
            '(sim_id, iccid, cycle_id, cycle_start, cycle_end, ' +
            'total_upload_bytes, total_download_bytes, total_bytes, sms_count, voice_seconds, is_current) ' +
            'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true) ' +
            'ON CONFLICT (sim_id, cycle_id) DO UPDATE SET ' +
            'total_upload_bytes = ' + SCHEMA + 'usage_cycles.total_upload_bytes + $6, ' +
            'total_download_bytes = ' + SCHEMA + 'usage_cycles.total_download_bytes + $7, ' +
            'total_bytes = ' + SCHEMA + 'usage_cycles.total_bytes + $8, ' +
            'sms_count = ' + SCHEMA + 'usage_cycles.sms_count + $9, ' +
            'voice_seconds = ' + SCHEMA + 'usage_cycles.voice_seconds + $10, ' +
            'last_updated = NOW()',
            [
              simId,
              record.iccid,
              cycleId,
              cycleStart.toISOString(),
              cycleEnd.toISOString(),
              record.usage.dataUploadBytes || 0,
              record.usage.dataDownloadBytes || 0,
              record.usage.totalBytes,
              record.usage.smsCount || 0,
              record.usage.voiceSeconds || 0
            ]
          )
        }

        recordsProcessed++
      } catch (error) {
        recordsFailed++
        errors.push({ recordId: record.recordId, error: error.message })
        if (errors.length >= 100) break // Limit error collection
      }
    }

    console.log('Mediation batch: Processed', recordsProcessed, 'records,', recordsFailed, 'failed')

    res.status(202).json({
      batchId: batchId || 'BATCH-' + Date.now(),
      recordsReceived: records.length,
      recordsProcessed,
      recordsFailed,
      errors: errors.length > 0 ? errors : undefined,
      processedAt
    })
  } catch (error) {
    console.error('Error processing usage batch:', error)
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process usage batch: ' + error.message
      }
    })
  }
})

// GET /api/v1/provisioned-sims - Get list of provisioned SIMs for mediation
app.get("/api/v1/provisioned-sims", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT sim_id, iccid, msisdn, status FROM " + SCHEMA + "provisioned_sims ORDER BY iccid"
    )
    res.json({
      success: true,
      data: result.rows.map(row => ({
        simId: row.sim_id,
        iccid: row.iccid,
        msisdn: row.msisdn,
        status: row.status
      }))
    })
  } catch (error) {
    console.error("Error fetching provisioned SIMs:", error)
    res.status(500).json({ success: false, error: "Database error" })
  }
})

// GET /api/v1/health - Provisioning API health check
app.get('/api/v1/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'healthy', timestamp: new Date().toISOString() })
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', timestamp: new Date().toISOString() })
  }
})

// ============================================================================
// CONSUMPTION ENDPOINTS
// ============================================================================

// GET /api/consumption/kpis - Get consumption KPIs
app.get('/api/consumption/kpis', async (req, res) => {
  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfMonthStr = startOfMonth.toISOString().split('T')[0]

    // Get current month usage from usage_records (actual CDR data)
    const usageResult = await pool.query(
      'SELECT COALESCE(SUM(total_bytes), 0) as total_bytes, ' +
      'COALESCE(SUM(data_upload_bytes), 0) as upload_bytes, ' +
      'COALESCE(SUM(data_download_bytes), 0) as download_bytes, ' +
      'COUNT(DISTINCT iccid) as unique_iccids ' +
      'FROM ' + SCHEMA + 'usage_records WHERE period_start >= $1',
      [startOfMonthStr]
    )

    // Get active SIM count (case-insensitive status match)
    const simResult = await pool.query(
      'SELECT COUNT(*) as count FROM ' + SCHEMA + 'sim_cards WHERE UPPER(status) = $1',
      ['ACTIVE']
    )

    const totalBytes = parseFloat(usageResult.rows[0]?.total_bytes) || 0
    const activeSims = parseInt(simResult.rows[0]?.count) || 0
    const avgDataPerSim = activeSims > 0 ? totalBytes / activeSims : 0

    // Estimate cost at $0.01 per MB
    const totalCost = totalBytes / (1024 * 1024) * 0.01

    const kpis = {
      totalSpend: {
        value: totalCost,
        trend: 5.2,
        currency: 'USD'
      },
      dataUsage: {
        value: totalBytes,
        valueGB: totalBytes / (1024 * 1024 * 1024),
        trend: 12.3
      },
      activeSims: {
        value: activeSims,
        trend: 2.1
      },
      avgDataPerSim: {
        value: avgDataPerSim,
        valueGB: avgDataPerSim / (1024 * 1024 * 1024),
        trend: 0
      },
      estimatedCost: {
        value: totalCost * 1.1,
        trend: 0,
        currency: 'USD'
      }
    }

    res.json({ success: true, data: kpis, period: { start: startOfMonth.toISOString(), end: now.toISOString() } })
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

    // For hourly view, query usage_records directly for real-time MQTT data
    if (granularity === 'hourly') {
      const hourlyResult = await pool.query(`
        SELECT
          date_trunc('hour', period_start) as hour,
          SUM(total_bytes) as total_data_bytes,
          COUNT(DISTINCT iccid) as sim_count
        FROM ${SCHEMA}usage_records
        WHERE period_start >= NOW() - INTERVAL '24 hours'
        GROUP BY date_trunc('hour', period_start)
        ORDER BY hour
      `)

      // Create a map of hour -> data
      const hourlyData = {}
      hourlyResult.rows.forEach(row => {
        const hourKey = new Date(row.hour).toISOString()
        hourlyData[hourKey] = {
          dataUsageGB: parseFloat(row.total_data_bytes || 0) / (1024 * 1024 * 1024),
          cost: (parseFloat(row.total_data_bytes || 0) / (1024 * 1024)) * 0.01, // Estimate cost
          simCount: parseInt(row.sim_count || 0)
        }
      })

      // Generate 24 hourly data points
      const trends = []
      for (let i = 0; i < 24; i++) {
        const hourTime = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000)
        hourTime.setMinutes(0, 0, 0) // Round to hour
        const hourKey = hourTime.toISOString()
        const hourLabel = `${String(hourTime.getHours()).padStart(2, '0')}:00`

        const data = hourlyData[hourKey] || { dataUsageGB: 0, cost: 0, simCount: 0 }
        trends.push({
          period: hourLabel,
          dataUsageGB: data.dataUsageGB,
          cost: data.cost,
          simCount: data.simCount
        })
      }

      return res.json({ success: true, data: trends, granularity, currency: 'CHF' })
    }

    // For daily/weekly/monthly, use daily_usage table
    let groupByClause
    let periodSelect

    if (granularity === 'daily') {
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

    // Query the daily_usage table
    const result = await pool.query(`
      SELECT
        ${periodSelect},
        SUM(data_bytes) as total_data_bytes,
        SUM(cost) as total_cost,
        MAX(active_sim_count) as active_sim_count
      FROM ${SCHEMA}daily_usage
      WHERE usage_date >= $1 AND usage_date <= $2
      GROUP BY ${groupByClause}
      ORDER BY ${granularity === 'weekly' ? groupByClause : 'period'}
    `, [startDate, endDate])

    let trends = result.rows.map(row => ({
      period: String(row.period),
      dataUsageGB: parseFloat(row.total_data_bytes || 0) / (1024 * 1024 * 1024),
      cost: parseFloat(row.total_cost || 0),
      simCount: parseInt(row.active_sim_count || 0)
    }))

    res.json({ success: true, data: trends, granularity, currency: 'CHF' })
  } catch (error) {
    console.error('Error fetching consumption trends:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// GET /api/consumption/carriers - Get carrier breakdown
app.get('/api/consumption/carriers', async (req, res) => {
  try {
    // Get carrier data by joining sim_cards with carriers table
    const result = await pool.query(
      "SELECT c.name as carrier, COUNT(*) as sim_count, " +
      "COALESCE(SUM(CASE WHEN s.data_used ~ '^[0-9.]+' THEN REGEXP_REPLACE(s.data_used, '[^0-9.]', '', 'g')::NUMERIC ELSE 0 END), 0) as total_data " +
      "FROM " + SCHEMA + "sim_cards s " +
      "LEFT JOIN " + SCHEMA + "carriers c ON s.carrier_id = c.id " +
      "WHERE c.name IS NOT NULL " +
      "GROUP BY c.name ORDER BY sim_count DESC"
    )

    const totalData = result.rows.reduce((sum, row) => sum + parseFloat(row.total_data), 0)

    const totalSims = result.rows.reduce((sum, row) => sum + parseInt(row.sim_count), 0)

    const carriers = result.rows.map(row => {
      const dataBytes = parseFloat(row.total_data) || 0
      const simCount = parseInt(row.sim_count) || 0
      return {
        id: row.carrier.toLowerCase().replace(/\s+/g, '-'),
        name: row.carrier,
        simCount: simCount,
        simPercentage: totalSims > 0 ? (simCount / totalSims * 100) : 0,
        dataUsageGB: dataBytes / (1024 * 1024 * 1024),
        cost: (dataBytes / (1024 * 1024)) * 0.01,
        costPercentage: totalData > 0 ? (dataBytes / totalData * 100) : 0,
        dataPercentage: totalData > 0 ? (dataBytes / totalData * 100) : 0
      }
    })

    res.json({ success: true, data: carriers })
  } catch (error) {
    console.error('Error fetching carrier breakdown:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// GET /api/consumption/regional - Get regional usage data
app.get('/api/consumption/regional', async (req, res) => {
  try {
    // Get device locations with data usage
    const result = await pool.query(
      'SELECT d.id, d.name, d.latitude, d.longitude, ' +
      'COALESCE(d.data_usage_mb, 0) as data_usage_mb, ' +
      'l.name as location_name ' +
      'FROM ' + SCHEMA + 'devices d ' +
      'LEFT JOIN ' + SCHEMA + 'locations l ON d.location_id = l.id ' +
      'WHERE d.latitude IS NOT NULL AND d.longitude IS NOT NULL'
    )

    const regional = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      dataUsageMB: parseFloat(row.data_usage_mb) || 0,
      locationName: row.location_name || 'Unknown'
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
    const { status, page = 1, limit = 10 } = req.query
    const now = new Date()

    // Generate sample invoices based on usage_cycles
    const invoices = []
    for (let i = 0; i < 6; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const cycleId = monthDate.getFullYear() + '-' + String(monthDate.getMonth() + 1).padStart(2, '0')

      const result = await pool.query(
        'SELECT COALESCE(SUM(total_bytes), 0) as total_bytes FROM ' + SCHEMA + 'usage_cycles WHERE cycle_id = $1',
        [cycleId]
      )

      const totalBytes = parseFloat(result.rows[0]?.total_bytes) || 0
      const amount = (totalBytes / (1024 * 1024)) * 0.01

      const invoiceStatus = i === 0 ? 'pending' : (i === 1 && status === 'pending' ? 'pending' : 'paid')

      if (!status || status === invoiceStatus) {
        invoices.push({
          id: 'inv_' + cycleId.replace('-', ''),
          invoiceNumber: 'INV-' + cycleId.replace('-', '-') + '-001',
          carrierId: 'default',
          carrierName: 'Default Carrier',
          periodStart: monthDate.toISOString().split('T')[0],
          periodEnd: new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).toISOString().split('T')[0],
          totalAmount: amount,
          currency: 'USD',
          status: invoiceStatus,
          dueDate: new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 15).toISOString().split('T')[0],
          paidDate: invoiceStatus === 'paid' ? new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 10).toISOString().split('T')[0] : null
        })
      }
    }

    const offset = (parseInt(page) - 1) * parseInt(limit)
    const paginatedInvoices = invoices.slice(offset, offset + parseInt(limit))

    res.json({
      success: true,
      data: paginatedInvoices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: invoices.length,
        totalPages: Math.ceil(invoices.length / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Error fetching invoices:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// GET /api/settings/currency - Get display currency
// Uses PostgreSQL pool directly (connects to Supabase PostgreSQL)
app.get("/api/settings/currency", async (req, res) => {
  try {
    let currency = "EUR"
    const result = await pool.query(
      "SELECT value FROM " + SCHEMA + "app_settings WHERE key = $1",
      ["display_currency"]
    )
    if (result.rows.length > 0 && result.rows[0].value) {
      currency = String(result.rows[0].value).replace(/\"/g, "")
    }
    res.json({ success: true, currency })
  } catch (error) {
    console.error("Error getting currency:", error)
    res.json({ success: true, currency: "EUR" })
  }
})

// POST /api/settings/currency - Set display currency
// Uses PostgreSQL pool directly (connects to Supabase PostgreSQL)
app.post("/api/settings/currency", async (req, res) => {
  try {
    const { currency } = req.body
    if (!currency) {
      return res.status(400).json({ success: false, error: "Currency is required" })
    }

    await pool.query(
      "INSERT INTO " + SCHEMA + "app_settings (key, value, updated_at) VALUES ($1, $2, NOW()) " +
      "ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()",
      ["display_currency", JSON.stringify(currency)]
    )
    res.json({ success: true, currency })
  } catch (error) {
    console.error("Error setting currency:", error)
    res.status(500).json({ success: false, error: "Failed to save currency" })
  }
})

// GET /api/settings/llm - Get LLM configuration
app.get("/api/settings/llm", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT key, value FROM " + SCHEMA + "app_settings WHERE key IN ('llm_api_key', 'llm_provider', 'llm_enabled')"
    )

    const settings = {}
    for (const row of result.rows) {
      // JSONB values from PostgreSQL are already parsed by pg driver
      settings[row.key] = row.value
    }

    // Mask the API key if present
    let maskedKey = null
    if (settings.llm_api_key) {
      const key = settings.llm_api_key
      if (key.length > 8) {
        maskedKey = key.slice(0, 7) + '*'.repeat(Math.min(20, key.length - 11)) + key.slice(-4)
      } else {
        maskedKey = '*'.repeat(key.length)
      }
    }

    res.json({
      success: true,
      data: {
        hasApiKey: !!settings.llm_api_key,
        maskedKey,
        provider: settings.llm_provider || 'Anthropic',
        enabled: settings.llm_enabled || false
      }
    })
  } catch (error) {
    console.error("Error getting LLM settings:", error)
    res.json({
      success: true,
      data: { hasApiKey: false, maskedKey: null, provider: 'Anthropic', enabled: false }
    })
  }
})

// POST /api/settings/llm - Save LLM configuration (API key)
app.post("/api/settings/llm", async (req, res) => {
  try {
    const { apiKey, provider = 'Anthropic', enabled } = req.body

    if (apiKey !== undefined) {
      // Save API key
      await pool.query(
        "INSERT INTO " + SCHEMA + "app_settings (key, value, updated_at) VALUES ($1, $2, NOW()) " +
        "ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()",
        ["llm_api_key", JSON.stringify(apiKey)]
      )

      // Update the in-memory Anthropic client
      if (apiKey && apiKey.startsWith('sk-ant-')) {
        try {
          const Anthropic = (await import('@anthropic-ai/sdk')).default
          anthropic = new Anthropic({ apiKey })
          console.log('Anthropic client updated with new API key')
        } catch (e) {
          console.error('Failed to update Anthropic client:', e.message)
        }
      }
    }

    if (provider !== undefined) {
      await pool.query(
        "INSERT INTO " + SCHEMA + "app_settings (key, value, updated_at) VALUES ($1, $2, NOW()) " +
        "ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()",
        ["llm_provider", JSON.stringify(provider)]
      )
    }

    if (enabled !== undefined) {
      await pool.query(
        "INSERT INTO " + SCHEMA + "app_settings (key, value, updated_at) VALUES ($1, $2, NOW()) " +
        "ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()",
        ["llm_enabled", JSON.stringify(enabled)]
      )
    }

    res.json({ success: true, message: "LLM settings saved" })
  } catch (error) {
    console.error("Error saving LLM settings:", error)
    res.status(500).json({ success: false, error: "Failed to save LLM settings" })
  }
})

// DELETE /api/settings/llm - Delete LLM API key
app.delete("/api/settings/llm", async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM " + SCHEMA + "app_settings WHERE key = 'llm_api_key'"
    )
    anthropic = null
    res.json({ success: true, message: "API key deleted" })
  } catch (error) {
    console.error("Error deleting LLM API key:", error)
    res.status(500).json({ success: false, error: "Failed to delete API key" })
  }
})

// GET /api/consumption/usage-details - Get detailed usage records per IMSI
app.get('/api/consumption/usage-details', async (req, res) => {
  try {
    const { start_date, end_date, granularity = 'monthly' } = req.query

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'start_date and end_date are required'
      })
    }

    // Query usage records grouped by ICCID/IMSI
    // Use period_start for filtering (period_end can extend beyond end_date)
    const result = await pool.query(`
      SELECT
        iccid,
        SUM(total_bytes) as total_bytes,
        COUNT(*) as record_count,
        MAX(period_start) as latest_event_at
      FROM ${SCHEMA}usage_records
      WHERE period_start >= $1 AND period_start < ($2::date + INTERVAL '1 day')
      GROUP BY iccid
      ORDER BY total_bytes DESC
    `, [start_date, end_date])

    const data = result.rows.map(row => ({
      imsi: row.iccid,
      mccmnc: 'Unknown',
      bytes: parseInt(row.total_bytes) || 0,
      ...(granularity === 'daily' || granularity === '24h'
        ? { day: start_date }
        : granularity === 'monthly'
          ? { month: start_date.substring(0, 7) }
          : { year: start_date.substring(0, 4) }
      ),
      latestEventAt: row.latest_event_at || new Date().toISOString()
    }))

    res.json({ success: true, data, cached: false })
  } catch (error) {
    console.error('Error fetching usage details:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// GET /api/consumption/unique-imsis - Get unique IMSI values for filters
app.get('/api/consumption/unique-imsis', async (req, res) => {
  try {
    // Query unique ICCIDs from usage_records or provisioned_sims
    const result = await pool.query(`
      SELECT DISTINCT iccid as imsi
      FROM ${SCHEMA}usage_records
      WHERE iccid IS NOT NULL
      ORDER BY iccid
    `)

    const data = result.rows.map(row => ({ imsi: row.imsi }))

    res.json({ success: true, data, cached: false })
  } catch (error) {
    console.error('Error fetching unique IMSIs:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

app.get('/api/consumption/carrier-locations', async (req, res) => {
  try {
    // Get devices with their SIM cards and carrier info
    const result = await pool.query(
      'SELECT d.id, d.name, d.latitude, d.longitude, ' +
      'c.name as carrier, s.iccid, s.status as sim_status ' +
      'FROM ' + SCHEMA + 'devices d ' +
      'LEFT JOIN ' + SCHEMA + 'sim_cards s ON d.sim_card_id = s.id ' +
      'LEFT JOIN ' + SCHEMA + 'carriers c ON s.carrier_id = c.id ' +
      'WHERE d.latitude IS NOT NULL AND d.longitude IS NOT NULL ' +
      'AND s.carrier_id IS NOT NULL'
    )

    const locations = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      carrier: row.carrier,
      iccid: row.iccid,
      simStatus: row.sim_status
    }))

    res.json({ success: true, data: locations })
  } catch (error) {
    console.error('Error fetching carrier locations:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// ============================================================================
// LLM / ASK BOB ENDPOINTS
// ============================================================================

// Rate limiting for LLM requests
const llmRateLimits = new Map()
const LLM_RATE_LIMIT = 10 // requests per minute
const LLM_RATE_WINDOW = 60000 // 1 minute in ms

function checkLlmRateLimit(clientId) {
  const now = Date.now()
  const clientData = llmRateLimits.get(clientId) || { count: 0, resetTime: now + LLM_RATE_WINDOW }

  if (now > clientData.resetTime) {
    clientData.count = 0
    clientData.resetTime = now + LLM_RATE_WINDOW
  }

  clientData.count++
  llmRateLimits.set(clientId, clientData)

  return clientData.count <= LLM_RATE_LIMIT
}

// Build system prompt with context
async function buildSystemPrompt(context) {
  const parts = [
    'You are Bob, an AI assistant for a SIM Card Portal system.',
    'You help users understand their IoT device fleet, SIM cards, data consumption, and billing.',
    'Be concise and helpful. If asked about specific data, use the context provided.',
    '',
    'Current context:'
  ]

  if (context?.devices) {
    parts.push(`- Total devices: ${context.devices.length}`)
    const activeDevices = context.devices.filter(d => d.status === 'active' || d.status === 'online').length
    parts.push(`- Active devices: ${activeDevices}`)
  }

  if (context?.simCards) {
    parts.push(`- Total SIM cards: ${context.simCards.length}`)
    const activeSims = context.simCards.filter(s => s.status === 'Active').length
    parts.push(`- Active SIMs: ${activeSims}`)
  }

  if (context?.currentDevice) {
    parts.push(``)
    parts.push(`Currently viewing device: ${context.currentDevice.name} (${context.currentDevice.id})`)
    if (context.currentDevice.temperature) parts.push(`- Temperature: ${context.currentDevice.temperature}°C`)
    if (context.currentDevice.humidity) parts.push(`- Humidity: ${context.currentDevice.humidity}%`)
    if (context.currentDevice.batteryLevel) parts.push(`- Battery: ${context.currentDevice.batteryLevel}%`)
  }

  return parts.join('\n')
}

// POST /api/llm/chat - Main chat endpoint for Ask Bob
app.post('/api/llm/chat', async (req, res) => {
  try {
    // Check if Anthropic is configured
    if (!anthropic) {
      return res.status(503).json({
        success: false,
        error: 'LLM service not configured. Please set ANTHROPIC_API_KEY environment variable.'
      })
    }

    const { messages, context } = req.body
    const clientId = req.ip || 'anonymous'

    // Rate limiting
    if (!checkLlmRateLimit(clientId)) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please wait a moment before trying again.'
      })
    }

    // Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Messages array is required'
      })
    }

    // Build system prompt with context
    const systemPrompt = await buildSystemPrompt(context)

    // Format messages for Anthropic API
    const formattedMessages = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }))

    console.log('[LLM] Chat request:', formattedMessages.length, 'messages')

    // Call Anthropic API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: formattedMessages
    })

    const assistantMessage = response.content[0]?.text || 'I apologize, but I could not generate a response.'

    console.log('[LLM] Response generated:', assistantMessage.substring(0, 100) + '...')

    res.json({
      success: true,
      message: assistantMessage,
      usage: {
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens
      }
    })
  } catch (error) {
    console.error('[LLM] Error:', error.message)

    if (error.status === 401) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key. Please check your Anthropic API key.'
      })
    }

    if (error.status === 429) {
      return res.status(429).json({
        success: false,
        error: 'API rate limit exceeded. Please try again later.'
      })
    }

    res.status(500).json({
      success: false,
      error: 'Failed to generate response: ' + error.message
    })
  }
})

// POST /api/llm/chart - Generate chart configuration from natural language
app.post('/api/llm/chart', async (req, res) => {
  try {
    const { query, dateRange, currency = 'CHF' } = req.body

    if (!query) {
      return res.status(400).json({ success: false, error: 'Query is required' })
    }

    // Check if Anthropic is configured
    if (!anthropic) {
      return res.status(500).json({ success: false, error: 'LLM service not configured. Please set ANTHROPIC_API_KEY.' })
    }

    // Build context with available data
    let dataContext = ''

    try {
      // Get carriers
      const carriersResult = await pool.query(`SELECT id, name FROM ${SCHEMA}carriers`)
      if (carriersResult.rows.length > 0) {
        dataContext += `\nCarriers: ${carriersResult.rows.map(c => c.name).join(', ')}`
      }

      // Get recent usage data
      const usageResult = await pool.query(`
        SELECT usage_date, carrier_id, data_bytes, cost
        FROM ${SCHEMA}daily_usage
        ORDER BY usage_date DESC
        LIMIT 20
      `)

      if (usageResult.rows.length > 0) {
        dataContext += `\n\nRecent usage data (last ${usageResult.rows.length} records):\n`
        usageResult.rows.forEach(a => {
          dataContext += `- ${a.usage_date}: carrier=${a.carrier_id}, data=${(parseFloat(a.data_bytes || 0) / (1024*1024*1024)).toFixed(2)}GB, cost=${a.cost} ${currency}\n`
        })
      }
    } catch (dbErr) {
      console.error('Error fetching chart context data:', dbErr.message)
    }

    const systemPrompt = `You are Bob, a data analyst for SIM card usage analytics.

Available data:${dataContext}

IMPORTANT: All costs should be displayed in ${currency} (the user's configured currency).

Respond with ONLY a valid JSON object. No markdown code blocks, no text before or after the JSON. Your response must be parseable JSON.

For chart visualizations:
{
  "type": "chart",
  "chartType": "bar" | "line" | "pie" | "doughnut",
  "title": "Chart title",
  "data": {
    "labels": ["Label1", "Label2"],
    "datasets": [{
      "label": "Dataset name",
      "data": [10, 20],
      "backgroundColor": ["#137fec", "#10b981"],
      "borderColor": "#137fec"
    }]
  },
  "content": "Your explanation of the data and insights goes here"
}

For tables:
{
  "type": "table",
  "title": "Table title",
  "columns": ["Column1", "Column2"],
  "rows": [["Value1", "Value2"]],
  "content": "Your explanation goes here"
}

For text-only responses:
{
  "type": "text",
  "content": "Your full response here"
}

IMPORTANT: The "content" field should contain your analysis, insights, and explanations. For questions involving strategic decisions, optimization suggestions, complex analysis, cost reduction, carrier comparisons, or deployment recommendations, include this message in the content field:

"For expert guidance on optimizing your IoT deployment, our IoTo consultants can help. Would you like an IoTo representative to reach out to discuss your needs? Press the 'Contact IoTo' button below to initiate the request."

When labeling cost-related data, always use "${currency}" as the currency code.

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

    let responseText = response.content[0].text

    // Try to parse the JSON response
    try {
      // First, try to extract JSON from markdown code blocks if present
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        responseText = jsonMatch[1].trim()
      }

      // Also try to find JSON object if there's text before/after
      if (!responseText.startsWith('{')) {
        const jsonStart = responseText.indexOf('{')
        const jsonEnd = responseText.lastIndexOf('}')
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          responseText = responseText.substring(jsonStart, jsonEnd + 1)
        }
      }

      const chartConfig = JSON.parse(responseText)
      res.json({ success: true, data: chartConfig })
    } catch {
      // If not valid JSON, return as text response
      res.json({
        success: true,
        data: {
          type: 'text',
          content: response.content[0].text
        }
      })
    }
  } catch (error) {
    console.error('Error generating chart:', error)
    if (error.status === 401) {
      return res.status(500).json({ success: false, error: 'API key not configured. Please set ANTHROPIC_API_KEY.' })
    }
    res.status(500).json({ success: false, error: 'Failed to generate chart: ' + error.message })
  }
})

// POST /api/llm/execute - Execute AI-suggested actions (stub for now)
app.post('/api/llm/execute', async (req, res) => {
  res.json({
    success: true,
    result: null,
    message: 'Action execution not yet implemented'
  })
})

// GET /api/llm/pending-actions - Get pending AI actions (stub for now)
app.get('/api/llm/pending-actions', async (req, res) => {
  res.json({
    success: true,
    actions: []
  })
})

// ============================================================================
// API CLIENT MANAGEMENT ENDPOINTS
// ============================================================================

// Generate a random API key with prefix
function generateApiKey() {
  const prefix = 'mqs_'  // mediation query simulator
  const random = randomBytes(24).toString('base64url')
  return prefix + random
}

// Hash API key with SHA256
function hashApiKey(apiKey) {
  return createHash('sha256').update(apiKey).digest('hex')
}

// GET /api/v1/api-clients - List all API clients
app.get('/api/v1/api-clients', async (req, res) => {
  try {
    let clients
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('api_clients')
        .select('id, name, description, api_key_prefix, permissions, is_active, last_used_at, created_at, updated_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      clients = data || []
    } else {
      const result = await pool.query(`
        SELECT id, name, description, api_key_prefix, permissions, is_active, last_used_at, created_at, updated_at
        FROM ${SCHEMA}api_clients
        ORDER BY created_at DESC
      `)
      clients = result.rows
    }

    const formatted = clients.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      apiKeyPrefix: row.api_key_prefix,
      permissions: row.permissions || [],
      isActive: row.is_active,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))

    res.json({ data: formatted })
  } catch (error) {
    console.error('Error listing API clients:', error)
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list API clients' } })
  }
})

// POST /api/v1/api-clients - Create new API client
app.post('/api/v1/api-clients', async (req, res) => {
  try {
    const { name, description, permissions } = req.body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Name is required' } })
    }

    const apiKey = generateApiKey()
    const apiKeyHash = hashApiKey(apiKey)
    const apiKeyPrefix = apiKey.substring(0, 8)
    const defaultPermissions = permissions || ['usage:write', 'usage:read', 'sims:read']

    let client
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('api_clients')
        .insert({
          name: name.trim(),
          description: description?.trim() || null,
          api_key_hash: apiKeyHash,
          api_key_prefix: apiKeyPrefix,
          permissions: defaultPermissions,
          is_active: true
        })
        .select('id, name, description, api_key_prefix, permissions, is_active, last_used_at, created_at, updated_at')
        .single()
      if (error) throw error
      client = data
    } else {
      const result = await pool.query(`
        INSERT INTO ${SCHEMA}api_clients (name, description, api_key_hash, api_key_prefix, permissions, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, name, description, api_key_prefix, permissions, is_active, last_used_at, created_at, updated_at
      `, [name.trim(), description?.trim() || null, apiKeyHash, apiKeyPrefix, JSON.stringify(defaultPermissions), true])
      client = result.rows[0]
    }

    res.status(201).json({
      client: {
        id: client.id,
        name: client.name,
        description: client.description,
        apiKeyPrefix: client.api_key_prefix,
        permissions: client.permissions || [],
        isActive: client.is_active,
        lastUsedAt: client.last_used_at,
        createdAt: client.created_at,
        updatedAt: client.updated_at
      },
      apiKey,
      message: 'API key shown only once. Save it securely!'
    })
  } catch (error) {
    console.error('Error creating API client:', error)
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create API client' } })
  }
})

// POST /api/v1/api-clients/:clientId/toggle - Toggle client status
app.post('/api/v1/api-clients/:clientId/toggle', async (req, res) => {
  try {
    const { clientId } = req.params
    let client

    if (isSupabaseConfigured()) {
      const { data: current } = await supabase
        .from('api_clients')
        .select('is_active')
        .eq('id', clientId)
        .single()
      if (!current) return res.status(404).json({ error: { code: 'CLIENT_NOT_FOUND', message: 'API client not found' } })

      const { data, error } = await supabase
        .from('api_clients')
        .update({ is_active: !current.is_active, updated_at: new Date().toISOString() })
        .eq('id', clientId)
        .select('id, name, description, api_key_prefix, permissions, is_active, last_used_at, created_at, updated_at')
        .single()
      if (error) throw error
      client = data
    } else {
      const currentResult = await pool.query(`SELECT is_active FROM ${SCHEMA}api_clients WHERE id = $1`, [clientId])
      if (currentResult.rows.length === 0) {
        return res.status(404).json({ error: { code: 'CLIENT_NOT_FOUND', message: 'API client not found' } })
      }
      const newStatus = !currentResult.rows[0].is_active
      const result = await pool.query(`
        UPDATE ${SCHEMA}api_clients SET is_active = $1, updated_at = NOW() WHERE id = $2
        RETURNING id, name, description, api_key_prefix, permissions, is_active, last_used_at, created_at, updated_at
      `, [newStatus, clientId])
      client = result.rows[0]
    }

    res.json({
      data: {
        id: client.id,
        name: client.name,
        description: client.description,
        apiKeyPrefix: client.api_key_prefix,
        permissions: client.permissions || [],
        isActive: client.is_active,
        lastUsedAt: client.last_used_at,
        createdAt: client.created_at,
        updatedAt: client.updated_at
      }
    })
  } catch (error) {
    console.error('Error toggling API client:', error)
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to toggle API client status' } })
  }
})

// POST /api/v1/api-clients/:clientId/regenerate - Regenerate API key
app.post('/api/v1/api-clients/:clientId/regenerate', async (req, res) => {
  try {
    const { clientId } = req.params
    const apiKey = generateApiKey()
    const apiKeyHash = hashApiKey(apiKey)
    const apiKeyPrefix = apiKey.substring(0, 8)

    if (isSupabaseConfigured()) {
      const { error } = await supabase
        .from('api_clients')
        .update({ api_key_hash: apiKeyHash, api_key_prefix: apiKeyPrefix, updated_at: new Date().toISOString() })
        .eq('id', clientId)
      if (error) throw error
    } else {
      const result = await pool.query(`
        UPDATE ${SCHEMA}api_clients SET api_key_hash = $1, api_key_prefix = $2, updated_at = NOW() WHERE id = $3 RETURNING id
      `, [apiKeyHash, apiKeyPrefix, clientId])
      if (result.rows.length === 0) {
        return res.status(404).json({ error: { code: 'CLIENT_NOT_FOUND', message: 'API client not found' } })
      }
    }

    res.json({ apiKey, message: 'New API key generated. Save it securely! The old key is now invalid.' })
  } catch (error) {
    console.error('Error regenerating API key:', error)
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to regenerate API key' } })
  }
})

// DELETE /api/v1/api-clients/:clientId - Delete API client
app.delete('/api/v1/api-clients/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params

    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('api_clients').delete().eq('id', clientId)
      if (error) throw error
    } else {
      const result = await pool.query(`DELETE FROM ${SCHEMA}api_clients WHERE id = $1`, [clientId])
      if (result.rowCount === 0) {
        return res.status(404).json({ error: { code: 'CLIENT_NOT_FOUND', message: 'API client not found' } })
      }
    }

    res.status(204).send()
  } catch (error) {
    console.error('Error deleting API client:', error)
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete API client' } })
  }
})

// ============================================================================
// SPRINT 3: ASSETS CRUD
// ============================================================================

// GET /api/assets - List assets
app.get('/api/assets', async (req, res) => {
  try {
    const { status, customer_id, asset_type, search } = req.query
    let query = `
      SELECT a.*, d.name as device_name
      FROM ${SCHEMA}assets a
      LEFT JOIN ${SCHEMA}devices d ON a.device_id = d.id
      WHERE a.deleted_at IS NULL
    `
    const params = []
    let paramCount = 0

    if (status) {
      paramCount++
      query += ` AND a.current_status = $${paramCount}`
      params.push(status)
    }
    if (customer_id) {
      paramCount++
      query += ` AND a.customer_id = $${paramCount}`
      params.push(customer_id)
    }
    if (asset_type) {
      paramCount++
      query += ` AND a.asset_type = $${paramCount}`
      params.push(asset_type)
    }
    if (search) {
      paramCount++
      query += ` AND (a.name ILIKE $${paramCount} OR a.barcode ILIKE $${paramCount} OR a.asset_type ILIKE $${paramCount})`
      params.push(`%${search}%`)
    }

    query += ' ORDER BY a.created_at DESC'

    const result = await pool.query(query, params)
    res.json({ success: true, data: toCamelCase(result.rows) })
  } catch (error) {
    console.error('Error fetching assets:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// GET /api/assets/:id - Get asset by ID
app.get('/api/assets/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await pool.query(`
      SELECT a.*, d.name as device_name, d.latitude as device_latitude, d.longitude as device_longitude,
             d.status as device_status, d.battery_level as device_battery
      FROM ${SCHEMA}assets a
      LEFT JOIN ${SCHEMA}devices d ON a.device_id = d.id
      WHERE a.id = $1 AND a.deleted_at IS NULL
    `, [id])

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Asset not found' })
    }

    res.json({ success: true, data: toCamelCase(result.rows[0]) })
  } catch (error) {
    console.error('Error fetching asset:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// POST /api/assets - Create asset
app.post('/api/assets', async (req, res) => {
  try {
    const { name, assetType, barcode, customerId, projectId, currentStatus, birthDate, composition, recycledContent, certificationStatus, complianceExpiry, labels, metadata } = req.body

    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' })
    }

    const result = await pool.query(`
      INSERT INTO ${SCHEMA}assets (name, asset_type, barcode, customer_id, project_id, current_status, birth_date, composition, recycled_content, certification_status, compliance_expiry, labels, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      name, assetType || null, barcode || null, customerId || null, projectId || null,
      currentStatus || 'unknown', birthDate || null,
      composition ? JSON.stringify(composition) : null,
      recycledContent || 0, certificationStatus || null, complianceExpiry || null,
      labels ? JSON.stringify(labels) : '[]',
      metadata ? JSON.stringify(metadata) : '{}'
    ])

    res.status(201).json({ success: true, data: toCamelCase(result.rows[0]) })
  } catch (error) {
    console.error('Error creating asset:', error)
    res.status(500).json({ success: false, error: 'Database error: ' + error.message })
  }
})

// PUT /api/assets/:id - Update asset
app.put('/api/assets/:id', async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body
    const updateFields = []
    const values = []
    let paramCount = 0

    const fieldMappings = {
      name: 'name',
      assetType: 'asset_type',
      barcode: 'barcode',
      customerId: 'customer_id',
      projectId: 'project_id',
      currentStatus: 'current_status',
      birthDate: 'birth_date',
      recycledContent: 'recycled_content',
      certificationStatus: 'certification_status',
      complianceExpiry: 'compliance_expiry',
      tripCount: 'trip_count',
      lastTripDate: 'last_trip_date'
    }

    for (const [camelKey, snakeKey] of Object.entries(fieldMappings)) {
      if (updates[camelKey] !== undefined) {
        paramCount++
        updateFields.push(`${snakeKey} = $${paramCount}`)
        values.push(updates[camelKey])
      }
    }

    // Handle JSONB fields
    if (updates.composition !== undefined) {
      paramCount++
      updateFields.push(`composition = $${paramCount}`)
      values.push(JSON.stringify(updates.composition))
    }
    if (updates.labels !== undefined) {
      paramCount++
      updateFields.push(`labels = $${paramCount}`)
      values.push(JSON.stringify(updates.labels))
    }
    if (updates.metadata !== undefined) {
      paramCount++
      updateFields.push(`metadata = $${paramCount}`)
      values.push(JSON.stringify(updates.metadata))
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' })
    }

    paramCount++
    updateFields.push(`updated_at = $${paramCount}`)
    values.push(new Date().toISOString())

    paramCount++
    values.push(id)

    const query = `UPDATE ${SCHEMA}assets SET ${updateFields.join(', ')} WHERE id = $${paramCount} AND deleted_at IS NULL RETURNING *`
    const result = await pool.query(query, values)

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Asset not found' })
    }

    res.json({ success: true, data: toCamelCase(result.rows[0]) })
  } catch (error) {
    console.error('Error updating asset:', error)
    res.status(500).json({ success: false, error: 'Database error: ' + error.message })
  }
})

// DELETE /api/assets/:id - Soft delete asset
app.delete('/api/assets/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await pool.query(
      `UPDATE ${SCHEMA}assets SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Asset not found' })
    }
    res.json({ success: true, message: 'Asset deleted' })
  } catch (error) {
    console.error('Error deleting asset:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// POST /api/assets/:id/device - Associate device (FR-804: swap support + audit log)
app.post('/api/assets/:id/device', async (req, res) => {
  const client = await pool.connect()
  try {
    const { id } = req.params
    const { deviceId, performedBy } = req.body
    if (!deviceId) {
      return res.status(400).json({ success: false, error: 'deviceId is required' })
    }

    await client.query('BEGIN')

    // Get current state of target asset
    const currentAsset = await client.query(
      `SELECT id, device_id FROM ${SCHEMA}assets WHERE id = $1 AND deleted_at IS NULL`, [id]
    )
    if (currentAsset.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ success: false, error: 'Asset not found' })
    }
    const previousDeviceId = currentAsset.rows[0].device_id

    // FR-804: One-to-one enforcement — check if device is already associated with another asset
    const existingAssoc = await client.query(
      `SELECT id FROM ${SCHEMA}assets WHERE device_id = $1 AND deleted_at IS NULL AND id != $2`,
      [deviceId, id]
    )
    let previousAssetId = null
    if (existingAssoc.rows.length > 0) {
      // Swap: dissociate from the other asset first
      previousAssetId = existingAssoc.rows[0].id
      await client.query(
        `UPDATE ${SCHEMA}assets SET device_id = NULL, updated_at = NOW() WHERE id = $1`, [previousAssetId]
      )
      // Log the dissociation from swap
      await client.query(
        `INSERT INTO ${SCHEMA}device_asset_association_log (device_id, asset_id, action, performed_by)
         VALUES ($1, $2, 'dissociate', $3)`,
        [deviceId, previousAssetId, performedBy || 'system']
      )
    }

    // Associate device to target asset
    const result = await client.query(
      `UPDATE ${SCHEMA}assets SET device_id = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL RETURNING *`,
      [deviceId, id]
    )

    // Audit log
    await client.query(
      `INSERT INTO ${SCHEMA}device_asset_association_log (device_id, asset_id, action, previous_device_id, previous_asset_id, performed_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [deviceId, id, previousAssetId ? 'swap' : 'associate', previousDeviceId, previousAssetId, performedBy || 'system']
    )

    await client.query('COMMIT')
    res.json({
      success: true,
      data: toCamelCase(result.rows[0]),
      swapped: !!previousAssetId,
      previousAssetId
    })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('Error associating device:', error)
    res.status(500).json({ success: false, error: 'Database error: ' + error.message })
  } finally {
    client.release()
  }
})

// DELETE /api/assets/:id/device - Dissociate device (with audit log)
app.delete('/api/assets/:id/device', async (req, res) => {
  try {
    const { id } = req.params
    const performedBy = req.query.performedBy || 'system'

    // Get current device before dissociating
    const currentAsset = await pool.query(
      `SELECT device_id FROM ${SCHEMA}assets WHERE id = $1 AND deleted_at IS NULL`, [id]
    )
    const previousDeviceId = currentAsset.rows.length > 0 ? currentAsset.rows[0].device_id : null

    const result = await pool.query(
      `UPDATE ${SCHEMA}assets SET device_id = NULL, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Asset not found' })
    }

    // Audit log
    if (previousDeviceId) {
      await pool.query(
        `INSERT INTO ${SCHEMA}device_asset_association_log (device_id, asset_id, action, previous_device_id, performed_by)
         VALUES ($1, $2, 'dissociate', $3, $4)`,
        [previousDeviceId, id, previousDeviceId, performedBy]
      )
    }

    res.json({ success: true, data: toCamelCase(result.rows[0]) })
  } catch (error) {
    console.error('Error dissociating device:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// ============================================================================
// SPRINT 3: GEOZONES CRUD + SPATIAL
// ============================================================================

// GET /api/geozones - List geozones
app.get('/api/geozones', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT g.id, g.tenant_id, g.customer_id, g.name, g.zone_type,
             ST_AsGeoJSON(g.geometry) as geometry_geojson,
             g.center_lat, g.center_lng, g.radius_meters, g.address,
             g.owner_name, g.contact_name, g.contact_email, g.operating_hours,
             g.is_active, g.hysteresis_meters, g.color,
             g.created_at, g.updated_at,
             (SELECT COUNT(*) FROM ${SCHEMA}assets a
              LEFT JOIN ${SCHEMA}devices d ON a.device_id = d.id
              WHERE d.latitude IS NOT NULL AND d.longitude IS NOT NULL
              AND a.deleted_at IS NULL
              AND ST_Contains(g.geometry, ST_SetSRID(ST_MakePoint(d.longitude::float, d.latitude::float), 4326))
             ) as asset_count
      FROM ${SCHEMA}geozones g
      WHERE g.deleted_at IS NULL
      ORDER BY g.created_at DESC
    `)

    const data = result.rows.map(row => ({
      ...toCamelCase(row),
      geometryGeojson: row.geometry_geojson ? JSON.parse(row.geometry_geojson) : null,
      assetCount: parseInt(row.asset_count) || 0
    }))

    res.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching geozones:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// GET /api/geozones/:id - Get geozone by ID
app.get('/api/geozones/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await pool.query(`
      SELECT g.*, ST_AsGeoJSON(g.geometry) as geometry_geojson
      FROM ${SCHEMA}geozones g
      WHERE g.id = $1 AND g.deleted_at IS NULL
    `, [id])

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Geozone not found' })
    }

    const row = result.rows[0]
    const data = {
      ...toCamelCase(row),
      geometryGeojson: row.geometry_geojson ? JSON.parse(row.geometry_geojson) : null
    }

    res.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching geozone:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// POST /api/geozones - Create geozone
app.post('/api/geozones', async (req, res) => {
  try {
    const { name, zoneType, geometry, centerLat, centerLng, radiusMeters, address, ownerName, contactName, contactEmail, operatingHours, isActive, hysteresisMeters, color, customerId } = req.body

    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' })
    }

    // Build geometry from polygon GeoJSON or circle params
    let geometrySQL
    const values = [name, zoneType || 'warehouse', centerLat || null, centerLng || null, radiusMeters || null, address || null, ownerName || null, contactName || null, contactEmail || null, operatingHours ? JSON.stringify(operatingHours) : null, isActive !== false, hysteresisMeters || 50, color || '#137fec', customerId || null]
    let paramCount = values.length

    if (geometry && geometry.type === 'Polygon') {
      // GeoJSON polygon provided
      paramCount++
      geometrySQL = `ST_GeomFromGeoJSON($${paramCount})`
      values.push(JSON.stringify(geometry))
    } else if (centerLat && centerLng && radiusMeters) {
      // Circle — generate buffer polygon from center point
      geometrySQL = `ST_Buffer(ST_SetSRID(ST_MakePoint($4::float, $3::float), 4326)::geography, $5)::geometry`
    } else {
      geometrySQL = 'NULL'
    }

    const result = await pool.query(`
      INSERT INTO ${SCHEMA}geozones (name, zone_type, center_lat, center_lng, radius_meters, address, owner_name, contact_name, contact_email, operating_hours, is_active, hysteresis_meters, color, customer_id, geometry)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, ${geometrySQL})
      RETURNING *, ST_AsGeoJSON(geometry) as geometry_geojson
    `, values)

    const row = result.rows[0]
    const data = {
      ...toCamelCase(row),
      geometryGeojson: row.geometry_geojson ? JSON.parse(row.geometry_geojson) : null
    }

    res.status(201).json({ success: true, data })
  } catch (error) {
    console.error('Error creating geozone:', error)
    res.status(500).json({ success: false, error: 'Database error: ' + error.message })
  }
})

// PUT /api/geozones/:id - Update geozone
app.put('/api/geozones/:id', async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body
    const updateFields = []
    const values = []
    let paramCount = 0

    const fieldMappings = {
      name: 'name',
      zoneType: 'zone_type',
      centerLat: 'center_lat',
      centerLng: 'center_lng',
      radiusMeters: 'radius_meters',
      address: 'address',
      ownerName: 'owner_name',
      contactName: 'contact_name',
      contactEmail: 'contact_email',
      isActive: 'is_active',
      hysteresisMeters: 'hysteresis_meters',
      color: 'color',
      customerId: 'customer_id'
    }

    for (const [camelKey, snakeKey] of Object.entries(fieldMappings)) {
      if (updates[camelKey] !== undefined) {
        paramCount++
        updateFields.push(`${snakeKey} = $${paramCount}`)
        values.push(updates[camelKey])
      }
    }

    if (updates.operatingHours !== undefined) {
      paramCount++
      updateFields.push(`operating_hours = $${paramCount}`)
      values.push(JSON.stringify(updates.operatingHours))
    }

    // Handle geometry update
    if (updates.geometry && updates.geometry.type === 'Polygon') {
      paramCount++
      updateFields.push(`geometry = ST_GeomFromGeoJSON($${paramCount})`)
      values.push(JSON.stringify(updates.geometry))
    } else if (updates.centerLat && updates.centerLng && updates.radiusMeters) {
      // Rebuild geometry from circle params (already added center_lat, center_lng, radius_meters above)
      updateFields.push(`geometry = ST_Buffer(ST_SetSRID(ST_MakePoint(center_lng::float, center_lat::float), 4326)::geography, radius_meters)::geometry`)
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' })
    }

    paramCount++
    updateFields.push(`updated_at = $${paramCount}`)
    values.push(new Date().toISOString())

    paramCount++
    values.push(id)

    const query = `UPDATE ${SCHEMA}geozones SET ${updateFields.join(', ')} WHERE id = $${paramCount} AND deleted_at IS NULL RETURNING *, ST_AsGeoJSON(geometry) as geometry_geojson`
    const result = await pool.query(query, values)

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Geozone not found' })
    }

    const row = result.rows[0]
    const data = {
      ...toCamelCase(row),
      geometryGeojson: row.geometry_geojson ? JSON.parse(row.geometry_geojson) : null
    }

    res.json({ success: true, data })
  } catch (error) {
    console.error('Error updating geozone:', error)
    res.status(500).json({ success: false, error: 'Database error: ' + error.message })
  }
})

// DELETE /api/geozones/:id - Soft delete geozone
app.delete('/api/geozones/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await pool.query(
      `UPDATE ${SCHEMA}geozones SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Geozone not found' })
    }
    res.json({ success: true, message: 'Geozone deleted' })
  } catch (error) {
    console.error('Error deleting geozone:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// GET /api/geozones/:id/assets - Assets inside geozone (spatial query)
app.get('/api/geozones/:id/assets', async (req, res) => {
  try {
    const { id } = req.params
    const result = await pool.query(`
      SELECT a.*, d.name as device_name, d.latitude as device_latitude, d.longitude as device_longitude
      FROM ${SCHEMA}assets a
      JOIN ${SCHEMA}devices d ON a.device_id = d.id
      JOIN ${SCHEMA}geozones g ON g.id = $1
      WHERE a.deleted_at IS NULL
        AND d.latitude IS NOT NULL AND d.longitude IS NOT NULL
        AND ST_Contains(g.geometry, ST_SetSRID(ST_MakePoint(d.longitude::float, d.latitude::float), 4326))
    `, [id])

    res.json({ success: true, data: toCamelCase(result.rows) })
  } catch (error) {
    console.error('Error fetching geozone assets:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// ============================================================================
// SPRINT 3: GEOZONE EVENTS
// ============================================================================

// GET /api/geozone-events - List events with filters
app.get('/api/geozone-events', async (req, res) => {
  try {
    const { asset_id, geozone_id, event_type, from, to } = req.query
    let query = `
      SELECT e.*, a.name as asset_name, g.name as geozone_name
      FROM ${SCHEMA}geozone_events e
      LEFT JOIN ${SCHEMA}assets a ON e.asset_id = a.id
      LEFT JOIN ${SCHEMA}geozones g ON e.geozone_id = g.id
      WHERE 1=1
    `
    const params = []
    let paramCount = 0

    if (asset_id) {
      paramCount++
      query += ` AND e.asset_id = $${paramCount}`
      params.push(asset_id)
    }
    if (geozone_id) {
      paramCount++
      query += ` AND e.geozone_id = $${paramCount}`
      params.push(geozone_id)
    }
    if (event_type) {
      paramCount++
      query += ` AND e.event_type = $${paramCount}`
      params.push(event_type)
    }
    if (from) {
      paramCount++
      query += ` AND e.occurred_at >= $${paramCount}`
      params.push(from)
    }
    if (to) {
      paramCount++
      query += ` AND e.occurred_at <= $${paramCount}`
      params.push(to)
    }

    query += ' ORDER BY e.occurred_at DESC LIMIT 100'

    const result = await pool.query(query, params)
    res.json({ success: true, data: toCamelCase(result.rows) })
  } catch (error) {
    console.error('Error fetching geozone events:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// POST /api/geozone-events/detect - Trigger geozone detection for a device position
app.post('/api/geozone-events/detect', async (req, res) => {
  try {
    const { deviceId, latitude, longitude } = req.body
    if (!deviceId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, error: 'deviceId, latitude, and longitude are required' })
    }

    // Find all active geozones containing this point
    const containsResult = await pool.query(`
      SELECT g.id, g.name, g.zone_type
      FROM ${SCHEMA}geozones g
      WHERE g.is_active = true AND g.deleted_at IS NULL
        AND ST_Contains(g.geometry, ST_SetSRID(ST_MakePoint($1::float, $2::float), 4326))
    `, [longitude, latitude])

    // Find asset linked to this device
    const assetResult = await pool.query(
      `SELECT id FROM ${SCHEMA}assets WHERE device_id = $1 AND deleted_at IS NULL`,
      [deviceId]
    )

    const events = []
    if (assetResult.rows.length > 0) {
      const assetId = assetResult.rows[0].id
      for (const zone of containsResult.rows) {
        // Check if there's already an enter event (to avoid duplicates)
        const existing = await pool.query(
          `SELECT id FROM ${SCHEMA}geozone_events WHERE asset_id = $1 AND geozone_id = $2 AND event_type = 'zone_enter' ORDER BY occurred_at DESC LIMIT 1`,
          [assetId, zone.id]
        )
        if (existing.rows.length === 0) {
          const eventResult = await pool.query(`
            INSERT INTO ${SCHEMA}geozone_events (asset_id, geozone_id, device_id, event_type, latitude, longitude)
            VALUES ($1, $2, $3, 'zone_enter', $4, $5) RETURNING *
          `, [assetId, zone.id, deviceId, latitude, longitude])
          events.push(toCamelCase(eventResult.rows[0]))

          // Sprint 4: Fire-and-forget alert detection for each created event
          evaluateGeozoneEvent(eventResult.rows[0], null).catch(err => {
            console.error('[Alert Detection] Fire-and-forget error:', err.message)
          })
        }
      }
    }

    res.json({
      success: true,
      data: {
        zonesContaining: containsResult.rows.map(z => ({ id: z.id, name: z.name, zoneType: z.zone_type })),
        eventsCreated: events
      }
    })
  } catch (error) {
    console.error('Error detecting geozones:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// ============================================================================
// SPRINT 3: ASSET TRIPS
// ============================================================================

// GET /api/asset-trips - List trips for an asset
app.get('/api/asset-trips', async (req, res) => {
  try {
    const { asset_id } = req.query
    let query = `
      SELECT t.*,
        og.name as origin_name, og.zone_type as origin_type,
        dg.name as destination_name, dg.zone_type as destination_type,
        a.name as asset_name
      FROM ${SCHEMA}asset_trips t
      LEFT JOIN ${SCHEMA}geozones og ON t.origin_geozone_id = og.id
      LEFT JOIN ${SCHEMA}geozones dg ON t.destination_geozone_id = dg.id
      LEFT JOIN ${SCHEMA}assets a ON t.asset_id = a.id
      WHERE 1=1
    `
    const params = []
    let paramCount = 0

    if (asset_id) {
      paramCount++
      query += ` AND t.asset_id = $${paramCount}`
      params.push(asset_id)
    }

    query += ' ORDER BY t.created_at DESC LIMIT 50'

    const result = await pool.query(query, params)
    res.json({ success: true, data: toCamelCase(result.rows) })
  } catch (error) {
    console.error('Error fetching asset trips:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// ============================================================================
// SPRINT 3: CUSTOMER DASHBOARD
// ============================================================================

// GET /api/customer-dashboard/stats - Aggregated customer dashboard stats
app.get('/api/customer-dashboard/stats', async (req, res) => {
  try {
    // Asset counts by status
    const statusResult = await pool.query(`
      SELECT current_status, COUNT(*) as count
      FROM ${SCHEMA}assets
      WHERE deleted_at IS NULL
      GROUP BY current_status
    `)

    const statusCounts = {}
    let totalAssets = 0
    for (const row of statusResult.rows) {
      statusCounts[row.current_status] = parseInt(row.count)
      totalAssets += parseInt(row.count)
    }

    // Active geozones count
    const geozoneResult = await pool.query(`
      SELECT zone_type, COUNT(*) as count
      FROM ${SCHEMA}geozones
      WHERE deleted_at IS NULL AND is_active = true
      GROUP BY zone_type
    `)

    const geozoneCounts = {}
    let totalGeozones = 0
    for (const row of geozoneResult.rows) {
      geozoneCounts[row.zone_type] = parseInt(row.count)
      totalGeozones += parseInt(row.count)
    }

    // Recent events (last 7 days)
    const eventsResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM ${SCHEMA}geozone_events
      WHERE occurred_at >= NOW() - interval '7 days'
    `)

    // Active trips
    const tripsResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM ${SCHEMA}asset_trips
      WHERE status = 'in_progress'
    `)

    // Assets with locations (for map)
    const assetsWithLocResult = await pool.query(`
      SELECT a.id, a.name, a.current_status, a.asset_type, a.barcode,
             d.latitude, d.longitude
      FROM ${SCHEMA}assets a
      JOIN ${SCHEMA}devices d ON a.device_id = d.id
      WHERE a.deleted_at IS NULL AND d.latitude IS NOT NULL AND d.longitude IS NOT NULL
    `)

    res.json({
      success: true,
      data: {
        totalAssets,
        assetsByStatus: statusCounts,
        totalGeozones,
        geozonesByType: geozoneCounts,
        recentEventsCount: parseInt(eventsResult.rows[0]?.count) || 0,
        activeTripsCount: parseInt(tripsResult.rows[0]?.count) || 0,
        assetsWithLocation: toCamelCase(assetsWithLocResult.rows)
      }
    })
  } catch (error) {
    console.error('Error fetching customer dashboard stats:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// ============================================================================
// SPRINT 4: ALERTS & GEOFENCING
// ============================================================================

// --- Status Inference Helpers ---

const STATUS_INFERENCE_DEFAULTS = {
  warehouse: 'at_facility',
  supplier: 'at_supplier',
  customer: 'at_customer',
  transit_hub: 'in_transit',
}

const ZONE_TYPE_TO_ENTITY = {
  warehouse: 'facility',
  supplier: 'supplier',
  customer: 'customer',
  transit_hub: 'transit_hub',
  restricted: 'restricted',
}

async function inferStatusFromZone(tenantId, zoneType) {
  if (!zoneType) return 'unknown'
  // Check DB for custom rule
  const result = await pool.query(
    `SELECT inferred_status FROM status_inference_rules WHERE (tenant_id = $1 OR tenant_id IS NULL) AND zone_type = $2 AND is_active = true ORDER BY tenant_id NULLS LAST LIMIT 1`,
    [tenantId, zoneType]
  )
  if (result.rows.length > 0) return result.rows[0].inferred_status
  return STATUS_INFERENCE_DEFAULTS[zoneType] || 'unknown'
}

async function recordStatusChange(assetId, previousStatus, newStatus, source, geozoneEventId, changedByUserId) {
  await pool.query(
    `INSERT INTO ${SCHEMA}asset_status_history (asset_id, previous_status, new_status, source, geozone_event_id, changed_by_user_id) VALUES ($1, $2, $3, $4, $5, $6)`,
    [assetId, previousStatus, newStatus, source, geozoneEventId || null, changedByUserId || null]
  )
}

async function logResponsibilityTransfer(assetId, tenantId, fromZone, toZone) {
  // Calculate custody duration from previous transfer
  const prevResult = await pool.query(
    `SELECT transferred_at FROM ${SCHEMA}responsibility_transfers WHERE asset_id = $1 ORDER BY transferred_at DESC LIMIT 1`,
    [assetId]
  )
  let custodyDuration = null
  if (prevResult.rows.length > 0) {
    custodyDuration = Math.round((Date.now() - new Date(prevResult.rows[0].transferred_at).getTime()) / 1000)
  }

  const fromEntityType = fromZone ? (ZONE_TYPE_TO_ENTITY[fromZone.zone_type] || fromZone.zone_type) : null
  const toEntityType = toZone ? (ZONE_TYPE_TO_ENTITY[toZone.zone_type] || toZone.zone_type) : null

  await pool.query(
    `INSERT INTO ${SCHEMA}responsibility_transfers (asset_id, tenant_id, from_entity_type, from_entity_name, from_geozone_id, to_entity_type, to_entity_name, to_geozone_id, custody_duration_seconds)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      assetId, tenantId,
      fromEntityType, fromZone?.name || null, fromZone?.id || null,
      toEntityType, toZone?.name || null, toZone?.id || null,
      custodyDuration
    ]
  )
}

async function evaluateGeozoneEvent(event, tenantId) {
  try {
    // 1. Look up geozone -> get zone_type
    const geozoneResult = await pool.query(
      `SELECT id, name, zone_type FROM ${SCHEMA}geozones WHERE id = $1`,
      [event.geozone_id || event.geozoneId]
    )
    if (geozoneResult.rows.length === 0) return

    const geozone = geozoneResult.rows[0]
    const assetId = event.asset_id || event.assetId
    const eventType = event.event_type || event.eventType

    // 2. Status inference: infer status -> update asset if changed -> record history
    const assetResult = await pool.query(
      `SELECT id, current_status, tenant_id FROM ${SCHEMA}assets WHERE id = $1`,
      [assetId]
    )
    if (assetResult.rows.length === 0) return

    const asset = assetResult.rows[0]
    const effectiveTenantId = tenantId || asset.tenant_id

    if (eventType === 'zone_enter') {
      const newStatus = await inferStatusFromZone(effectiveTenantId, geozone.zone_type)
      if (newStatus && newStatus !== asset.current_status) {
        await pool.query(
          `UPDATE ${SCHEMA}assets SET current_status = $1, updated_at = NOW() WHERE id = $2`,
          [newStatus, assetId]
        )
        await recordStatusChange(assetId, asset.current_status, newStatus, 'auto', event.id, null)
      }

      // 3. Responsibility transfer: derive entity type -> log transfer
      // Find the previous zone (last zone_exit or zone_enter)
      const prevEvent = await pool.query(
        `SELECT ge.*, g.name as geozone_name, g.zone_type as geozone_zone_type
         FROM ${SCHEMA}geozone_events ge
         JOIN ${SCHEMA}geozones g ON ge.geozone_id = g.id
         WHERE ge.asset_id = $1 AND ge.id != $2
         ORDER BY ge.occurred_at DESC LIMIT 1`,
        [assetId, event.id]
      )

      const fromZone = prevEvent.rows.length > 0 ? {
        id: prevEvent.rows[0].geozone_id,
        name: prevEvent.rows[0].geozone_name,
        zone_type: prevEvent.rows[0].geozone_zone_type
      } : null

      await logResponsibilityTransfer(assetId, effectiveTenantId, fromZone, geozone)
    }

    // 4. Alert rule evaluation
    const enabledRules = await pool.query(
      `SELECT * FROM ${SCHEMA}alert_rules WHERE is_enabled = true AND deleted_at IS NULL AND trigger_type = $1 AND (tenant_id = $2 OR tenant_id IS NULL)`,
      [eventType === 'zone_enter' ? 'zone_enter' : 'zone_exit', effectiveTenantId]
    )

    for (const rule of enabledRules.rows) {
      const conditions = rule.conditions || {}

      // Check conditions
      if (conditions.zoneTypes && conditions.zoneTypes.length > 0) {
        if (!conditions.zoneTypes.includes(geozone.zone_type)) continue
      }
      if (conditions.geozoneIds && conditions.geozoneIds.length > 0) {
        if (!conditions.geozoneIds.includes(geozone.id)) continue
      }
      if (conditions.assetIds && conditions.assetIds.length > 0) {
        if (!conditions.assetIds.includes(assetId)) continue
      }

      // Dedup check
      const dedupKey = `${rule.trigger_type}:${assetId}:${geozone.id}`
      const existingAlert = await pool.query(
        `SELECT id FROM ${SCHEMA}alerts WHERE dedup_key = $1 AND status NOT IN ('resolved')`,
        [dedupKey]
      )
      if (existingAlert.rows.length > 0) continue

      // Create alert
      const alertTitle = `${rule.name} - ${geozone.name}`
      const alertDesc = rule.description || `Alert triggered for ${eventType} at ${geozone.name}`
      const slaDeadline = new Date(Date.now() + (rule.cooldown_minutes || 60) * 60 * 1000)

      const alertResult = await pool.query(
        `INSERT INTO ${SCHEMA}alerts (tenant_id, alert_rule_id, asset_id, geozone_id, geozone_event_id, alert_type, severity, status, title, description, latitude, longitude, dedup_key, sla_deadline)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'new', $8, $9, $10, $11, $12, $13) RETURNING *`,
        [effectiveTenantId, rule.id, assetId, geozone.id, event.id, rule.trigger_type, rule.severity, alertTitle, alertDesc, event.latitude, event.longitude, dedupKey, slaDeadline]
      )

      const newAlert = alertResult.rows[0]

      // Create alert history entry
      await pool.query(
        `INSERT INTO ${SCHEMA}alert_history (alert_id, from_status, to_status, comment) VALUES ($1, NULL, 'new', 'Alert created by system')`,
        [newAlert.id]
      )

      // Create notifications
      const actions = rule.actions || {}
      if (actions.in_app !== false) {
        await pool.query(
          `INSERT INTO ${SCHEMA}notifications (tenant_id, alert_id, notification_type, channel, title, body) VALUES ($1, $2, 'alert_created', 'in_app', $3, $4)`,
          [effectiveTenantId, newAlert.id, `${rule.severity.toUpperCase()}: ${alertTitle}`, alertDesc]
        )
      }
      if (actions.email) {
        console.log(`[MOCK EMAIL] To: recipients of rule "${rule.name}" | Subject: ${rule.severity.toUpperCase()}: ${alertTitle} | Body: ${alertDesc}`)
        await pool.query(
          `INSERT INTO ${SCHEMA}notifications (tenant_id, alert_id, notification_type, channel, title, body) VALUES ($1, $2, 'alert_created', 'email', $3, $4)`,
          [effectiveTenantId, newAlert.id, `${rule.severity.toUpperCase()}: ${alertTitle}`, alertDesc]
        )
      }

      console.log(`[Alert Detection] Created alert "${alertTitle}" (${rule.severity}) for rule "${rule.name}"`)
    }
  } catch (err) {
    console.error('[Alert Detection] Error evaluating geozone event:', err.message)
  }
}

// --- STATUS INFERENCE ENDPOINTS ---

// GET /api/status-inference - List inference rules
app.get('/api/status-inference', async (req, res) => {
  try {
    const { tenant_id } = req.query
    const result = await pool.query(
      `SELECT * FROM ${SCHEMA}status_inference_rules WHERE (tenant_id = $1 OR tenant_id IS NULL) AND is_active = true ORDER BY zone_type`,
      [tenant_id || null]
    )
    res.json({ success: true, data: toCamelCase(result.rows) })
  } catch (error) {
    console.error('Error fetching inference rules:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// PUT /api/status-inference - Upsert inference rule
app.put('/api/status-inference', async (req, res) => {
  try {
    const { tenantId, zoneType, inferredStatus, noZoneStatus, isActive } = req.body
    const result = await pool.query(
      `INSERT INTO ${SCHEMA}status_inference_rules (tenant_id, zone_type, inferred_status, no_zone_status, is_active)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, zone_type) DO UPDATE SET inferred_status = $3, no_zone_status = $4, is_active = $5, updated_at = NOW()
       RETURNING *`,
      [tenantId || null, zoneType, inferredStatus, noZoneStatus || 'unknown', isActive !== false]
    )
    res.json({ success: true, data: toCamelCase(result.rows[0]) })
  } catch (error) {
    console.error('Error upserting inference rule:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// GET /api/status-inference/assets/:id/status-history - Asset status history
app.get('/api/status-inference/assets/:id/status-history', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT h.*, g.name as geozone_name, u.name as changed_by_name
       FROM ${SCHEMA}asset_status_history h
       LEFT JOIN ${SCHEMA}geozone_events ge ON h.geozone_event_id = ge.id
       LEFT JOIN ${SCHEMA}geozones g ON ge.geozone_id = g.id
       LEFT JOIN ${SCHEMA}users u ON h.changed_by_user_id = u.id
       WHERE h.asset_id = $1
       ORDER BY h.created_at DESC`,
      [req.params.id]
    )
    res.json({ success: true, data: toCamelCase(result.rows) })
  } catch (error) {
    console.error('Error fetching status history:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// POST /api/status-inference/assets/:id/override-status - Manual status override
app.post('/api/status-inference/assets/:id/override-status', async (req, res) => {
  try {
    const { newStatus, userId } = req.body
    const assetId = req.params.id

    const assetResult = await pool.query(
      `SELECT current_status FROM ${SCHEMA}assets WHERE id = $1 AND deleted_at IS NULL`,
      [assetId]
    )
    if (assetResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Asset not found' })
    }

    const previousStatus = assetResult.rows[0].current_status
    await pool.query(
      `UPDATE ${SCHEMA}assets SET current_status = $1, updated_at = NOW() WHERE id = $2`,
      [newStatus, assetId]
    )
    await recordStatusChange(assetId, previousStatus, newStatus, 'manual', null, userId || null)

    res.json({ success: true, data: { previousStatus, newStatus } })
  } catch (error) {
    console.error('Error overriding status:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// --- RESPONSIBILITY TRANSFER ENDPOINTS ---

// GET /api/responsibility-transfers - List transfers
app.get('/api/responsibility-transfers', async (req, res) => {
  try {
    const { asset_id, from, to } = req.query
    let query = `
      SELECT rt.*,
        a.name as asset_name,
        fg.name as from_geozone_name,
        tg.name as to_geozone_name
      FROM ${SCHEMA}responsibility_transfers rt
      LEFT JOIN ${SCHEMA}assets a ON rt.asset_id = a.id
      LEFT JOIN ${SCHEMA}geozones fg ON rt.from_geozone_id = fg.id
      LEFT JOIN ${SCHEMA}geozones tg ON rt.to_geozone_id = tg.id
      WHERE 1=1
    `
    const params = []
    let paramCount = 0

    if (asset_id) {
      paramCount++
      query += ` AND rt.asset_id = $${paramCount}`
      params.push(asset_id)
    }
    if (from) {
      paramCount++
      query += ` AND rt.transferred_at >= $${paramCount}`
      params.push(from)
    }
    if (to) {
      paramCount++
      query += ` AND rt.transferred_at <= $${paramCount}`
      params.push(to)
    }

    query += ' ORDER BY rt.transferred_at DESC'
    const result = await pool.query(query, params)
    res.json({ success: true, data: toCamelCase(result.rows) })
  } catch (error) {
    console.error('Error fetching transfers:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// GET /api/responsibility-transfers/assets/:id - Transfers for specific asset
app.get('/api/responsibility-transfers/assets/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT rt.*,
        fg.name as from_geozone_name,
        tg.name as to_geozone_name
       FROM ${SCHEMA}responsibility_transfers rt
       LEFT JOIN ${SCHEMA}geozones fg ON rt.from_geozone_id = fg.id
       LEFT JOIN ${SCHEMA}geozones tg ON rt.to_geozone_id = tg.id
       WHERE rt.asset_id = $1
       ORDER BY rt.transferred_at DESC`,
      [req.params.id]
    )
    res.json({ success: true, data: toCamelCase(result.rows) })
  } catch (error) {
    console.error('Error fetching asset transfers:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// --- ALERT RULES ENDPOINTS ---

// GET /api/alert-rules - List alert rules (with rule_scope filter)
app.get('/api/alert-rules', async (req, res) => {
  try {
    const { trigger_type, is_enabled, search, tenant_id, rule_scope } = req.query
    let query = `SELECT * FROM ${SCHEMA}alert_rules WHERE deleted_at IS NULL`
    const params = []
    let paramCount = 0

    if (tenant_id) {
      paramCount++
      query += ` AND (tenant_id = $${paramCount} OR tenant_id IS NULL)`
      params.push(tenant_id)
    }
    if (trigger_type) {
      paramCount++
      query += ` AND trigger_type = $${paramCount}`
      params.push(trigger_type)
    }
    if (is_enabled !== undefined) {
      paramCount++
      query += ` AND is_enabled = $${paramCount}`
      params.push(is_enabled === 'true')
    }
    if (search) {
      paramCount++
      query += ` AND (name ILIKE $${paramCount} OR description ILIKE $${paramCount})`
      params.push(`%${search}%`)
    }
    if (rule_scope) {
      paramCount++
      query += ` AND rule_scope = $${paramCount}`
      params.push(rule_scope)
    }

    query += ' ORDER BY created_at DESC'
    const result = await pool.query(query, params)
    res.json({ success: true, data: toCamelCase(result.rows) })
  } catch (error) {
    console.error('Error fetching alert rules:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// GET /api/alert-rules/:id - Get alert rule by ID
app.get('/api/alert-rules/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM ${SCHEMA}alert_rules WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Alert rule not found' })
    }
    res.json({ success: true, data: toCamelCase(result.rows[0]) })
  } catch (error) {
    console.error('Error fetching alert rule:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// POST /api/alert-rules - Create alert rule (with auto-derived rule_scope)
app.post('/api/alert-rules', async (req, res) => {
  try {
    const { tenantId, name, description, triggerType, severity, conditions, actions, recipients, isEnabled, cooldownMinutes } = req.body
    if (!name || !triggerType) {
      return res.status(400).json({ success: false, error: 'name and triggerType are required' })
    }
    const ruleScope = deriveRuleScope(triggerType)
    const result = await pool.query(
      `INSERT INTO ${SCHEMA}alert_rules (tenant_id, name, description, trigger_type, severity, conditions, actions, recipients, is_enabled, cooldown_minutes, rule_scope)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [tenantId || null, name, description || null, triggerType, severity || 'medium',
       JSON.stringify(conditions || {}), JSON.stringify(actions || { email: true, in_app: true }),
       JSON.stringify(recipients || []), isEnabled !== false, cooldownMinutes || 60, ruleScope]
    )
    res.status(201).json({ success: true, data: toCamelCase(result.rows[0]) })
  } catch (error) {
    console.error('Error creating alert rule:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// PUT /api/alert-rules/:id - Update alert rule
app.put('/api/alert-rules/:id', async (req, res) => {
  try {
    const { name, description, triggerType, severity, conditions, actions, recipients, isEnabled, cooldownMinutes } = req.body
    const updateFields = []
    const values = []
    let paramCount = 0

    const fieldMappings = {
      name: 'name', description: 'description', triggerType: 'trigger_type',
      severity: 'severity', isEnabled: 'is_enabled', cooldownMinutes: 'cooldown_minutes',
      ruleScope: 'rule_scope'
    }

    // Auto-derive rule_scope if triggerType is being updated
    if (req.body.triggerType && !req.body.ruleScope) {
      req.body.ruleScope = deriveRuleScope(req.body.triggerType)
    }

    for (const [camelKey, snakeKey] of Object.entries(fieldMappings)) {
      if (req.body[camelKey] !== undefined) {
        paramCount++
        updateFields.push(`${snakeKey} = $${paramCount}`)
        values.push(req.body[camelKey])
      }
    }

    // JSONB fields
    if (conditions !== undefined) {
      paramCount++
      updateFields.push(`conditions = $${paramCount}`)
      values.push(JSON.stringify(conditions))
    }
    if (actions !== undefined) {
      paramCount++
      updateFields.push(`actions = $${paramCount}`)
      values.push(JSON.stringify(actions))
    }
    if (recipients !== undefined) {
      paramCount++
      updateFields.push(`recipients = $${paramCount}`)
      values.push(JSON.stringify(recipients))
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' })
    }

    paramCount++
    updateFields.push(`updated_at = $${paramCount}`)
    values.push(new Date().toISOString())

    paramCount++
    values.push(req.params.id)

    const query = `UPDATE ${SCHEMA}alert_rules SET ${updateFields.join(', ')} WHERE id = $${paramCount} AND deleted_at IS NULL RETURNING *`
    const result = await pool.query(query, values)

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Alert rule not found' })
    }
    res.json({ success: true, data: toCamelCase(result.rows[0]) })
  } catch (error) {
    console.error('Error updating alert rule:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// DELETE /api/alert-rules/:id - Soft delete alert rule
app.delete('/api/alert-rules/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE ${SCHEMA}alert_rules SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [req.params.id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Alert rule not found' })
    }
    res.json({ success: true, data: { id: result.rows[0].id } })
  } catch (error) {
    console.error('Error deleting alert rule:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// POST /api/alert-rules/:id/clone - Clone alert rule
app.post('/api/alert-rules/:id/clone', async (req, res) => {
  try {
    const original = await pool.query(
      `SELECT * FROM ${SCHEMA}alert_rules WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    )
    if (original.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Alert rule not found' })
    }
    const r = original.rows[0]
    const result = await pool.query(
      `INSERT INTO ${SCHEMA}alert_rules (tenant_id, name, description, trigger_type, severity, conditions, actions, recipients, is_enabled, cooldown_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, $9) RETURNING *`,
      [r.tenant_id, r.name + ' (Copy)', r.description, r.trigger_type, r.severity,
       JSON.stringify(r.conditions), JSON.stringify(r.actions), JSON.stringify(r.recipients), r.cooldown_minutes]
    )
    res.status(201).json({ success: true, data: toCamelCase(result.rows[0]) })
  } catch (error) {
    console.error('Error cloning alert rule:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// PUT /api/alert-rules/:id/toggle - Toggle alert rule enabled/disabled
app.put('/api/alert-rules/:id/toggle', async (req, res) => {
  try {
    const { isEnabled } = req.body
    const result = await pool.query(
      `UPDATE ${SCHEMA}alert_rules SET is_enabled = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL RETURNING *`,
      [isEnabled, req.params.id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Alert rule not found' })
    }
    res.json({ success: true, data: toCamelCase(result.rows[0]) })
  } catch (error) {
    console.error('Error toggling alert rule:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// POST /api/alert-rules/import - Import rules from JSON array
app.post('/api/alert-rules/import', async (req, res) => {
  try {
    const rules = req.body.rules || req.body
    if (!Array.isArray(rules)) {
      return res.status(400).json({ success: false, error: 'Expected an array of rules' })
    }
    const imported = []
    for (const r of rules) {
      const result = await pool.query(
        `INSERT INTO ${SCHEMA}alert_rules (tenant_id, name, description, trigger_type, severity, conditions, actions, recipients, is_enabled, cooldown_minutes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [r.tenantId || null, r.name, r.description || null, r.triggerType, r.severity || 'medium',
         JSON.stringify(r.conditions || {}), JSON.stringify(r.actions || {}),
         JSON.stringify(r.recipients || []), r.isEnabled !== false, r.cooldownMinutes || 60]
      )
      imported.push(toCamelCase(result.rows[0]))
    }
    res.status(201).json({ success: true, data: imported })
  } catch (error) {
    console.error('Error importing alert rules:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// GET /api/alert-rules/:id/export - Export single rule as JSON
app.get('/api/alert-rules/:id/export', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM ${SCHEMA}alert_rules WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Alert rule not found' })
    }
    const r = result.rows[0]
    res.json({
      name: r.name, description: r.description, triggerType: r.trigger_type, severity: r.severity,
      conditions: r.conditions, actions: r.actions, recipients: r.recipients,
      isEnabled: r.is_enabled, cooldownMinutes: r.cooldown_minutes
    })
  } catch (error) {
    console.error('Error exporting alert rule:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// POST /api/alert-rules/:id/test - Test rule with simulated event
app.post('/api/alert-rules/:id/test', async (req, res) => {
  try {
    const rule = await pool.query(
      `SELECT * FROM ${SCHEMA}alert_rules WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    )
    if (rule.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Alert rule not found' })
    }
    const r = rule.rows[0]
    const { assetId, geozoneId, latitude, longitude } = req.body

    // Simulate matching logic
    const conditions = r.conditions || {}
    let wouldTrigger = true
    const reasons = []

    if (conditions.zoneTypes && conditions.zoneTypes.length > 0 && geozoneId) {
      const gz = await pool.query(`SELECT zone_type FROM ${SCHEMA}geozones WHERE id = $1`, [geozoneId])
      if (gz.rows.length > 0 && !conditions.zoneTypes.includes(gz.rows[0].zone_type)) {
        wouldTrigger = false
        reasons.push(`Zone type "${gz.rows[0].zone_type}" not in rule zone types`)
      }
    }
    if (conditions.assetIds && conditions.assetIds.length > 0 && assetId) {
      if (!conditions.assetIds.includes(assetId)) {
        wouldTrigger = false
        reasons.push('Asset ID not in rule asset list')
      }
    }
    if (conditions.geozoneIds && conditions.geozoneIds.length > 0 && geozoneId) {
      if (!conditions.geozoneIds.includes(geozoneId)) {
        wouldTrigger = false
        reasons.push('Geozone ID not in rule geozone list')
      }
    }

    res.json({
      success: true,
      data: {
        wouldTrigger,
        rule: toCamelCase(r),
        reasons: wouldTrigger ? ['All conditions matched'] : reasons
      }
    })
  } catch (error) {
    console.error('Error testing alert rule:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// --- ALERTS ENDPOINTS ---

// GET /api/alerts - List alerts with filters
app.get('/api/alerts', async (req, res) => {
  try {
    const { status, severity, type, from, to, assigned_to, asset_id, geozone_id, search, tenant_id, limit, offset } = req.query
    let query = `
      SELECT al.*,
        a.name as asset_name, a.barcode as asset_barcode,
        g.name as geozone_name, g.zone_type as geozone_zone_type,
        ar.name as rule_name,
        u.name as assigned_to_name
      FROM ${SCHEMA}alerts al
      LEFT JOIN ${SCHEMA}assets a ON al.asset_id = a.id
      LEFT JOIN ${SCHEMA}geozones g ON al.geozone_id = g.id
      LEFT JOIN ${SCHEMA}alert_rules ar ON al.alert_rule_id = ar.id
      LEFT JOIN ${SCHEMA}users u ON al.assigned_to = u.id
      WHERE 1=1
    `
    const params = []
    let paramCount = 0

    if (tenant_id) {
      paramCount++
      query += ` AND al.tenant_id = $${paramCount}`
      params.push(tenant_id)
    }
    if (status) {
      const statuses = status.split(',')
      paramCount++
      query += ` AND al.status = ANY($${paramCount})`
      params.push(statuses)
    }
    if (severity) {
      const severities = severity.split(',')
      paramCount++
      query += ` AND al.severity = ANY($${paramCount})`
      params.push(severities)
    }
    if (type) {
      paramCount++
      query += ` AND al.alert_type = $${paramCount}`
      params.push(type)
    }
    if (from) {
      paramCount++
      query += ` AND al.created_at >= $${paramCount}`
      params.push(from)
    }
    if (to) {
      paramCount++
      query += ` AND al.created_at <= $${paramCount}`
      params.push(to)
    }
    if (assigned_to) {
      paramCount++
      query += ` AND al.assigned_to = $${paramCount}`
      params.push(assigned_to)
    }
    if (asset_id) {
      paramCount++
      query += ` AND al.asset_id = $${paramCount}`
      params.push(asset_id)
    }
    if (geozone_id) {
      paramCount++
      query += ` AND al.geozone_id = $${paramCount}`
      params.push(geozone_id)
    }
    if (search) {
      paramCount++
      query += ` AND (al.title ILIKE $${paramCount} OR al.description ILIKE $${paramCount} OR a.name ILIKE $${paramCount})`
      params.push(`%${search}%`)
    }

    query += ' ORDER BY al.created_at DESC'

    if (limit) {
      paramCount++
      query += ` LIMIT $${paramCount}`
      params.push(parseInt(limit))
    }
    if (offset) {
      paramCount++
      query += ` OFFSET $${paramCount}`
      params.push(parseInt(offset))
    }

    const result = await pool.query(query, params)
    res.json({ success: true, data: toCamelCase(result.rows) })
  } catch (error) {
    console.error('Error fetching alerts:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// GET /api/alerts/stats - Dashboard summary stats
app.get('/api/alerts/stats', async (req, res) => {
  try {
    const { tenant_id } = req.query
    const tenantFilter = tenant_id ? `AND tenant_id = '${tenant_id}'` : ''

    // Status counts
    const statusResult = await pool.query(`
      SELECT status, COUNT(*) as count FROM ${SCHEMA}alerts WHERE 1=1 ${tenantFilter} GROUP BY status
    `)
    const byStatus = {}
    let total = 0
    for (const row of statusResult.rows) {
      byStatus[row.status] = parseInt(row.count)
      total += parseInt(row.count)
    }

    // Severity counts
    const severityResult = await pool.query(`
      SELECT severity, COUNT(*) as count FROM ${SCHEMA}alerts WHERE status != 'resolved' ${tenantFilter} GROUP BY severity
    `)
    const bySeverity = {}
    for (const row of severityResult.rows) {
      bySeverity[row.severity] = parseInt(row.count)
    }

    // Avg resolution time (for resolved alerts)
    const avgResult = await pool.query(`
      SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))) as avg_seconds
      FROM ${SCHEMA}alerts
      WHERE status = 'resolved' AND resolved_at IS NOT NULL ${tenantFilter}
    `)
    const avgResolutionSeconds = parseFloat(avgResult.rows[0]?.avg_seconds) || 0

    // Unresolved count
    const unresolvedResult = await pool.query(`
      SELECT COUNT(*) as count FROM ${SCHEMA}alerts WHERE status NOT IN ('resolved') ${tenantFilter}
    `)
    const unresolved = parseInt(unresolvedResult.rows[0]?.count) || 0

    // Trend data (last 7 days)
    const trendResult = await pool.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM ${SCHEMA}alerts
      WHERE created_at >= NOW() - INTERVAL '7 days' ${tenantFilter}
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at)
    `)

    res.json({
      success: true,
      data: {
        total,
        byStatus,
        bySeverity,
        unresolved,
        avgResolutionSeconds: Math.round(avgResolutionSeconds),
        avgResolutionMinutes: Math.round(avgResolutionSeconds / 60),
        trend: trendResult.rows.map(r => ({ date: r.date, count: parseInt(r.count) }))
      }
    })
  } catch (error) {
    console.error('Error fetching alert stats:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// GET /api/alerts/:id - Alert detail
app.get('/api/alerts/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT al.*,
        a.name as asset_name, a.barcode as asset_barcode, a.current_status as asset_status,
        g.name as geozone_name, g.zone_type as geozone_zone_type, ST_AsGeoJSON(g.geometry) as geozone_geometry,
        g.center_lat as geozone_center_lat, g.center_lng as geozone_center_lng, g.color as geozone_color,
        ar.name as rule_name, ar.trigger_type as rule_trigger_type, ar.severity as rule_severity,
        u.name as assigned_to_name
      FROM ${SCHEMA}alerts al
      LEFT JOIN ${SCHEMA}assets a ON al.asset_id = a.id
      LEFT JOIN ${SCHEMA}geozones g ON al.geozone_id = g.id
      LEFT JOIN ${SCHEMA}alert_rules ar ON al.alert_rule_id = ar.id
      LEFT JOIN ${SCHEMA}users u ON al.assigned_to = u.id
      WHERE al.id = $1
    `, [req.params.id])

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Alert not found' })
    }
    res.json({ success: true, data: toCamelCase(result.rows[0]) })
  } catch (error) {
    console.error('Error fetching alert:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// GET /api/alerts/:id/history - Alert audit trail
app.get('/api/alerts/:id/history', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT h.*, u.name as changed_by_name
      FROM ${SCHEMA}alert_history h
      LEFT JOIN ${SCHEMA}users u ON h.changed_by = u.id
      WHERE h.alert_id = $1
      ORDER BY h.created_at ASC
    `, [req.params.id])
    res.json({ success: true, data: toCamelCase(result.rows) })
  } catch (error) {
    console.error('Error fetching alert history:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// PUT /api/alerts/:id/transition - Change alert status
app.put('/api/alerts/:id/transition', async (req, res) => {
  try {
    const { status, comment, assignedTo, snoozedUntil } = req.body
    if (!status) {
      return res.status(400).json({ success: false, error: 'status is required' })
    }

    const currentAlert = await pool.query(
      `SELECT * FROM ${SCHEMA}alerts WHERE id = $1`,
      [req.params.id]
    )
    if (currentAlert.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Alert not found' })
    }

    const fromStatus = currentAlert.rows[0].status
    const updateFields = ['status = $1', 'updated_at = NOW()']
    const values = [status]
    let paramCount = 1

    if (assignedTo !== undefined) {
      paramCount++
      updateFields.push(`assigned_to = $${paramCount}`)
      values.push(assignedTo || null)
    }
    if (snoozedUntil) {
      paramCount++
      updateFields.push(`snoozed_until = $${paramCount}`)
      values.push(snoozedUntil)
    }
    if (status === 'resolved') {
      updateFields.push('resolved_at = NOW()')
    }

    paramCount++
    values.push(req.params.id)

    const result = await pool.query(
      `UPDATE ${SCHEMA}alerts SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    )

    // Record history
    await pool.query(
      `INSERT INTO ${SCHEMA}alert_history (alert_id, from_status, to_status, comment) VALUES ($1, $2, $3, $4)`,
      [req.params.id, fromStatus, status, comment || null]
    )

    res.json({ success: true, data: toCamelCase(result.rows[0]) })
  } catch (error) {
    console.error('Error transitioning alert:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// POST /api/alerts/bulk-transition - Bulk status change
app.post('/api/alerts/bulk-transition', async (req, res) => {
  try {
    const { ids, status, comment, assignedTo } = req.body
    if (!ids || !Array.isArray(ids) || ids.length === 0 || !status) {
      return res.status(400).json({ success: false, error: 'ids array and status are required' })
    }

    const updated = []
    for (const id of ids) {
      const currentAlert = await pool.query(`SELECT status FROM ${SCHEMA}alerts WHERE id = $1`, [id])
      if (currentAlert.rows.length === 0) continue

      const fromStatus = currentAlert.rows[0].status
      const updateFields = ['status = $1', 'updated_at = NOW()']
      const values = [status]
      let paramCount = 1

      if (assignedTo !== undefined) {
        paramCount++
        updateFields.push(`assigned_to = $${paramCount}`)
        values.push(assignedTo || null)
      }
      if (status === 'resolved') {
        updateFields.push('resolved_at = NOW()')
      }

      paramCount++
      values.push(id)

      const result = await pool.query(
        `UPDATE ${SCHEMA}alerts SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      )
      if (result.rows.length > 0) updated.push(toCamelCase(result.rows[0]))

      await pool.query(
        `INSERT INTO ${SCHEMA}alert_history (alert_id, from_status, to_status, comment) VALUES ($1, $2, $3, $4)`,
        [id, fromStatus, status, comment || `Bulk transition to ${status}`]
      )
    }

    res.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error bulk transitioning alerts:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// POST /api/alerts/check-overdue - Trigger overdue scan
app.post('/api/alerts/check-overdue', async (req, res) => {
  try {
    // Find in_progress trips that are overdue
    const overdueTrips = await pool.query(`
      SELECT t.*, a.name as asset_name, a.tenant_id
      FROM ${SCHEMA}asset_trips t
      JOIN ${SCHEMA}assets a ON t.asset_id = a.id
      WHERE t.status = 'in_progress'
        AND t.departed_at < NOW() - INTERVAL '2 hours'
    `)

    const alertsCreated = []
    for (const trip of overdueTrips.rows) {
      // Check for arrival_overdue rules
      const rules = await pool.query(
        `SELECT * FROM ${SCHEMA}alert_rules WHERE trigger_type = 'arrival_overdue' AND is_enabled = true AND deleted_at IS NULL AND (tenant_id = $1 OR tenant_id IS NULL)`,
        [trip.tenant_id]
      )

      for (const rule of rules.rows) {
        const gracePeriod = (rule.conditions?.gracePeriodMinutes || 120) * 60 * 1000
        const tripDuration = Date.now() - new Date(trip.departed_at).getTime()
        if (tripDuration < gracePeriod) continue

        const dedupKey = `arrival_overdue:${trip.asset_id}:${trip.id}`
        const existing = await pool.query(
          `SELECT id FROM ${SCHEMA}alerts WHERE dedup_key = $1 AND status NOT IN ('resolved')`,
          [dedupKey]
        )
        if (existing.rows.length > 0) continue

        const slaDeadline = new Date(Date.now() + (rule.cooldown_minutes || 120) * 60 * 1000)
        const alertResult = await pool.query(
          `INSERT INTO ${SCHEMA}alerts (tenant_id, alert_rule_id, asset_id, alert_type, severity, status, title, description, dedup_key, sla_deadline)
           VALUES ($1, $2, $3, 'arrival_overdue', $4, 'new', $5, $6, $7, $8) RETURNING *`,
          [trip.tenant_id, rule.id, trip.asset_id, rule.severity,
           `Arrival Overdue - ${trip.asset_name || 'Unknown Asset'}`,
           `Trip departed at ${trip.departed_at} has not yet arrived at destination.`,
           dedupKey, slaDeadline]
        )

        await pool.query(
          `INSERT INTO ${SCHEMA}alert_history (alert_id, from_status, to_status, comment) VALUES ($1, NULL, 'new', 'Alert created by overdue check')`,
          [alertResult.rows[0].id]
        )
        alertsCreated.push(toCamelCase(alertResult.rows[0]))
      }
    }

    res.json({ success: true, data: { overdueTrips: overdueTrips.rows.length, alertsCreated: alertsCreated.length, alerts: alertsCreated } })
  } catch (error) {
    console.error('Error checking overdue:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// --- NOTIFICATION ENDPOINTS ---

// GET /api/notifications - List notifications
app.get('/api/notifications', async (req, res) => {
  try {
    const { is_read, limit: lim, user_id } = req.query
    let query = `
      SELECT n.*, al.title as alert_title, al.severity as alert_severity
      FROM ${SCHEMA}notifications n
      LEFT JOIN ${SCHEMA}alerts al ON n.alert_id = al.id
      WHERE 1=1
    `
    const params = []
    let paramCount = 0

    if (user_id) {
      paramCount++
      query += ` AND (n.user_id = $${paramCount} OR n.user_id IS NULL)`
      params.push(user_id)
    }
    if (is_read !== undefined) {
      paramCount++
      query += ` AND n.is_read = $${paramCount}`
      params.push(is_read === 'true')
    }

    query += ' ORDER BY n.created_at DESC'

    if (lim) {
      paramCount++
      query += ` LIMIT $${paramCount}`
      params.push(parseInt(lim))
    }

    const result = await pool.query(query, params)
    res.json({ success: true, data: toCamelCase(result.rows) })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// GET /api/notifications/unread-count - Unread count
app.get('/api/notifications/unread-count', async (req, res) => {
  try {
    const { user_id } = req.query
    let query = `SELECT COUNT(*) as count FROM ${SCHEMA}notifications WHERE is_read = false`
    const params = []
    if (user_id) {
      query += ` AND (user_id = $1 OR user_id IS NULL)`
      params.push(user_id)
    }
    const result = await pool.query(query, params)
    res.json({ success: true, data: { count: parseInt(result.rows[0]?.count) || 0 } })
  } catch (error) {
    console.error('Error fetching unread count:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// PUT /api/notifications/:id/read - Mark single notification read
app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE ${SCHEMA}notifications SET is_read = true WHERE id = $1 RETURNING *`,
      [req.params.id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Notification not found' })
    }
    res.json({ success: true, data: toCamelCase(result.rows[0]) })
  } catch (error) {
    console.error('Error marking notification read:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// PUT /api/notifications/read-all - Mark all notifications read
app.put('/api/notifications/read-all', async (req, res) => {
  try {
    const { user_id } = req.body
    let query = `UPDATE ${SCHEMA}notifications SET is_read = true WHERE is_read = false`
    const params = []
    if (user_id) {
      query += ` AND (user_id = $1 OR user_id IS NULL)`
      params.push(user_id)
    }
    const result = await pool.query(query, params)
    res.json({ success: true, data: { updated: result.rowCount } })
  } catch (error) {
    console.error('Error marking all read:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// GET /api/notifications/preferences - Get notification preferences
app.get('/api/notifications/preferences', async (req, res) => {
  try {
    const { user_id, tenant_id } = req.query
    const result = await pool.query(
      `SELECT * FROM ${SCHEMA}notification_preferences WHERE (user_id = $1 OR user_id IS NULL) AND (tenant_id = $2 OR tenant_id IS NULL)`,
      [user_id || null, tenant_id || null]
    )
    res.json({ success: true, data: toCamelCase(result.rows) })
  } catch (error) {
    console.error('Error fetching preferences:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// PUT /api/notifications/preferences - Upsert notification preference
app.put('/api/notifications/preferences', async (req, res) => {
  try {
    const { tenantId, userId, alertType, channel, isEnabled, digestFrequency } = req.body
    const result = await pool.query(
      `INSERT INTO ${SCHEMA}notification_preferences (tenant_id, user_id, alert_type, channel, is_enabled, digest_frequency)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, user_id, alert_type, channel) DO UPDATE SET is_enabled = $5, digest_frequency = $6, updated_at = NOW()
       RETURNING *`,
      [tenantId || null, userId || null, alertType, channel || 'in_app', isEnabled !== false, digestFrequency || 'immediate']
    )
    res.json({ success: true, data: toCamelCase(result.rows[0]) })
  } catch (error) {
    console.error('Error upserting preference:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// ============================================================================
// SPRINT 5: BULK OPERATIONS (FR-802 to FR-805)
// ============================================================================

// Helper: derive rule_scope from trigger type
function deriveRuleScope(triggerType) {
  const deviceTriggers = ['low_battery', 'no_report', 'signal_strength', 'firmware_update']
  return deviceTriggers.includes(triggerType) ? 'device' : 'asset'
}

// POST /api/bulk/device-asset-association — validate CSV rows (JSON body)
app.post('/api/bulk/device-asset-association', async (req, res) => {
  try {
    const { rows, createdBy } = req.body
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'rows array is required and must not be empty' })
    }

    const validationResults = []
    let validCount = 0
    let invalidCount = 0
    let skippedCount = 0

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const item = { rowNumber: i + 1, deviceId: row.deviceId, assetId: row.assetId, status: 'valid', errors: [] }

      // Validate device exists
      if (!row.deviceId) {
        item.errors.push('deviceId is required')
      } else {
        const deviceResult = await pool.query(
          `SELECT id FROM ${SCHEMA}devices WHERE id = $1`, [row.deviceId]
        )
        if (deviceResult.rows.length === 0) {
          item.errors.push(`Device ${row.deviceId} not found`)
        }
      }

      // Validate asset exists
      if (!row.assetId) {
        item.errors.push('assetId is required')
      } else {
        const assetResult = await pool.query(
          `SELECT id, device_id FROM ${SCHEMA}assets WHERE id = $1 AND deleted_at IS NULL`, [row.assetId]
        )
        if (assetResult.rows.length === 0) {
          item.errors.push(`Asset ${row.assetId} not found`)
        } else if (assetResult.rows[0].device_id === row.deviceId) {
          item.status = 'skipped'
          item.errors.push('Already associated')
          skippedCount++
          validationResults.push(item)
          continue
        }
      }

      if (item.errors.length > 0 && item.status !== 'skipped') {
        item.status = 'invalid'
        invalidCount++
      } else if (item.status !== 'skipped') {
        validCount++
      }

      validationResults.push(item)
    }

    // Create the batch in validated state
    const batchResult = await pool.query(
      `INSERT INTO ${SCHEMA}bulk_operations (entity_type, status, total_items, created_by, metadata)
       VALUES ('device_asset_association', 'validated', $1, $2, $3) RETURNING *`,
      [rows.length, createdBy || 'system', JSON.stringify({ source: 'csv_upload' })]
    )
    const batch = batchResult.rows[0]

    // Store validation items
    for (const item of validationResults) {
      await pool.query(
        `INSERT INTO ${SCHEMA}bulk_operation_items (bulk_operation_id, row_number, device_id, asset_id, status, error_message)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [batch.id, item.rowNumber, item.deviceId || null, item.assetId || null,
         item.status === 'valid' ? 'pending' : item.status === 'skipped' ? 'skipped' : 'error',
         item.errors.length > 0 ? item.errors.join('; ') : null]
      )
    }

    res.json({
      success: true,
      data: {
        batchId: batch.id,
        totalItems: rows.length,
        validCount,
        invalidCount,
        skippedCount,
        items: validationResults
      }
    })
  } catch (error) {
    console.error('Error validating bulk association:', error)
    res.status(500).json({ success: false, error: 'Validation error: ' + error.message })
  }
})

// POST /api/bulk/:batchId/confirm — start processing
app.post('/api/bulk/:batchId/confirm', async (req, res) => {
  try {
    const { batchId } = req.params
    const { performedBy } = req.body

    // Verify batch exists and is in validated state
    const batchResult = await pool.query(
      `SELECT * FROM ${SCHEMA}bulk_operations WHERE id = $1`, [batchId]
    )
    if (batchResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Batch not found' })
    }
    const batch = batchResult.rows[0]
    if (batch.status !== 'validated') {
      return res.status(400).json({ success: false, error: `Batch is in ${batch.status} state, expected validated` })
    }

    // Set to processing
    await pool.query(
      `UPDATE ${SCHEMA}bulk_operations SET status = 'processing', undo_deadline = NOW() + INTERVAL '24 hours', updated_at = NOW() WHERE id = $1`,
      [batchId]
    )

    // Get pending items
    const itemsResult = await pool.query(
      `SELECT * FROM ${SCHEMA}bulk_operation_items WHERE bulk_operation_id = $1 AND status = 'pending' ORDER BY row_number`,
      [batchId]
    )

    let successCount = 0
    let errorCount = 0
    let processedCount = 0
    const skippedResult = await pool.query(
      `SELECT COUNT(*) as cnt FROM ${SCHEMA}bulk_operation_items WHERE bulk_operation_id = $1 AND status = 'skipped'`, [batchId]
    )
    const skippedCount = parseInt(skippedResult.rows[0].cnt)

    for (const item of itemsResult.rows) {
      processedCount++
      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        // FR-804: One-to-one enforcement with swap support
        // Check if device is already associated with another asset
        const existingAssoc = await client.query(
          `SELECT id, device_id FROM ${SCHEMA}assets WHERE device_id = $1 AND deleted_at IS NULL AND id != $2`,
          [item.device_id, item.asset_id]
        )

        let previousAssetId = null
        if (existingAssoc.rows.length > 0) {
          // Dissociate from old asset first (swap)
          previousAssetId = existingAssoc.rows[0].id
          await client.query(
            `UPDATE ${SCHEMA}assets SET device_id = NULL, updated_at = NOW() WHERE id = $1`,
            [previousAssetId]
          )
          // Log the dissociation
          await client.query(
            `INSERT INTO ${SCHEMA}device_asset_association_log (device_id, asset_id, action, previous_asset_id, performed_by, bulk_operation_id)
             VALUES ($1, $2, 'dissociate', $3, $4, $5)`,
            [item.device_id, previousAssetId, null, performedBy || 'system', batchId]
          )
        }

        // Check what device the target asset currently has
        const targetAsset = await client.query(
          `SELECT device_id FROM ${SCHEMA}assets WHERE id = $1 AND deleted_at IS NULL`, [item.asset_id]
        )
        const previousDeviceId = targetAsset.rows.length > 0 ? targetAsset.rows[0].device_id : null

        // Associate device to asset
        await client.query(
          `UPDATE ${SCHEMA}assets SET device_id = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL`,
          [item.device_id, item.asset_id]
        )

        // Log the association
        await client.query(
          `INSERT INTO ${SCHEMA}device_asset_association_log (device_id, asset_id, action, previous_device_id, performed_by, bulk_operation_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [item.device_id, item.asset_id, previousAssetId ? 'swap' : 'associate',
           previousDeviceId, performedBy || 'system', batchId]
        )

        // Update item with previous state for undo
        await client.query(
          `UPDATE ${SCHEMA}bulk_operation_items SET status = 'success', previous_device_id = $1, previous_asset_id = $2 WHERE id = $3`,
          [previousDeviceId, previousAssetId, item.id]
        )

        await client.query('COMMIT')
        successCount++
      } catch (itemError) {
        await client.query('ROLLBACK')
        errorCount++
        await pool.query(
          `UPDATE ${SCHEMA}bulk_operation_items SET status = 'error', error_message = $1 WHERE id = $2`,
          [itemError.message, item.id]
        )
      } finally {
        client.release()
      }

      // Update progress
      await pool.query(
        `UPDATE ${SCHEMA}bulk_operations SET processed_items = $1, success_count = $2, error_count = $3, skipped_count = $4, updated_at = NOW() WHERE id = $5`,
        [processedCount, successCount, errorCount, skippedCount, batchId]
      )
    }

    // Mark as completed
    const finalErrorResult = await pool.query(
      `SELECT COUNT(*) as cnt FROM ${SCHEMA}bulk_operation_items WHERE bulk_operation_id = $1 AND status = 'error'`, [batchId]
    )
    const totalErrors = parseInt(finalErrorResult.rows[0].cnt)

    await pool.query(
      `UPDATE ${SCHEMA}bulk_operations SET status = $1, processed_items = total_items, success_count = $2, error_count = $3, skipped_count = $4, updated_at = NOW() WHERE id = $5`,
      [totalErrors === itemsResult.rows.length ? 'failed' : 'completed',
       successCount, totalErrors, skippedCount, batchId]
    )

    const finalBatch = await pool.query(`SELECT * FROM ${SCHEMA}bulk_operations WHERE id = $1`, [batchId])
    res.json({ success: true, data: toCamelCase(finalBatch.rows[0]) })
  } catch (error) {
    console.error('Error confirming bulk operation:', error)
    // Mark batch as failed
    await pool.query(
      `UPDATE ${SCHEMA}bulk_operations SET status = 'failed', updated_at = NOW() WHERE id = $1`, [req.params.batchId]
    ).catch(() => {})
    res.status(500).json({ success: false, error: 'Processing error: ' + error.message })
  }
})

// POST /api/bulk/:batchId/cancel — cancel validated batch
app.post('/api/bulk/:batchId/cancel', async (req, res) => {
  try {
    const { batchId } = req.params
    const result = await pool.query(
      `UPDATE ${SCHEMA}bulk_operations SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND status = 'validated' RETURNING *`,
      [batchId]
    )
    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Batch not found or not in validated state' })
    }
    res.json({ success: true, data: toCamelCase(result.rows[0]) })
  } catch (error) {
    console.error('Error cancelling batch:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// GET /api/bulk/:batchId/status — get progress
app.get('/api/bulk/:batchId/status', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM ${SCHEMA}bulk_operations WHERE id = $1`, [req.params.batchId]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Batch not found' })
    }
    res.json({ success: true, data: toCamelCase(result.rows[0]) })
  } catch (error) {
    console.error('Error fetching batch status:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// GET /api/bulk/:batchId/items — get row-level results
app.get('/api/bulk/:batchId/items', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM ${SCHEMA}bulk_operation_items WHERE bulk_operation_id = $1 ORDER BY row_number`,
      [req.params.batchId]
    )
    res.json({ success: true, data: toCamelCase(result.rows) })
  } catch (error) {
    console.error('Error fetching batch items:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// GET /api/bulk — list all batches
app.get('/api/bulk', async (req, res) => {
  try {
    const { status, limit } = req.query
    let query = `SELECT * FROM ${SCHEMA}bulk_operations`
    const params = []
    let paramCount = 0

    if (status) {
      paramCount++
      query += ` WHERE status = $${paramCount}`
      params.push(status)
    }

    query += ' ORDER BY created_at DESC'

    if (limit) {
      paramCount++
      query += ` LIMIT $${paramCount}`
      params.push(parseInt(limit))
    }

    const result = await pool.query(query, params)
    res.json({ success: true, data: toCamelCase(result.rows) })
  } catch (error) {
    console.error('Error listing batches:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// POST /api/bulk/:batchId/undo — rollback within 24h
app.post('/api/bulk/:batchId/undo', async (req, res) => {
  try {
    const { batchId } = req.params
    const { performedBy } = req.body

    const batchResult = await pool.query(
      `SELECT * FROM ${SCHEMA}bulk_operations WHERE id = $1`, [batchId]
    )
    if (batchResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Batch not found' })
    }

    const batch = batchResult.rows[0]
    if (batch.status !== 'completed') {
      return res.status(400).json({ success: false, error: 'Only completed batches can be undone' })
    }
    if (batch.undo_deadline && new Date(batch.undo_deadline) < new Date()) {
      return res.status(400).json({ success: false, error: 'Undo window has expired (24h limit)' })
    }

    // Get successful items to undo
    const itemsResult = await pool.query(
      `SELECT * FROM ${SCHEMA}bulk_operation_items WHERE bulk_operation_id = $1 AND status = 'success' ORDER BY row_number DESC`,
      [batchId]
    )

    let undoneCount = 0
    for (const item of itemsResult.rows) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        // Restore asset's previous device (or null)
        await client.query(
          `UPDATE ${SCHEMA}assets SET device_id = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL`,
          [item.previous_device_id, item.asset_id]
        )

        // If there was a previous asset that was swapped, restore it
        if (item.previous_asset_id) {
          await client.query(
            `UPDATE ${SCHEMA}assets SET device_id = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL`,
            [item.device_id, item.previous_asset_id]
          )
        }

        // Log the undo
        await client.query(
          `INSERT INTO ${SCHEMA}device_asset_association_log (device_id, asset_id, action, previous_device_id, performed_by, bulk_operation_id, metadata)
           VALUES ($1, $2, 'dissociate', $3, $4, $5, '{"reason": "bulk_undo"}')`,
          [item.device_id, item.asset_id, item.previous_device_id, performedBy || 'system', batchId]
        )

        await client.query(
          `UPDATE ${SCHEMA}bulk_operation_items SET status = 'undone' WHERE id = $1`, [item.id]
        )

        await client.query('COMMIT')
        undoneCount++
      } catch (undoError) {
        await client.query('ROLLBACK')
        console.error(`Error undoing item ${item.id}:`, undoError)
      } finally {
        client.release()
      }
    }

    await pool.query(
      `UPDATE ${SCHEMA}bulk_operations SET status = 'undone', updated_at = NOW() WHERE id = $1`, [batchId]
    )

    res.json({ success: true, data: { batchId, undoneCount, totalItems: itemsResult.rows.length } })
  } catch (error) {
    console.error('Error undoing batch:', error)
    res.status(500).json({ success: false, error: 'Undo error: ' + error.message })
  }
})

// GET /api/association-log — list device-asset association audit log
app.get('/api/association-log', async (req, res) => {
  try {
    const { device_id, asset_id, limit } = req.query
    let query = `SELECT * FROM ${SCHEMA}device_asset_association_log WHERE 1=1`
    const params = []
    let paramCount = 0

    if (device_id) {
      paramCount++
      query += ` AND device_id = $${paramCount}`
      params.push(device_id)
    }
    if (asset_id) {
      paramCount++
      query += ` AND asset_id = $${paramCount}`
      params.push(asset_id)
    }

    query += ' ORDER BY created_at DESC'

    if (limit) {
      paramCount++
      query += ` LIMIT $${paramCount}`
      params.push(parseInt(limit))
    } else {
      query += ' LIMIT 100'
    }

    const result = await pool.query(query, params)
    res.json({ success: true, data: toCamelCase(result.rows) })
  } catch (error) {
    console.error('Error fetching association log:', error)
    res.status(500).json({ success: false, error: 'Database error' })
  }
})

// PUT /api/devices/:id/location — update device position + propagate to asset (FR-805)
app.put('/api/devices/:id/location', async (req, res) => {
  try {
    const { id } = req.params
    const { latitude, longitude } = req.body

    if (latitude == null || longitude == null) {
      return res.status(400).json({ success: false, error: 'latitude and longitude are required' })
    }

    // Update device location
    const deviceResult = await pool.query(
      `UPDATE ${SCHEMA}devices SET latitude = $1, longitude = $2, last_seen = NOW(), updated_at = NOW() WHERE id = $3 RETURNING *`,
      [latitude, longitude, id]
    )
    if (deviceResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Device not found' })
    }

    // FR-805: Propagate location to associated asset
    const assetResult = await pool.query(
      `SELECT id, metadata FROM ${SCHEMA}assets WHERE device_id = $1 AND deleted_at IS NULL`, [id]
    )

    let updatedAsset = null
    if (assetResult.rows.length > 0) {
      const asset = assetResult.rows[0]
      const metadata = asset.metadata || {}
      metadata.location = { latitude, longitude, updatedAt: new Date().toISOString() }

      const updateResult = await pool.query(
        `UPDATE ${SCHEMA}assets SET metadata = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [JSON.stringify(metadata), asset.id]
      )
      updatedAsset = updateResult.rows[0]
    }

    res.json({
      success: true,
      data: {
        device: toCamelCase(deviceResult.rows[0]),
        asset: updatedAsset ? toCamelCase(updatedAsset) : null,
        locationInherited: !!updatedAsset
      }
    })
  } catch (error) {
    console.error('Error updating device location:', error)
    res.status(500).json({ success: false, error: 'Database error: ' + error.message })
  }
})

// ============================================================================
// SPRINT 6: NLQ DASHBOARD + BOB SUPPORT CHAT
// ============================================================================

// --- NLQ Schema Metadata for Claude ---
const NLQ_SCHEMA_METADATA = {
  devices: {
    table: 'devices',
    columns: ['id', 'name', 'status', 'device_type_id', 'location_id', 'sim_card_id', 'signal_strength', 'data_usage_mb', 'connection_type', 'latitude', 'longitude', 'temperature', 'humidity', 'light', 'battery_level', 'health_status', 'security_status', 'last_seen', 'created_at', 'updated_at'],
    enums: { status: ['active', 'offline', 'maintenance'], connection_type: ['wifi', 'cellular', 'ethernet', 'lora', 'satellite'], health_status: ['healthy', 'degraded', 'critical'], security_status: ['secure', 'warning', 'compromised'] }
  },
  sim_cards: {
    table: 'sim_cards',
    columns: ['id', 'iccid', 'imsi', 'msisdn', 'status', 'carrier_id', 'plan_id', 'data_usage_bytes', 'data_limit_bytes', 'activation_date', 'expiry_date', 'created_at', 'updated_at'],
    enums: { status: ['Active', 'Inactive', 'Suspended', 'Expired'] }
  },
  assets: {
    table: 'assets',
    columns: ['id', 'name', 'asset_type', 'status', 'device_id', 'tenant_id', 'description', 'metadata', 'created_at', 'updated_at', 'deleted_at'],
    enums: { status: ['active', 'inactive', 'maintenance', 'retired'], asset_type: ['vehicle', 'container', 'equipment', 'building', 'other'] }
  },
  geozones: {
    table: 'geozones',
    columns: ['id', 'name', 'type', 'status', 'tenant_id', 'description', 'geometry', 'metadata', 'created_at', 'updated_at', 'deleted_at'],
    enums: { type: ['circle', 'polygon', 'rectangle'], status: ['active', 'inactive'] }
  },
  alerts: {
    table: 'alerts',
    columns: ['id', 'rule_id', 'device_id', 'asset_id', 'severity', 'status', 'tenant_id', 'title', 'message', 'triggered_at', 'acknowledged_at', 'resolved_at', 'created_at'],
    enums: { severity: ['critical', 'high', 'medium', 'low', 'info'], status: ['active', 'acknowledged', 'resolved', 'expired'] }
  },
  alert_rules: {
    table: 'alert_rules',
    columns: ['id', 'name', 'description', 'trigger_type', 'condition_config', 'severity', 'status', 'tenant_id', 'rule_scope', 'created_at', 'updated_at', 'deleted_at'],
    enums: { severity: ['critical', 'high', 'medium', 'low', 'info'], status: ['active', 'inactive', 'draft'], rule_scope: ['device', 'asset', 'both'] }
  },
  notifications: {
    table: 'notifications',
    columns: ['id', 'user_id', 'tenant_id', 'title', 'message', 'type', 'severity', 'is_read', 'alert_id', 'created_at'],
    enums: { type: ['alert', 'system', 'info'], severity: ['critical', 'high', 'medium', 'low', 'info'] }
  }
}

const ENTITY_TABLE_MAP = {
  devices: 'devices',
  sim_cards: 'sim_cards',
  assets: 'assets',
  geozones: 'geozones',
  alerts: 'alerts',
  alert_rules: 'alert_rules',
  notifications: 'notifications'
}

// Soft-delete tables
const SOFT_DELETE_TABLES = ['assets', 'geozones', 'alert_rules']

// NLQ System prompt
function buildNlqSystemPrompt() {
  const schemaDesc = Object.entries(NLQ_SCHEMA_METADATA).map(([entity, meta]) => {
    const enumDesc = Object.entries(meta.enums || {}).map(([col, vals]) => `    ${col}: ${vals.join(', ')}`).join('\n')
    return `  ${entity} (table: ${meta.table}):\n    columns: ${meta.columns.join(', ')}\n    enums:\n${enumDesc}`
  }).join('\n\n')

  return `You are an NLQ (Natural Language Query) parser for the IoTo Fleet Management Platform.
Your job is to convert natural language queries into a structured JSON intent.

Available entities and their schemas:
${schemaDesc}

You MUST respond with ONLY valid JSON in this exact format:
{
  "entity": "<one of: devices, sim_cards, assets, geozones, alerts, alert_rules, notifications>",
  "filters": [{"field": "<column_name>", "operator": "<eq|neq|gt|gte|lt|lte|like|in|between>", "value": "<value or array>"}],
  "sort": [{"field": "<column_name>", "direction": "<asc|desc>"}],
  "aggregations": [{"function": "<count|sum|avg|min|max>", "field": "<column_name or omit for count(*)>", "alias": "<label>"}],
  "timeRange": {"field": "<date column>", "start": "<ISO date>", "end": "<ISO date>", "relative": "<e.g. last 7 days>"},
  "limit": <number, default 50>,
  "explanation": "<brief explanation of the parsed intent>"
}

Rules:
- Only use columns that exist in the schema above
- Default to devices entity if ambiguous
- Default sort by created_at DESC if no sort specified
- Default limit to 50 if not specified
- For text searches, use the "like" operator with the search term
- For status queries, use exact enum values from the schema
- Interpret "offline" as status = 'offline', "active" as status = 'active', etc.
- Current date: ${new Date().toISOString().split('T')[0]}
- Respond with ONLY the JSON object, no markdown or explanation outside the JSON`
}

// Parse NLQ query via Claude
async function parseNlqQuery(queryText) {
  if (!anthropic) throw new Error('LLM service not configured')

  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: buildNlqSystemPrompt(),
    messages: [{ role: 'user', content: queryText }]
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock) throw new Error('No response from LLM')

  // Extract JSON from response (handle potential markdown wrapping)
  let jsonStr = textBlock.text.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  const intent = JSON.parse(jsonStr)

  // Validate entity
  if (!ENTITY_TABLE_MAP[intent.entity]) {
    throw new Error(`Invalid entity: ${intent.entity}`)
  }

  return intent
}

// Execute NLQ intent as parameterized SQL with guardrails
function executeNlqIntent(intent, tenantId) {
  const entityMeta = NLQ_SCHEMA_METADATA[intent.entity]
  if (!entityMeta) throw new Error(`Unknown entity: ${intent.entity}`)

  const tableName = SCHEMA + entityMeta.table
  const allowedColumns = new Set(entityMeta.columns)
  const params = []
  let paramIdx = 0

  // Build SELECT
  let selectClause = '*'
  if (intent.aggregations && intent.aggregations.length > 0) {
    const aggParts = intent.aggregations.map(agg => {
      if (agg.field && !allowedColumns.has(agg.field)) return null
      const col = agg.field || '*'
      const alias = agg.alias || `${agg.function}_result`
      return `${agg.function}(${col}) AS "${alias}"`
    }).filter(Boolean)
    if (aggParts.length > 0) selectClause = aggParts.join(', ')
  }

  // Build WHERE conditions
  const conditions = []

  // Mandatory tenant scoping for tables that have tenant_id
  if (entityMeta.columns.includes('tenant_id') && tenantId) {
    paramIdx++
    conditions.push(`tenant_id = $${paramIdx}`)
    params.push(tenantId)
  }

  // Soft delete filter
  if (SOFT_DELETE_TABLES.includes(intent.entity)) {
    conditions.push('deleted_at IS NULL')
  }

  // User filters
  if (intent.filters && Array.isArray(intent.filters)) {
    for (const filter of intent.filters) {
      if (!allowedColumns.has(filter.field)) continue // Skip invalid columns

      switch (filter.operator) {
        case 'eq':
          paramIdx++
          conditions.push(`${filter.field} = $${paramIdx}`)
          params.push(filter.value)
          break
        case 'neq':
          paramIdx++
          conditions.push(`${filter.field} != $${paramIdx}`)
          params.push(filter.value)
          break
        case 'gt':
          paramIdx++
          conditions.push(`${filter.field} > $${paramIdx}`)
          params.push(filter.value)
          break
        case 'gte':
          paramIdx++
          conditions.push(`${filter.field} >= $${paramIdx}`)
          params.push(filter.value)
          break
        case 'lt':
          paramIdx++
          conditions.push(`${filter.field} < $${paramIdx}`)
          params.push(filter.value)
          break
        case 'lte':
          paramIdx++
          conditions.push(`${filter.field} <= $${paramIdx}`)
          params.push(filter.value)
          break
        case 'like':
          paramIdx++
          conditions.push(`${filter.field}::text ILIKE $${paramIdx}`)
          params.push(`%${filter.value}%`)
          break
        case 'in':
          if (Array.isArray(filter.value)) {
            const placeholders = filter.value.map(() => { paramIdx++; return `$${paramIdx}` })
            conditions.push(`${filter.field} IN (${placeholders.join(', ')})`)
            params.push(...filter.value)
          }
          break
        case 'between':
          if (Array.isArray(filter.value) && filter.value.length === 2) {
            paramIdx++
            conditions.push(`${filter.field} >= $${paramIdx}`)
            params.push(filter.value[0])
            paramIdx++
            conditions.push(`${filter.field} <= $${paramIdx}`)
            params.push(filter.value[1])
          }
          break
      }
    }
  }

  // Time range filter
  if (intent.timeRange) {
    const tf = intent.timeRange.field
    if (allowedColumns.has(tf)) {
      if (intent.timeRange.start) {
        paramIdx++
        conditions.push(`${tf} >= $${paramIdx}`)
        params.push(intent.timeRange.start)
      }
      if (intent.timeRange.end) {
        paramIdx++
        conditions.push(`${tf} <= $${paramIdx}`)
        params.push(intent.timeRange.end)
      }
      if (intent.timeRange.relative) {
        // Parse relative time ranges
        const match = intent.timeRange.relative.match(/last\s+(\d+)\s+(day|week|month|hour|year)s?/i)
        if (match) {
          const num = parseInt(match[1])
          const unit = match[2].toLowerCase()
          paramIdx++
          conditions.push(`${tf} >= NOW() - INTERVAL '${num} ${unit}s'`)
        }
      }
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // Build ORDER BY
  let orderClause = 'ORDER BY created_at DESC'
  if (intent.sort && intent.sort.length > 0) {
    const sortParts = intent.sort
      .filter(s => allowedColumns.has(s.field))
      .map(s => `${s.field} ${s.direction === 'asc' ? 'ASC' : 'DESC'}`)
    if (sortParts.length > 0) orderClause = `ORDER BY ${sortParts.join(', ')}`
  }

  // Limit (hard cap at 500)
  const limit = Math.min(intent.limit || 50, 500)

  // Build GROUP BY for aggregations
  let groupClause = ''
  if (intent.aggregations && intent.aggregations.length > 0) {
    // If there are non-aggregated filters, no order/limit needed for aggregations
    orderClause = ''
  }

  const sql = `SELECT ${selectClause} FROM ${tableName} ${whereClause} ${groupClause} ${orderClause} LIMIT ${limit}`.replace(/\s+/g, ' ').trim()

  return { sql, params }
}

// Audit log helper (non-blocking)
function logNlqQuery(data) {
  const { tenantId, userId, queryText, parsedIntent, generatedSql, resultCount, status, errorMessage, executionTimeMs, modelUsed } = data
  pool.query(
    `INSERT INTO ${SCHEMA}nlq_query_log (tenant_id, user_id, query_text, parsed_intent, generated_sql, result_count, status, error_message, execution_time_ms, model_used) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [tenantId || 'default', userId || 'anonymous', queryText, parsedIntent ? JSON.stringify(parsedIntent) : null, generatedSql, resultCount, status, errorMessage, executionTimeMs, modelUsed]
  ).catch(err => console.error('[NLQ Audit] Failed to log:', err.message))
}

// POST /api/nlq/query - NLQ query endpoint
app.post('/api/nlq/query', async (req, res) => {
  const startTime = Date.now()
  const { query } = req.body
  const userId = req.headers['x-user-id'] || 'anonymous'
  const tenantId = req.headers['x-tenant-id'] || 'default'

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ success: false, error: 'Query string is required' })
  }

  if (query.length > 500) {
    return res.status(400).json({ success: false, error: 'Query must be 500 characters or less' })
  }

  if (!anthropic) {
    return res.status(503).json({ success: false, error: 'LLM service not configured' })
  }

  const clientId = req.ip || 'anonymous'
  if (!checkLlmRateLimit(clientId)) {
    return res.status(429).json({ success: false, error: 'Rate limit exceeded. Please try again shortly.' })
  }

  try {
    // Step 1: Parse natural language → structured intent
    const intent = await parseNlqQuery(query)
    console.log('[NLQ] Parsed intent:', JSON.stringify(intent))

    // Step 2: Intent → parameterized SQL
    const { sql, params } = executeNlqIntent(intent, tenantId)
    console.log('[NLQ] Generated SQL:', sql, 'Params:', params)

    // Step 3: Execute query
    const result = await pool.query(sql, params)
    const executionTimeMs = Date.now() - startTime

    // Step 4: Audit log (non-blocking)
    logNlqQuery({
      tenantId, userId, queryText: query, parsedIntent: intent,
      generatedSql: sql, resultCount: result.rows.length,
      status: 'success', executionTimeMs,
      modelUsed: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'
    })

    res.json({
      success: true,
      data: {
        intent,
        results: toCamelCase(result.rows),
        totalCount: result.rows.length,
        executionTimeMs,
        explanation: intent.explanation || 'Query executed successfully'
      }
    })
  } catch (error) {
    const executionTimeMs = Date.now() - startTime
    console.error('[NLQ] Error:', error.message)

    logNlqQuery({
      tenantId, userId, queryText: query,
      status: 'error', errorMessage: error.message, executionTimeMs,
      modelUsed: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'
    })

    res.status(500).json({
      success: false,
      error: 'Failed to process query: ' + error.message
    })
  }
})

// ============================================================================
// CHAT CONVERSATIONS API
// ============================================================================

// Chat system prompt builder
function buildChatSystemPrompt(userContext) {
  return `You are Bob, the AI support assistant for the IoTo Fleet Management Platform (FMP).

About IoTo FMP:
- IoTo is an IoT fleet management platform for managing devices, SIM cards, assets, geozones, alerts, and consumption analytics.
- Users can monitor device health, track assets, set up geofenced alerts, manage SIM card connectivity, and analyze data consumption.
- The platform supports multiple user roles: Super Admin, Admin, FMP, DMP (Device Management), CMP (Connectivity Management), and Viewer.

Your capabilities:
- Answer questions about the platform features and how to use them
- Help troubleshoot issues with devices, SIM cards, and connectivity
- Explain alert rules, geozones, and bulk operations
- Provide general IoT fleet management guidance
- Help interpret data and consumption patterns

User context:
- Name: ${userContext?.name || 'Unknown'}
- Role: ${userContext?.role || 'User'}

Guidelines:
- Be concise, friendly, and professional
- If you don't know something specific about the user's data, say so
- Never reveal internal system details, database schemas, or API endpoints
- If asked about actions you can't perform, suggest using the appropriate portal page
- Format responses with markdown for readability when helpful`
}

// GET /api/chat/conversations - List conversations
app.get('/api/chat/conversations', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.query.userId || 'anonymous'
    const tenantId = req.headers['x-tenant-id'] || 'default'

    const result = await pool.query(
      `SELECT * FROM ${SCHEMA}chat_conversations WHERE user_id = $1 AND tenant_id = $2 AND is_active = true ORDER BY updated_at DESC`,
      [userId, tenantId]
    )

    res.json({ success: true, data: toCamelCase(result.rows) })
  } catch (error) {
    console.error('[Chat] Error listing conversations:', error.message)
    res.status(500).json({ success: false, error: 'Failed to list conversations' })
  }
})

// POST /api/chat/conversations - Create conversation
app.post('/api/chat/conversations', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.body.userId || 'anonymous'
    const tenantId = req.headers['x-tenant-id'] || 'default'
    const { title } = req.body

    const result = await pool.query(
      `INSERT INTO ${SCHEMA}chat_conversations (user_id, tenant_id, title) VALUES ($1, $2, $3) RETURNING *`,
      [userId, tenantId, title || 'New Conversation']
    )

    res.json({ success: true, data: toCamelCase(result.rows[0]) })
  } catch (error) {
    console.error('[Chat] Error creating conversation:', error.message)
    res.status(500).json({ success: false, error: 'Failed to create conversation' })
  }
})

// GET /api/chat/conversations/:id/messages - Get messages
app.get('/api/chat/conversations/:id/messages', async (req, res) => {
  try {
    const { id } = req.params

    const result = await pool.query(
      `SELECT * FROM ${SCHEMA}chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 200`,
      [id]
    )

    res.json({ success: true, data: toCamelCase(result.rows) })
  } catch (error) {
    console.error('[Chat] Error fetching messages:', error.message)
    res.status(500).json({ success: false, error: 'Failed to fetch messages' })
  }
})

// POST /api/chat/conversations/:id/messages - Send message
app.post('/api/chat/conversations/:id/messages', async (req, res) => {
  try {
    const { id } = req.params
    const { content, userContext } = req.body

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ success: false, error: 'Message content is required' })
    }

    if (content.length > 2000) {
      return res.status(400).json({ success: false, error: 'Message must be 2000 characters or less' })
    }

    if (!anthropic) {
      return res.status(503).json({ success: false, error: 'LLM service not configured' })
    }

    const clientId = req.ip || 'anonymous'
    if (!checkLlmRateLimit(clientId)) {
      return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
    }

    // Verify conversation exists
    const convResult = await pool.query(
      `SELECT * FROM ${SCHEMA}chat_conversations WHERE id = $1 AND is_active = true`,
      [id]
    )
    if (convResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Conversation not found' })
    }

    // Save user message
    await pool.query(
      `INSERT INTO ${SCHEMA}chat_messages (conversation_id, role, content) VALUES ($1, 'user', $2)`,
      [id, content]
    )

    // Load conversation history (last 50 messages for context)
    const historyResult = await pool.query(
      `SELECT role, content FROM ${SCHEMA}chat_messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [id]
    )
    const history = historyResult.rows.reverse()

    // Format for Anthropic API
    const messages = history.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }))

    // Call Claude
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: buildChatSystemPrompt(userContext),
      messages
    })

    const assistantContent = response.content[0]?.text || 'I apologize, but I could not generate a response.'

    // Save assistant message
    const savedMsg = await pool.query(
      `INSERT INTO ${SCHEMA}chat_messages (conversation_id, role, content, metadata) VALUES ($1, 'assistant', $2, $3) RETURNING *`,
      [id, assistantContent, JSON.stringify({ inputTokens: response.usage?.input_tokens, outputTokens: response.usage?.output_tokens })]
    )

    // Update conversation title if first exchange (auto-title)
    const msgCount = history.length
    if (msgCount <= 2) {
      const titleSnippet = content.substring(0, 60) + (content.length > 60 ? '...' : '')
      await pool.query(
        `UPDATE ${SCHEMA}chat_conversations SET title = $1, updated_at = NOW() WHERE id = $2`,
        [titleSnippet, id]
      )
    } else {
      await pool.query(
        `UPDATE ${SCHEMA}chat_conversations SET updated_at = NOW() WHERE id = $1`,
        [id]
      )
    }

    res.json({
      success: true,
      data: toCamelCase(savedMsg.rows[0])
    })
  } catch (error) {
    console.error('[Chat] Error sending message:', error.message)
    res.status(500).json({ success: false, error: 'Failed to send message: ' + error.message })
  }
})

// DELETE /api/chat/conversations/:id - Delete conversation
app.delete('/api/chat/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params

    // Soft delete by marking inactive
    const result = await pool.query(
      `UPDATE ${SCHEMA}chat_conversations SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Conversation not found' })
    }

    res.json({ success: true, data: { deleted: true } })
  } catch (error) {
    console.error('[Chat] Error deleting conversation:', error.message)
    res.status(500).json({ success: false, error: 'Failed to delete conversation' })
  }
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API server running at http://0.0.0.0:${PORT}`)
})
