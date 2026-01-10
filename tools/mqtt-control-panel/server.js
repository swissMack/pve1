/**
 * MQTT Control Panel Backend API
 * Provides container control and EMQX status endpoints
 */

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { exec } from 'child_process'
import { promisify } from 'util'
import mqtt from 'mqtt'

const execAsync = promisify(exec)

const app = express()
const PORT = process.env.API_PORT || 3003

// ============ MQTT Message Flow Tracking ============
const MAX_MESSAGES = 50
const recentMessages = []
let mqttClient = null
let messageStats = {
  received: 0,
  lastMinute: 0,
  lastMinuteTimestamp: Date.now()
}

function initMqttClient() {
  // Connect to EMQX on Proxmox
  const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://192.168.1.59:1883'
  mqttClient = mqtt.connect(brokerUrl, {
    clientId: `control-panel-monitor-${Date.now()}`,
    clean: true
  })

  mqttClient.on('connect', () => {
    console.log('MQTT monitor connected')
    // Subscribe to all simportal topics (data, commands, status)
    mqttClient.subscribe('simportal/#', { qos: 0 })
  })

  mqttClient.on('message', (topic, payload) => {
    const timestamp = new Date().toISOString()
    let message = payload.toString()
    let type = 'data'

    // Parse message based on topic type
    try {
      const parsed = JSON.parse(message)

      if (topic.includes('/sensors')) {
        type = 'sensor'
        message = `temp:${parsed.sensors?.temperature}°C hum:${parsed.sensors?.humidity}% bat:${parsed.sensors?.batteryLevel}%`
      } else if (topic.includes('/location')) {
        type = 'location'
        message = `lat:${parsed.location?.latitude?.toFixed(4)} lon:${parsed.location?.longitude?.toFixed(4)} spd:${parsed.location?.speed?.toFixed(1)}km/h`
      } else if (topic.includes('/commands')) {
        type = 'command'
        message = `CMD: ${parsed.type || 'unknown'}${parsed.field ? ' ' + parsed.field : ''}${parsed.value !== undefined ? '=' + parsed.value : ''}`
      } else if (topic.includes('/status')) {
        type = 'status'
        message = `paused:${parsed.paused} interval:${parsed.sensorInterval}s`
      } else if (topic.includes('/config')) {
        type = 'config'
        message = JSON.stringify(parsed).substring(0, 60)
      } else {
        message = JSON.stringify(parsed).substring(0, 80)
      }
    } catch {
      message = message.substring(0, 80)
    }

    // Add to recent messages
    recentMessages.unshift({
      time: timestamp.split('T')[1].split('.')[0],
      topic: topic.replace('simportal/devices/', '').replace('simportal/', ''),
      message,
      type
    })

    // Keep only last MAX_MESSAGES
    if (recentMessages.length > MAX_MESSAGES) {
      recentMessages.pop()
    }

    // Update stats
    messageStats.received++

    // Reset per-minute counter
    const now = Date.now()
    if (now - messageStats.lastMinuteTimestamp > 60000) {
      messageStats.lastMinute = 0
      messageStats.lastMinuteTimestamp = now
    }
    messageStats.lastMinute++
  })

  mqttClient.on('error', (err) => {
    console.error('MQTT monitor error:', err.message)
  })
}

// Initialize MQTT client
initMqttClient()

app.use(cors())
app.use(express.json())

// Docker project directory - auto-detect based on platform
const DOCKER_DIR = process.env.DOCKER_DIR || (
  process.platform === 'darwin'
    ? '/Users/mackmood/MQTTServer/docker'
    : '/root/MQTTServer/docker'  // Linux/Proxmox path
)

// Check if Docker is available
let dockerAvailable = false
async function checkDockerAvailable() {
  try {
    await execAsync('docker info')
    dockerAvailable = true
    console.log('Docker is available for container control')
  } catch {
    dockerAvailable = false
    console.log('Docker not available - container control disabled (generator running on Proxmox)')
  }
}
checkDockerAvailable()

// Execute docker compose command
async function dockerCompose(command) {
  if (!dockerAvailable) {
    throw new Error('Docker not available locally - generator running on Proxmox')
  }
  const { stdout, stderr } = await execAsync(
    `docker compose ${command}`,
    { cwd: DOCKER_DIR }
  )
  return { stdout: stdout.trim(), stderr: stderr.trim() }
}

// Get container status
async function getContainerStatus(containerName) {
  if (!dockerAvailable) {
    return 'remote'  // Indicates running on remote server
  }
  try {
    const { stdout } = await execAsync(
      `docker inspect --format='{{.State.Status}}' ${containerName}`
    )
    return stdout.trim()
  } catch {
    return 'not found'
  }
}

// Get container logs
async function getContainerLogs(containerName, lines = 20) {
  if (!dockerAvailable) {
    return 'Logs not available - generator running on Proxmox server'
  }
  try {
    const { stdout } = await execAsync(
      `docker logs ${containerName} --tail ${lines} 2>&1`
    )
    return stdout
  } catch (err) {
    return err.message
  }
}

// ============ Data Generator Endpoints ============

// GET /api/generator/status
app.get('/api/generator/status', async (req, res) => {
  try {
    const status = await getContainerStatus('mqtt-data-generator')
    const logs = await getContainerLogs('mqtt-data-generator', 10)
    res.json({
      status,
      containerName: 'mqtt-data-generator',
      logs: logs.split('\n').slice(-10)
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/generator/start
app.post('/api/generator/start', async (req, res) => {
  try {
    await dockerCompose('start data-generator')
    const status = await getContainerStatus('mqtt-data-generator')
    res.json({ success: true, status, message: 'Data generator started' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/generator/stop
app.post('/api/generator/stop', async (req, res) => {
  try {
    await dockerCompose('stop data-generator')
    const status = await getContainerStatus('mqtt-data-generator')
    res.json({ success: true, status, message: 'Data generator stopped' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/generator/restart
app.post('/api/generator/restart', async (req, res) => {
  try {
    await dockerCompose('restart data-generator')
    const status = await getContainerStatus('mqtt-data-generator')
    res.json({ success: true, status, message: 'Data generator restarted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ============ EMQX Status Endpoints ============

// EMQX API configuration - use Proxmox server
const EMQX_API_BASE = process.env.EMQX_API_URL || 'http://192.168.1.59:18083'

// EMQX API token cache
let emqxToken = null
let emqxTokenExpiry = 0

// Get EMQX JWT token
async function getEmqxToken() {
  if (emqxToken && Date.now() < emqxTokenExpiry) {
    return emqxToken
  }

  const response = await fetch(`${EMQX_API_BASE}/api/v5/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'public' })
  })

  if (response.ok) {
    const data = await response.json()
    emqxToken = data.token
    emqxTokenExpiry = Date.now() + (3600 * 1000) // 1 hour
    return emqxToken
  }
  throw new Error('Failed to authenticate with EMQX')
}

// Helper to make authenticated EMQX API calls
async function emqxFetch(path) {
  const token = await getEmqxToken()
  const response = await fetch(`${EMQX_API_BASE}/api/v5${path}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (!response.ok) {
    throw new Error(`EMQX API error: ${response.status}`)
  }
  return response.json()
}

// GET /api/emqx/status
app.get('/api/emqx/status', async (req, res) => {
  try {
    const containerStatus = await getContainerStatus('mqtt-emqx')
    const metrics = await emqxFetch('/monitor_current')
    res.json({ containerStatus, broker: metrics })
  } catch (err) {
    res.json({
      containerStatus: await getContainerStatus('mqtt-emqx'),
      broker: null,
      error: err.message
    })
  }
})

// GET /api/emqx/stats
app.get('/api/emqx/stats', async (req, res) => {
  try {
    const stats = await emqxFetch('/stats')
    res.json(stats)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/emqx/clients
app.get('/api/emqx/clients', async (req, res) => {
  try {
    const clients = await emqxFetch('/clients?limit=100')
    res.json(clients)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/emqx/subscriptions
app.get('/api/emqx/subscriptions', async (req, res) => {
  try {
    const subs = await emqxFetch('/subscriptions?limit=100')
    res.json(subs)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/mqtt/messages - Recent message flow
app.get('/api/mqtt/messages', (req, res) => {
  res.json({
    messages: recentMessages.slice(0, 20),
    stats: {
      total: messageStats.received,
      perMinute: messageStats.lastMinute
    }
  })
})

// ============ All Services Status ============

// GET /api/services/status
app.get('/api/services/status', async (req, res) => {
  try {
    const services = ['mqtt-emqx', 'mqtt-data-generator', 'mqtt-influxdb', 'mqtt-prometheus', 'mqtt-grafana']
    const statuses = {}

    for (const service of services) {
      statuses[service] = await getContainerStatus(service)
    }

    res.json(statuses)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`MQTT Control Panel API running on http://localhost:${PORT}`)
})
