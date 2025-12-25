import { ref, onUnmounted } from 'vue'
import mqtt from 'mqtt'
import type { MqttClient } from 'mqtt'

const BROKER_URL = 'ws://localhost:8083/mqtt'

// Shared state across all component instances
const client = ref<MqttClient | null>(null)
const connected = ref(false)
const connecting = ref(false)
const error = ref<string | null>(null)

// Current interval values (received from data generator)
const sensorInterval = ref(10)
const locationInterval = ref(5)

let connectionCount = 0

export function useMqttConfig() {
  function connect() {
    connectionCount++

    if (client.value) {
      console.log('[SIM Portal MQTT] Already connected, reusing existing connection')
      return
    }

    console.log('[SIM Portal MQTT] Initiating connection to', BROKER_URL)
    connecting.value = true
    error.value = null

    client.value = mqtt.connect(BROKER_URL, {
      clientId: `sim-portal-${Date.now()}`,
      clean: true,
      reconnectPeriod: 5000
    })

    client.value.on('connect', () => {
      console.log('[SIM Portal MQTT] ✅ Connected to MQTT broker at', BROKER_URL)
      connected.value = true
      connecting.value = false

      // Subscribe to config acknowledgments
      client.value?.subscribe('simportal/config/status', { qos: 1 })
    })

    client.value.on('message', (topic: string, payload: Buffer) => {
      try {
        const data = JSON.parse(payload.toString())

        if (topic === 'simportal/config/status') {
          // Update local state with confirmed values
          if (data.sensor_interval) {
            sensorInterval.value = data.sensor_interval
          }
          if (data.location_interval) {
            locationInterval.value = data.location_interval
          }
        }
      } catch (e) {
        console.error('[SIM Portal] Error parsing MQTT message:', e)
      }
    })

    client.value.on('error', (err: Error) => {
      console.error('[SIM Portal MQTT] ❌ Connection error:', err.message)
      error.value = err.message
      connecting.value = false
    })

    client.value.on('close', () => {
      console.log('[SIM Portal] MQTT connection closed')
      connected.value = false
    })

    client.value.on('reconnect', () => {
      console.log('[SIM Portal] Reconnecting to MQTT broker...')
      connecting.value = true
    })
  }

  function disconnect() {
    connectionCount--

    // Only disconnect if no components are using the connection
    if (connectionCount <= 0 && client.value) {
      client.value.end()
      client.value = null
      connected.value = false
      connectionCount = 0
    }
  }

  // Publish global interval configuration
  function setIntervals(sensor: number, location: number) {
    if (!client.value || !connected.value) {
      console.error('[SIM Portal] Not connected to MQTT broker')
      return false
    }

    const command = {
      type: 'set_interval',
      sensor_interval: sensor,
      location_interval: location
    }

    client.value.publish('simportal/config/interval', JSON.stringify(command), { qos: 1 })
    console.log('[SIM Portal] Published interval config:', command)

    // Optimistically update local state
    sensorInterval.value = sensor
    locationInterval.value = location

    return true
  }

  // Publish per-device sensor sampling interval
  function setDeviceSensorInterval(deviceId: string, intervalMinutes: number) {
    console.log(`[SIM Portal MQTT] setDeviceSensorInterval called - deviceId: ${deviceId}, intervalMinutes: ${intervalMinutes}`)
    console.log(`[SIM Portal MQTT] Connection state - client: ${!!client.value}, connected: ${connected.value}`)

    if (!client.value || !connected.value) {
      console.error('[SIM Portal MQTT] ❌ Not connected to MQTT broker - cannot publish')
      return false
    }

    // Convert minutes to seconds for the data generator
    const intervalSeconds = intervalMinutes * 60

    const command = {
      type: 'set_sensor_interval',
      value: intervalSeconds
    }

    const topic = `simportal/devices/${deviceId}/commands`
    client.value.publish(topic, JSON.stringify(command), { qos: 1 }, (err) => {
      if (err) {
        console.error(`[SIM Portal MQTT] ❌ Failed to publish:`, err)
      } else {
        console.log(`[SIM Portal MQTT] ✅ Published to ${topic}:`, command)
      }
    })

    return true
  }

  // Publish per-device sensor value
  function setDeviceSensorValue(deviceId: string, field: string, value: number) {
    if (!client.value || !connected.value) {
      console.error('[SIM Portal] Not connected to MQTT broker')
      return false
    }

    const command = {
      type: 'set_sensor',
      field,
      value
    }

    const topic = `simportal/devices/${deviceId}/commands`
    client.value.publish(topic, JSON.stringify(command), { qos: 1 })
    console.log(`[SIM Portal] Published sensor value for ${deviceId}:`, command)

    return true
  }

  // Cleanup on unmount
  onUnmounted(() => {
    disconnect()
  })

  return {
    connected,
    connecting,
    error,
    sensorInterval,
    locationInterval,
    connect,
    disconnect,
    setIntervals,
    setDeviceSensorInterval,
    setDeviceSensorValue
  }
}
