import { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from './lib/supabase.js'
import type { DatabaseDevice } from './lib/supabase.js'
import { getSchemaName } from './lib/db.js'

// Import types from the main source
import { Device } from '../src/data/mockData.js'

// Helper function to get device type ID by name
async function getDeviceTypeId(name: string): Promise<string | null> {
  if (!name) return null
  const { data, error } = await supabase
    .schema(getSchemaName())
    .from('device_types')
    .select('id')
    .eq('name', name)
    .single()
  
  if (error || !data) {
    console.warn(`Device type '${name}' not found, will use first available`)
    // Get first available device type as fallback
    const { data: fallback } = await supabase
      .schema(getSchemaName())
      .from('device_types')
      .select('id')
      .limit(1)
      .single()
    return fallback?.id || null
  }
  return data.id
}

// Helper function to get location ID by name
async function getLocationId(name: string): Promise<string | null> {
  if (!name) return null
  const { data, error } = await supabase
    .schema(getSchemaName())
    .from('locations')
    .select('id')
    .eq('name', name)
    .single()

  if (error || !data) {
    console.warn(`Location '${name}' not found, will use first available`)
    // Get first available location as fallback
    const { data: fallback } = await supabase
      .schema(getSchemaName())
      .from('locations')
      .select('id')
      .limit(1)
      .single()
    return fallback?.id || null
  }
  return data.id
}

// Helper function to update SIM card status
async function updateSimCardStatus(simCardId: string | null, status: 'active' | 'available'): Promise<void> {
  if (!simCardId) return

  try {
    const { error } = await supabase
      .schema(getSchemaName())
      .from('sim_cards')
      .update({ status } as any)
      .eq('id', simCardId)

    if (error) {
      console.error(`Error updating SIM card ${simCardId} status to ${status}:`, error)
    } else {
      console.log(`SIM card ${simCardId} status updated to ${status}`)
    }
  } catch (err) {
    console.error(`Unexpected error updating SIM card status:`, err)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== DEVICES API CALLED ===')
  console.log('Method:', req.method)
  console.log('URL:', req.url)
  console.log('Environment check:', {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY
  })
  
  // CORS handled by vercel.json

  if (req.method === 'OPTIONS') {
    console.log('OPTIONS request handled')
    return res.status(200).end()
  }

  try {
    switch (req.method) {
      case 'GET':
        return handleGetDevices(req, res)
      case 'POST':
        return handleCreateDevice(req, res)
      case 'PUT':
        return handleUpdateDevice(req, res)
      case 'DELETE':
        return handleDeleteDevice(req, res)
      default:
        return res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('API Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function handleGetDevices(req: VercelRequest, res: VercelResponse) {
  console.log('handleGetDevices called')
  try {
    console.log('Querying Supabase devices table with joins...')
    const { data, error } = await supabase
      .schema(getSchemaName())
      .from('devices')
      .select(`
        *,
        device_types:device_type_id(name),
        locations:location_id(name)
      `)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching devices:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch devices'
      })
    }

    // Convert database format to API format
    const devices: Device[] = (data || []).map((dbDevice: any) => ({
      id: dbDevice.id,
      name: dbDevice.name,
      status: (dbDevice.status?.charAt(0).toUpperCase() + dbDevice.status?.slice(1)) as 'Active' | 'Inactive' | 'Maintenance' | 'Offline',
      simCard: dbDevice.sim_card_id || '',
      deviceType: dbDevice.device_types?.name || '',
      location: dbDevice.locations?.name || '',
      lastSeen: dbDevice.last_seen || new Date().toISOString(),
      signalStrength: dbDevice.signal_strength || 0,
      dataUsage: dbDevice.data_usage_mb ? `${dbDevice.data_usage_mb} MB` : '0 MB',
      connectionType: (dbDevice.connection_type?.toUpperCase() || '4G') as '4G' | '5G' | '3G' | 'WiFi',
      test1: dbDevice.test1 || undefined,
      firmwareVersion: dbDevice.firmware_version,
      hardwareVersion: dbDevice.hardware_version,
      serialNumber: dbDevice.serial_number,
      manufacturer: dbDevice.manufacturer,
      model: dbDevice.model,
      notes: dbDevice.notes,
      description: dbDevice.description,
      isActive: dbDevice.is_active,
      createdAt: dbDevice.created_at,
      updatedAt: dbDevice.updated_at,
      // Location and Journey Tracking (Map Visualization)
      latitude: dbDevice.latitude,
      longitude: dbDevice.longitude,
      // Sensor Data and Environmental Metrics
      temperature: dbDevice.temperature,
      humidity: dbDevice.humidity,
      light: dbDevice.light,
      // Device Status and Health Indicators
      healthStatus: dbDevice.health_status,
      batteryLevel: dbDevice.battery_level,
      securityStatus: dbDevice.security_status,
      // Technical Metadata and Documentation
      assetManagementUrl: dbDevice.asset_management_url,
      supplierDeviceUrl: dbDevice.supplier_device_url,
      userManualUrl: dbDevice.user_manual_url,
      specificationBase64: dbDevice.specification_base64
    }))

    return res.status(200).json({
      success: true,
      data: devices
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

async function handleCreateDevice(req: VercelRequest, res: VercelResponse) {
  const deviceData: Partial<Device> = req.body

  try {
    // Extract numeric value from dataUsage string (e.g., "2.4 MB" -> 2.4)
    const dataUsageMb = deviceData.dataUsage ? 
      parseFloat(deviceData.dataUsage.replace(/[^\d.]/g, '')) || 0 : 0

    // Get foreign key IDs
    const deviceTypeId = await getDeviceTypeId(deviceData.deviceType || '')
    const locationId = await getLocationId(deviceData.location || '')

    if (!deviceTypeId) {
      return res.status(400).json({
        success: false,
        error: 'Valid device type is required'
      })
    }

    // Convert API format to database format
    const dbDevice: Partial<DatabaseDevice> = {
      id: deviceData.id || `DEV${Date.now()}`,
      name: deviceData.name || 'New Device',
      status: deviceData.status?.toLowerCase() as 'active' | 'inactive' | 'maintenance' | 'offline' || 'inactive',
      sim_card_id: deviceData.simCard || null,
      device_type_id: deviceTypeId,
      location_id: locationId,
      last_seen: deviceData.lastSeen || new Date().toISOString(),
      signal_strength: deviceData.signalStrength || 0,
      data_usage_mb: dataUsageMb,
      connection_type: deviceData.connectionType?.toLowerCase() as '3g' | '4g' | '5g' | 'wifi' || '4g',
      test1: deviceData.test1 || null,
      firmware_version: deviceData.firmwareVersion,
      hardware_version: deviceData.hardwareVersion,
      serial_number: deviceData.serialNumber,
      manufacturer: deviceData.manufacturer,
      model: deviceData.model,
      notes: deviceData.notes,
      description: deviceData.description,
      is_active: deviceData.isActive,
      // Location and Journey Tracking (Map Visualization)
      latitude: deviceData.latitude,
      longitude: deviceData.longitude,
      // Sensor Data and Environmental Metrics
      temperature: deviceData.temperature,
      humidity: deviceData.humidity,
      light: deviceData.light,
      // Device Status and Health Indicators
      health_status: deviceData.healthStatus,
      battery_level: deviceData.batteryLevel,
      security_status: deviceData.securityStatus,
      // Technical Metadata and Documentation
      asset_management_url: deviceData.assetManagementUrl,
      supplier_device_url: deviceData.supplierDeviceUrl,
      user_manual_url: deviceData.userManualUrl,
      specification_base64: deviceData.specificationBase64
    }

    const { data, error } = await supabase
      .schema(getSchemaName())
      .from('devices')
      .insert(dbDevice as any)
      .select(`
        *,
        device_types:device_type_id(name),
        locations:location_id(name)
      `)
      .single()

    if (error) {
      console.error('Error creating device:', error)
      return res.status(400).json({
        success: false,
        error: 'Failed to create device'
      })
    }

    // Update SIM card status to active if a SIM card was assigned
    if (dbDevice.sim_card_id) {
      await updateSimCardStatus(dbDevice.sim_card_id, 'active')
    }

    // Convert back to API format
    const newDevice: Device = {
      id: data.id,
      name: data.name,
      status: (data.status?.charAt(0).toUpperCase() + data.status?.slice(1)) as 'Active' | 'Inactive' | 'Maintenance' | 'Offline',
      simCard: data.sim_card_id || '',
      deviceType: data.device_types?.name || '',
      location: data.locations?.name || '',
      lastSeen: data.last_seen || new Date().toISOString(),
      signalStrength: data.signal_strength || 0,
      dataUsage: data.data_usage_mb ? `${data.data_usage_mb} MB` : '0 MB',
      connectionType: (data.connection_type?.toUpperCase() || '4G') as '4G' | '5G' | '3G' | 'WiFi',
      test1: data.test1 || undefined,
      firmwareVersion: data.firmware_version,
      hardwareVersion: data.hardware_version,
      serialNumber: data.serial_number,
      manufacturer: data.manufacturer,
      model: data.model,
      notes: data.notes,
      description: data.description,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      // Location and Journey Tracking (Map Visualization)
      latitude: data.latitude,
      longitude: data.longitude,
      // Sensor Data and Environmental Metrics
      temperature: data.temperature,
      humidity: data.humidity,
      light: data.light,
      // Device Status and Health Indicators
      healthStatus: data.health_status,
      batteryLevel: data.battery_level,
      securityStatus: data.security_status,
      // Technical Metadata and Documentation
      assetManagementUrl: data.asset_management_url,
      supplierDeviceUrl: data.supplier_device_url,
      userManualUrl: data.user_manual_url,
      specificationBase64: data.specification_base64
    }

    return res.status(201).json({
      success: true,
      data: newDevice
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

async function handleUpdateDevice(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query
  const updates: Partial<Device> = req.body

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Device ID is required'
    })
  }

  try {
    // First, get the current device to check if SIM card is changing
    const { data: currentDevice } = await supabase
      .schema(getSchemaName())
      .from('devices')
      .select('sim_card_id')
      .eq('id', id)
      .single()

    const oldSimCardId = currentDevice?.sim_card_id || null
    const newSimCardId = updates.simCard !== undefined ? (updates.simCard || null) : oldSimCardId

    // Convert API format to database format
    const dbUpdates: Partial<DatabaseDevice> = {}
    if (updates.name !== undefined) dbUpdates.name = updates.name
    if (updates.status !== undefined) dbUpdates.status = updates.status.toLowerCase() as 'active' | 'inactive' | 'maintenance' | 'offline'
    if (updates.simCard !== undefined) dbUpdates.sim_card_id = updates.simCard || null
    if (updates.deviceType !== undefined) {
      const deviceTypeId = await getDeviceTypeId(updates.deviceType)
      if (deviceTypeId) dbUpdates.device_type_id = deviceTypeId
    }
    if (updates.location !== undefined) {
      const locationId = await getLocationId(updates.location)
      dbUpdates.location_id = locationId
    }
    if (updates.lastSeen !== undefined) dbUpdates.last_seen = updates.lastSeen
    if (updates.signalStrength !== undefined) dbUpdates.signal_strength = updates.signalStrength
    if (updates.dataUsage !== undefined) {
      // Extract numeric value from dataUsage string (e.g., "2.4 MB" -> 2.4)
      dbUpdates.data_usage_mb = parseFloat(updates.dataUsage.replace(/[^\d.]/g, '')) || 0
    }
    if (updates.connectionType !== undefined) dbUpdates.connection_type = updates.connectionType.toLowerCase() as '3g' | '4g' | '5g' | 'wifi'
    if (updates.firmwareVersion !== undefined) dbUpdates.firmware_version = updates.firmwareVersion
    if (updates.hardwareVersion !== undefined) dbUpdates.hardware_version = updates.hardwareVersion
    if (updates.serialNumber !== undefined) dbUpdates.serial_number = updates.serialNumber
    if (updates.manufacturer !== undefined) dbUpdates.manufacturer = updates.manufacturer
    if (updates.model !== undefined) dbUpdates.model = updates.model
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes
    if (updates.description !== undefined) dbUpdates.description = updates.description
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive
    if (updates.test1 !== undefined) dbUpdates.test1 = updates.test1

    // Location and Journey Tracking (Map Visualization)
    if (updates.latitude !== undefined) dbUpdates.latitude = updates.latitude
    if (updates.longitude !== undefined) dbUpdates.longitude = updates.longitude

    // Sensor Data and Environmental Metrics
    if (updates.temperature !== undefined) dbUpdates.temperature = updates.temperature
    if (updates.humidity !== undefined) dbUpdates.humidity = updates.humidity
    if (updates.light !== undefined) dbUpdates.light = updates.light

    // Device Status and Health Indicators
    if (updates.healthStatus !== undefined) dbUpdates.health_status = updates.healthStatus
    if (updates.batteryLevel !== undefined) dbUpdates.battery_level = updates.batteryLevel
    if (updates.securityStatus !== undefined) dbUpdates.security_status = updates.securityStatus

    // Technical Metadata and Documentation
    if (updates.assetManagementUrl !== undefined) dbUpdates.asset_management_url = updates.assetManagementUrl
    if (updates.supplierDeviceUrl !== undefined) dbUpdates.supplier_device_url = updates.supplierDeviceUrl
    if (updates.userManualUrl !== undefined) dbUpdates.user_manual_url = updates.userManualUrl
    if (updates.specificationBase64 !== undefined) dbUpdates.specification_base64 = updates.specificationBase64

    // Add updated_at timestamp
    dbUpdates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .schema(getSchemaName())
      .from('devices')
      .update(dbUpdates)
      .eq('id', id)
      .select(`
        *,
        device_types:device_type_id(name),
        locations:location_id(name)
      `)
      .single()

    if (error) {
      console.error('Error updating device:', error)
      return res.status(400).json({
        success: false,
        error: 'Failed to update device',
        details: error
      })
    }

    // Update SIM card statuses if SIM card changed
    if (oldSimCardId !== newSimCardId) {
      // If old SIM card exists, set it back to available
      if (oldSimCardId) {
        await updateSimCardStatus(oldSimCardId, 'available')
      }
      // If new SIM card exists, set it to active
      if (newSimCardId) {
        await updateSimCardStatus(newSimCardId, 'active')
      }
    }

    return res.status(200).json({
      success: true,
      message: `Device ${id} updated successfully`,
      data: {
        id: data.id,
        name: data.name,
        status: (data.status?.charAt(0).toUpperCase() + data.status?.slice(1)) as 'Active' | 'Inactive' | 'Maintenance' | 'Offline',
        simCard: data.sim_card_id || '',
        deviceType: data.device_types?.name || '',
        location: data.locations?.name || '',
        lastSeen: data.last_seen || new Date().toISOString(),
        signalStrength: data.signal_strength || 0,
        dataUsage: data.data_usage_mb ? `${data.data_usage_mb} MB` : '0 MB',
        connectionType: (data.connection_type?.toUpperCase() || '4G') as '4G' | '5G' | '3G' | 'WiFi',
        test1: data.test1 || undefined,
        firmwareVersion: data.firmware_version,
        hardwareVersion: data.hardware_version,
        serialNumber: data.serial_number,
        manufacturer: data.manufacturer,
        model: data.model,
        notes: data.notes,
        description: data.description,
        isActive: data.is_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        // Location and Journey Tracking (Map Visualization)
        latitude: data.latitude,
        longitude: data.longitude,
        // Sensor Data and Environmental Metrics
        temperature: data.temperature,
        humidity: data.humidity,
        light: data.light,
        // Device Status and Health Indicators
        healthStatus: data.health_status,
        batteryLevel: data.battery_level,
        securityStatus: data.security_status,
        // Technical Metadata and Documentation
        assetManagementUrl: data.asset_management_url,
        supplierDeviceUrl: data.supplier_device_url,
        userManualUrl: data.user_manual_url,
        specificationBase64: data.specification_base64
      }
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

async function handleDeleteDevice(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Device ID is required'
    })
  }

  try {
    // First, get the device to find its SIM card
    const { data: deviceToDelete } = await supabase
      .schema(getSchemaName())
      .from('devices')
      .select('sim_card_id')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .schema(getSchemaName())
      .from('devices')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting device:', error)
      return res.status(400).json({
        success: false,
        error: 'Failed to delete device'
      })
    }

    // If device had a SIM card, set it back to available
    if (deviceToDelete?.sim_card_id) {
      await updateSimCardStatus(deviceToDelete.sim_card_id, 'available')
    }

    return res.status(200).json({
      success: true,
      message: `Device ${id} deleted successfully`
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}