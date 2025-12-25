import { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from './lib/supabase.js'
import { getSchemaName } from './lib/db.js'

// Device location history interface
export interface DeviceLocationHistory {
  id: string
  deviceId: string
  latitude: number
  longitude: number
  altitude?: number | null
  accuracy?: number | null
  speed?: number | null
  heading?: number | null
  recordedAt: string
  locationSource?: string | null
  batteryLevel?: number | null
  signalStrength?: number | null
  notes?: string | null
  metadata?: Record<string, any> | null
}

// Database interface for device_location_history table
interface DatabaseLocationHistory {
  id: string
  device_id: string
  latitude: number
  longitude: number
  altitude?: number | null
  accuracy?: number | null
  speed?: number | null
  heading?: number | null
  recorded_at: string
  location_source?: string | null
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
        return await handleGetLocationHistory(req, res)
      case 'POST':
        return await handleCreateLocationRecord(req, res)
      default:
        return res.status(405).json({ success: false, error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Error in device-location-history handler:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

async function handleGetLocationHistory(req: VercelRequest, res: VercelResponse) {
  console.log('handleGetLocationHistory called with query:', req.query)
  
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
      .from('device_location_history')
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
      console.error('Error fetching location history:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch location history'
      })
    }

    // Convert database format to API format
    const locationHistory: DeviceLocationHistory[] = (data || []).map((record: any) => ({
      id: record.id,
      deviceId: record.device_id,
      latitude: record.latitude,
      longitude: record.longitude,
      altitude: record.altitude,
      accuracy: record.accuracy,
      speed: record.speed,
      heading: record.heading,
      recordedAt: record.recorded_at,
      locationSource: record.location_source,
      batteryLevel: record.battery_level,
      signalStrength: record.signal_strength,
      notes: record.notes,
      metadata: record.metadata
    }))

    return res.status(200).json({
      success: true,
      data: locationHistory,
      count: locationHistory.length
    })
  } catch (error) {
    console.error('Error in handleGetLocationHistory:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

async function handleCreateLocationRecord(req: VercelRequest, res: VercelResponse) {
  console.log('handleCreateLocationRecord called')
  
  try {
    const locationData = req.body

    if (!locationData.deviceId || !locationData.latitude || !locationData.longitude) {
      return res.status(400).json({
        success: false,
        error: 'deviceId, latitude, and longitude are required'
      })
    }

    // Convert API format to database format
    const dbRecord: Partial<DatabaseLocationHistory> = {
      device_id: locationData.deviceId,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      altitude: locationData.altitude,
      accuracy: locationData.accuracy,
      speed: locationData.speed,
      heading: locationData.heading,
      recorded_at: locationData.recordedAt || new Date().toISOString(),
      location_source: locationData.locationSource || 'manual',
      battery_level: locationData.batteryLevel,
      signal_strength: locationData.signalStrength,
      notes: locationData.notes,
      metadata: locationData.metadata
    }

    const { data, error } = await supabase
      .schema(getSchemaName())
      .from('device_location_history')
      .insert(dbRecord as any)
      .select()
      .single()

    if (error) {
      console.error('Error creating location record:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to create location record'
      })
    }

    // Convert database format to API format
    const locationRecord: DeviceLocationHistory = {
      id: data.id,
      deviceId: data.device_id,
      latitude: data.latitude,
      longitude: data.longitude,
      altitude: data.altitude,
      accuracy: data.accuracy,
      speed: data.speed,
      heading: data.heading,
      recordedAt: data.recorded_at,
      locationSource: data.location_source,
      batteryLevel: data.battery_level,
      signalStrength: data.signal_strength,
      notes: data.notes,
      metadata: data.metadata as Record<string, any> | null
    }

    return res.status(201).json({
      success: true,
      data: locationRecord
    })
  } catch (error) {
    console.error('Error in handleCreateLocationRecord:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}
