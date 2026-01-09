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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API server running at http://0.0.0.0:${PORT}`)
})
