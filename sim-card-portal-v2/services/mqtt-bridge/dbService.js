/**
 * Database Service - PostgreSQL/Supabase operations for sensor and location data
 * Uses Supabase when configured, falls back to direct PostgreSQL pool
 */

const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const { config } = require('./config');

// Schema name used in the database (for PostgreSQL pool)
// Uses 'public' for Supabase/Proxmox, 'sim-card-portal-v2' for local dev
function getSchema() {
  return process.env.USE_PUBLIC_SCHEMA === 'true' ? 'public' : 'sim-card-portal-v2';
}

// Supabase client (initialized lazily)
let supabase = null;
let supabaseInitialized = false;

/**
 * Check if Supabase is configured
 */
function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Initialize Supabase client
 */
function initializeSupabase() {
  if (supabaseInitialized) return;
  supabaseInitialized = true;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseServiceRoleKey) {
    supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    console.log('[MQTT Bridge] Supabase client initialized');
  }
}

class DbService {
  constructor() {
    this.pool = null;
    this.useSupabase = false;
  }

  /**
   * Initialize database connection
   */
  async connect() {
    // Try Supabase first
    initializeSupabase();

    if (isSupabaseConfigured() && supabase) {
      console.log('[MQTT Bridge] Using Supabase for database operations');
      this.useSupabase = true;

      // Test Supabase connection
      try {
        const { data, error } = await supabase.from('devices').select('id').limit(1);
        if (error) throw error;
        console.log('[MQTT Bridge] Connected to Supabase successfully');
        return true;
      } catch (err) {
        console.error(`[MQTT Bridge] Supabase connection test failed: ${err.message}`);
        console.log('[MQTT Bridge] Falling back to PostgreSQL pool...');
        this.useSupabase = false;
      }
    }

    // Fall back to PostgreSQL pool
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.database,
      max: config.database.maxConnections,
      idleTimeoutMillis: config.database.idleTimeout,
    });

    // Test connection
    try {
      const client = await this.pool.connect();
      console.log('[MQTT Bridge] Connected to PostgreSQL database');
      client.release();
      return true;
    } catch (err) {
      console.error(`[MQTT Bridge] Failed to connect to database: ${err.message}`);
      throw err;
    }
  }

  /**
   * Insert sensor data into device_sensor_history table
   */
  async insertSensorData(data) {
    if (this.useSupabase && supabase) {
      try {
        const { data: result, error } = await supabase
          .from('device_sensor_history')
          .insert({
            device_id: data.deviceId,
            temperature: data.temperature,
            humidity: data.humidity,
            light: data.light,
            battery_level: data.batteryLevel,
            signal_strength: data.signalStrength,
            recorded_at: data.recordedAt,
            metadata: data.metadata || {}
          })
          .select('id')
          .single();

        if (error) throw error;
        console.log(`[MQTT Bridge] Inserted sensor data for device ${data.deviceId}: ${result.id}`);
        return result;
      } catch (err) {
        console.error(`[MQTT Bridge] Failed to insert sensor data: ${err.message}`);
        throw err;
      }
    }

    // Fall back to PostgreSQL pool
    const query = `
      INSERT INTO "${getSchema()}".device_sensor_history (
        device_id, temperature, humidity, light,
        battery_level, signal_strength, recorded_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;

    const values = [
      data.deviceId,
      data.temperature,
      data.humidity,
      data.light,
      data.batteryLevel,
      data.signalStrength,
      data.recordedAt,
      JSON.stringify(data.metadata || {}),
    ];

    try {
      const result = await this.pool.query(query, values);
      console.log(`[MQTT Bridge] Inserted sensor data for device ${data.deviceId}: ${result.rows[0].id}`);
      return result.rows[0];
    } catch (err) {
      console.error(`[MQTT Bridge] Failed to insert sensor data: ${err.message}`);
      throw err;
    }
  }

  /**
   * Insert location data into device_location_history table
   */
  async insertLocationData(data) {
    if (this.useSupabase && supabase) {
      try {
        const { data: result, error } = await supabase
          .from('device_location_history')
          .insert({
            device_id: data.deviceId,
            latitude: data.latitude,
            longitude: data.longitude,
            altitude: data.altitude,
            accuracy: data.accuracy,
            speed: data.speed,
            heading: data.heading,
            location_source: data.locationSource,
            battery_level: data.batteryLevel,
            signal_strength: data.signalStrength,
            recorded_at: data.recordedAt,
            metadata: data.metadata || {}
          })
          .select('id')
          .single();

        if (error) throw error;
        console.log(`[MQTT Bridge] Inserted location data for device ${data.deviceId}: ${result.id}`);
        return result;
      } catch (err) {
        console.error(`[MQTT Bridge] Failed to insert location data: ${err.message}`);
        throw err;
      }
    }

    // Fall back to PostgreSQL pool
    const query = `
      INSERT INTO "${getSchema()}".device_location_history (
        device_id, latitude, longitude, altitude,
        accuracy, speed, heading, location_source,
        battery_level, signal_strength, recorded_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `;

    const values = [
      data.deviceId,
      data.latitude,
      data.longitude,
      data.altitude,
      data.accuracy,
      data.speed,
      data.heading,
      data.locationSource,
      data.batteryLevel,
      data.signalStrength,
      data.recordedAt,
      JSON.stringify(data.metadata || {}),
    ];

    try {
      const result = await this.pool.query(query, values);
      console.log(`[MQTT Bridge] Inserted location data for device ${data.deviceId}: ${result.rows[0].id}`);
      return result.rows[0];
    } catch (err) {
      console.error(`[MQTT Bridge] Failed to insert location data: ${err.message}`);
      throw err;
    }
  }

  /**
   * Update device's last_seen and current sensor values
   */
  async updateDeviceStatus(deviceId, sensorData) {
    if (this.useSupabase && supabase) {
      try {
        const updateData = {
          last_seen: new Date().toISOString(),
          status: 'active'  // Set device to active when receiving MQTT data
        };

        if (sensorData.temperature !== null && sensorData.temperature !== undefined) {
          updateData.temperature = sensorData.temperature;
        }
        if (sensorData.humidity !== null && sensorData.humidity !== undefined) {
          updateData.humidity = sensorData.humidity;
        }
        if (sensorData.light !== null && sensorData.light !== undefined) {
          updateData.light = sensorData.light;
        }
        if (sensorData.batteryLevel !== null && sensorData.batteryLevel !== undefined) {
          updateData.battery_level = sensorData.batteryLevel;
        }
        if (sensorData.signalStrength !== null && sensorData.signalStrength !== undefined) {
          updateData.signal_strength = sensorData.signalStrength;
        }

        const { error, count } = await supabase
          .from('devices')
          .update(updateData)
          .eq('id', deviceId);

        if (error) throw error;
        if (count > 0) {
          console.log(`[MQTT Bridge] Updated device status for ${deviceId}`);
        }
        return count > 0;
      } catch (err) {
        console.warn(`[MQTT Bridge] Could not update device ${deviceId}: ${err.message}`);
        return false;
      }
    }

    // Fall back to PostgreSQL pool
    const updates = ['last_seen = NOW()', "status = 'active'"];
    const values = [deviceId];
    let paramIndex = 2;

    if (sensorData.temperature !== null && sensorData.temperature !== undefined) {
      updates.push(`temperature = $${paramIndex++}`);
      values.push(sensorData.temperature);
    }

    if (sensorData.humidity !== null && sensorData.humidity !== undefined) {
      updates.push(`humidity = $${paramIndex++}`);
      values.push(sensorData.humidity);
    }

    if (sensorData.light !== null && sensorData.light !== undefined) {
      updates.push(`light = $${paramIndex++}`);
      values.push(sensorData.light);
    }

    if (sensorData.batteryLevel !== null && sensorData.batteryLevel !== undefined) {
      updates.push(`battery_level = $${paramIndex++}`);
      values.push(sensorData.batteryLevel);
    }

    if (sensorData.signalStrength !== null && sensorData.signalStrength !== undefined) {
      updates.push(`signal_strength = $${paramIndex++}`);
      values.push(sensorData.signalStrength);
    }

    const query = `
      UPDATE "${getSchema()}".devices
      SET ${updates.join(', ')}
      WHERE id = $1
    `;

    try {
      const result = await this.pool.query(query, values);
      if (result.rowCount > 0) {
        console.log(`[MQTT Bridge] Updated device status for ${deviceId}`);
      }
      return result.rowCount > 0;
    } catch (err) {
      // Device might not exist - just log warning
      console.warn(`[MQTT Bridge] Could not update device ${deviceId}: ${err.message}`);
      return false;
    }
  }

  /**
   * Update device's current location
   */
  async updateDeviceLocation(deviceId, locationData) {
    if (this.useSupabase && supabase) {
      try {
        const updateData = {
          last_seen: new Date().toISOString(),
          status: 'active',  // Set device to active when receiving MQTT data
          latitude: locationData.latitude,
          longitude: locationData.longitude
        };

        if (locationData.batteryLevel !== null && locationData.batteryLevel !== undefined) {
          updateData.battery_level = locationData.batteryLevel;
        }
        if (locationData.signalStrength !== null && locationData.signalStrength !== undefined) {
          updateData.signal_strength = locationData.signalStrength;
        }

        const { error, count } = await supabase
          .from('devices')
          .update(updateData)
          .eq('id', deviceId);

        if (error) throw error;
        if (count > 0) {
          console.log(`[MQTT Bridge] Updated device location for ${deviceId}`);
        }
        return count > 0;
      } catch (err) {
        console.warn(`[MQTT Bridge] Could not update device location ${deviceId}: ${err.message}`);
        return false;
      }
    }

    // Fall back to PostgreSQL pool
    const query = `
      UPDATE "${getSchema()}".devices
      SET
        last_seen = NOW(),
        status = 'active',
        latitude = $2,
        longitude = $3,
        battery_level = COALESCE($4, battery_level),
        signal_strength = COALESCE($5, signal_strength)
      WHERE id = $1
    `;

    const values = [
      deviceId,
      locationData.latitude,
      locationData.longitude,
      locationData.batteryLevel,
      locationData.signalStrength,
    ];

    try {
      const result = await this.pool.query(query, values);
      if (result.rowCount > 0) {
        console.log(`[MQTT Bridge] Updated device location for ${deviceId}`);
      }
      return result.rowCount > 0;
    } catch (err) {
      console.warn(`[MQTT Bridge] Could not update device location ${deviceId}: ${err.message}`);
      return false;
    }
  }

  /**
   * Check if device exists
   */
  async deviceExists(deviceId) {
    if (this.useSupabase && supabase) {
      try {
        const { data, error } = await supabase
          .from('devices')
          .select('id')
          .eq('id', deviceId)
          .single();

        return !error && data !== null;
      } catch (err) {
        console.error(`[MQTT Bridge] Error checking device existence: ${err.message}`);
        return false;
      }
    }

    // Fall back to PostgreSQL pool
    const query = `SELECT id FROM "${getSchema()}".devices WHERE id = $1`;

    try {
      const result = await this.pool.query(query, [deviceId]);
      return result.rows.length > 0;
    } catch (err) {
      console.error(`[MQTT Bridge] Error checking device existence: ${err.message}`);
      return false;
    }
  }

  /**
   * Get device by ID
   */
  async getDevice(deviceId) {
    if (this.useSupabase && supabase) {
      try {
        const { data, error } = await supabase
          .from('devices')
          .select('*')
          .eq('id', deviceId)
          .single();

        if (error) return null;
        return data;
      } catch (err) {
        console.error(`[MQTT Bridge] Error fetching device: ${err.message}`);
        return null;
      }
    }

    // Fall back to PostgreSQL pool
    const query = `SELECT * FROM "${getSchema()}".devices WHERE id = $1`;

    try {
      const result = await this.pool.query(query, [deviceId]);
      return result.rows[0] || null;
    } catch (err) {
      console.error(`[MQTT Bridge] Error fetching device: ${err.message}`);
      return null;
    }
  }

  /**
   * Health check - verify database connection
   */
  async healthCheck() {
    if (this.useSupabase && supabase) {
      try {
        const { data, error } = await supabase.from('devices').select('id').limit(1);
        if (error) throw error;
        return { healthy: true, latency: 'ok', backend: 'supabase' };
      } catch (err) {
        return { healthy: false, error: err.message, backend: 'supabase' };
      }
    }

    // Fall back to PostgreSQL pool
    try {
      const result = await this.pool.query('SELECT 1');
      return { healthy: true, latency: 'ok', backend: 'postgresql' };
    } catch (err) {
      return { healthy: false, error: err.message, backend: 'postgresql' };
    }
  }

  /**
   * Close database connection pool
   */
  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      console.log('[MQTT Bridge] Database connection pool closed');
    }
    // Supabase client doesn't need explicit disconnect
    if (this.useSupabase) {
      console.log('[MQTT Bridge] Supabase connection closed');
    }
  }
}

// Export singleton instance
module.exports = new DbService();
