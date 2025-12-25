import { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from './lib/supabase.js'
import { getSchemaName } from './lib/db.js'

// Device sensor history interface
export interface DeviceSensorHistory {
  id: string
  deviceId: string
  temperature: number | null
  humidity: number | null
  light: number | null
  recordedAt: string
  batteryLevel?: number | null
  signalStrength?: number | null
  notes?: string | null
  metadata?: Record<string, any> | null
}

// Database interface for device_sensor_history table
interface DatabaseSensorHistory {
  id: string
  device_id: string
  temperature: number | null
  humidity: number | null
  light: number | null
  recorded_at: string
  battery_level?: number | null
  signal_strength?: number | null
  notes?: string | null
  metadata?: Record<string, any> | null
  created_at?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    switch (req.method) {
      case 'GET':
        return await handleGetSensorHistory(req, res)
      case 'POST':
        return await handleCreateSensorRecord(req, res)
      default:
        return res.status(405).json({ success: false, error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Error in device-sensor-history handler:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

async function handleGetSensorHistory(req: VercelRequest, res: VercelResponse) {
  console.log('handleGetSensorHistory called with query:', req.query)
  
  const { device_id, start_date, end_date, limit = '1000' } = req.query

  if (!device_id) {
    return res.status(400).json({
      success: false,
      error: 'device_id is required'
    })
  }

  try {
    let query = supabase
      .schema(getSchemaName())
      .from('device_sensor_history')
      .select('*')
      .eq('device_id', String(device_id))
      .order('recorded_at', { ascending: true })
      .limit(parseInt(String(limit)))

    if (start_date) {
      query = query.gte('recorded_at', start_date)
    }

    if (end_date) {
      query = query.lte('recorded_at', end_date)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching sensor history:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch sensor history'
      })
    }

    // Transform database records to API format
    const sensorHistory: DeviceSensorHistory[] = (data || []).map((record: any) => ({
      id: record.id,
      deviceId: record.device_id,
      temperature: record.temperature,
      humidity: record.humidity,
      light: record.light,
      recordedAt: record.recorded_at,
      batteryLevel: record.battery_level,
      signalStrength: record.signal_strength,
      notes: record.notes,
      metadata: record.metadata
    }))

    console.log(`Found ${sensorHistory.length} sensor history records for device ${device_id}`)

    return res.status(200).json({
      success: true,
      data: sensorHistory
    })
  } catch (error) {
    console.error('Error in handleGetSensorHistory:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

async function handleCreateSensorRecord(req: VercelRequest, res: VercelResponse) {
  console.log('handleCreateSensorRecord called with body:', req.body)
  
  const { deviceId, temperature, humidity, light, recordedAt, batteryLevel, signalStrength, notes, metadata } = req.body

  if (!deviceId) {
    return res.status(400).json({
      success: false,
      error: 'deviceId is required'
    })
  }

  try {
    const dbRecord: Partial<DatabaseSensorHistory> = {
      device_id: deviceId,
      temperature: temperature !== undefined ? temperature : null,
      humidity: humidity !== undefined ? humidity : null,
      light: light !== undefined ? light : null,
      recorded_at: recordedAt || new Date().toISOString(),
      battery_level: batteryLevel,
      signal_strength: signalStrength,
      notes,
      metadata
    }

    const { data, error } = await supabase
      .schema(getSchemaName())
      .from('device_sensor_history')
      .insert(dbRecord as any)
      .select()
      .single()

    if (error) {
      console.error('Error creating sensor record:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to create sensor record'
      })
    }

    // Transform database record to API format
    const sensorRecord: DeviceSensorHistory = {
      id: data.id,
      deviceId: data.device_id,
      temperature: data.temperature,
      humidity: data.humidity,
      light: data.light,
      recordedAt: data.recorded_at,
      batteryLevel: data.battery_level,
      signalStrength: data.signal_strength,
      notes: data.notes,
      metadata: data.metadata as Record<string, any> | null
    }

    console.log('Created sensor record:', sensorRecord.id)

    return res.status(201).json({
      success: true,
      data: sensorRecord
    })
  } catch (error) {
    console.error('Error in handleCreateSensorRecord:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}
