import { ref, reactive, onUnmounted } from 'vue'
import mqtt from 'mqtt'

export function useMqtt(brokerUrl = 'ws://192.168.1.199:8083/mqtt') {
  const client = ref(null)
  const connected = ref(false)
  const connecting = ref(false)
  const error = ref(null)

  // Device data storage
  const devices = reactive({})

  // Initialize device structure
  const deviceIds = ['DEV001', 'DEV002', 'DEV003', 'DEV004', 'DEV005', 'DEV006', 'DEV007', 'DEV008']
  deviceIds.forEach(id => {
    devices[id] = {
      id,
      sensors: { temperature: 0, humidity: 0, light: 0, batteryLevel: 0 },
      location: { latitude: 0, longitude: 0, altitude: 0, speed: 0, heading: 0 },
      metadata: { signalStrength: 0 },
      lastSeen: null,
      paused: false
    }
  })

  function connect() {
    if (client.value) return

    connecting.value = true
    error.value = null

    client.value = mqtt.connect(brokerUrl, {
      clientId: `control-panel-${Date.now()}`,
      clean: true,
      reconnectPeriod: 5000
    })

    client.value.on('connect', () => {
      console.log('Connected to MQTT broker')
      connected.value = true
      connecting.value = false

      // Subscribe to device topics
      client.value.subscribe('simportal/devices/+/sensors', { qos: 1 })
      client.value.subscribe('simportal/devices/+/location', { qos: 1 })
      client.value.subscribe('simportal/devices/+/status', { qos: 1 })
    })

    client.value.on('message', (topic, payload) => {
      try {
        const data = JSON.parse(payload.toString())
        const parts = topic.split('/')
        const deviceId = parts[2]
        const type = parts[3]

        if (devices[deviceId]) {
          if (type === 'sensors') {
            devices[deviceId].sensors = data.sensors
            devices[deviceId].metadata = data.metadata
            devices[deviceId].lastSeen = data.timestamp
          } else if (type === 'location') {
            devices[deviceId].location = data.location
            devices[deviceId].lastSeen = data.timestamp
          } else if (type === 'status') {
            devices[deviceId].paused = data.paused || false
          }
        }
      } catch (e) {
        console.error('Error parsing message:', e)
      }
    })

    client.value.on('error', (err) => {
      console.error('MQTT error:', err)
      error.value = err.message
      connecting.value = false
    })

    client.value.on('close', () => {
      console.log('MQTT connection closed')
      connected.value = false
    })

    client.value.on('reconnect', () => {
      console.log('Reconnecting to MQTT broker...')
      connecting.value = true
    })
  }

  function disconnect() {
    if (client.value) {
      client.value.end()
      client.value = null
      connected.value = false
    }
  }

  // Send command to specific device
  function sendDeviceCommand(deviceId, command) {
    if (!client.value || !connected.value) {
      console.error('Not connected to MQTT broker')
      return false
    }

    const topic = `simportal/devices/${deviceId}/commands`
    client.value.publish(topic, JSON.stringify(command), { qos: 1 })
    console.log(`Command sent to ${deviceId}:`, command)
    return true
  }

  // Send global config command
  function sendConfigCommand(command) {
    if (!client.value || !connected.value) {
      console.error('Not connected to MQTT broker')
      return false
    }

    const topic = 'simportal/config/interval'
    client.value.publish(topic, JSON.stringify(command), { qos: 1 })
    console.log('Config command sent:', command)
    return true
  }

  // Convenience methods for common commands
  function setSensorValue(deviceId, field, value) {
    return sendDeviceCommand(deviceId, { type: 'set_sensor', field, value })
  }

  function setLocation(deviceId, lat, lon) {
    return sendDeviceCommand(deviceId, { type: 'set_location', lat, lon })
  }

  function setHeading(deviceId, value) {
    return sendDeviceCommand(deviceId, { type: 'set_heading', value })
  }

  function setSpeed(deviceId, value) {
    return sendDeviceCommand(deviceId, { type: 'set_speed', value })
  }

  function pauseDevice(deviceId) {
    return sendDeviceCommand(deviceId, { type: 'pause' })
  }

  function resumeDevice(deviceId) {
    return sendDeviceCommand(deviceId, { type: 'resume' })
  }

  function resetDevice(deviceId) {
    return sendDeviceCommand(deviceId, { type: 'reset' })
  }

  function setIntervals(sensorInterval, locationInterval) {
    return sendConfigCommand({
      type: 'set_interval',
      sensor_interval: sensorInterval,
      location_interval: locationInterval
    })
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    client,
    connected,
    connecting,
    error,
    devices,
    connect,
    disconnect,
    sendDeviceCommand,
    sendConfigCommand,
    setSensorValue,
    setLocation,
    setHeading,
    setSpeed,
    pauseDevice,
    resumeDevice,
    resetDevice,
    setIntervals
  }
}
