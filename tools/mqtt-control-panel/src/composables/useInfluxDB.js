import { ref, reactive, onUnmounted } from 'vue'

// Use dynamic hostname so it works from any browser location
const INFLUXDB_URL = typeof window !== 'undefined'
  ? `http://${window.location.hostname}:8086`
  : 'http://localhost:8086'
const INFLUXDB_TOKEN = 'mqtt-influxdb-token'
const INFLUXDB_ORG = 'mqtt-org'

export function useInfluxDB() {
  const loading = ref(false)
  const error = ref(null)

  // Data stores
  const sensorData = reactive({
    temperature: [],
    humidity: [],
    light: [],
    battery: []
  })

  const deviceStats = reactive({
    activeDevices: 0,
    totalMessages: 0,
    avgTemperature: 0,
    avgHumidity: 0,
    avgBattery: 0
  })

  const timeSeriesData = reactive({
    labels: [],
    datasets: {}
  })

  const latestReadings = reactive({})

  let refreshInterval = null

  async function queryInfluxDB(fluxQuery, bucket = 'telemetry') {
    const url = `${INFLUXDB_URL}/api/v2/query?org=${INFLUXDB_ORG}`

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${INFLUXDB_TOKEN}`,
          'Content-Type': 'application/vnd.flux',
          'Accept': 'application/csv'
        },
        body: fluxQuery
      })

      if (!response.ok) {
        throw new Error(`InfluxDB query failed: ${response.status}`)
      }

      const csvData = await response.text()
      return parseCSV(csvData)
    } catch (e) {
      console.error('InfluxDB query error:', e)
      throw e
    }
  }

  function parseCSV(csv) {
    const lines = csv.trim().split('\n')
    if (lines.length < 2) return []

    const results = []
    let headers = []

    for (const line of lines) {
      if (line.startsWith('#') || line === '') continue

      const values = line.split(',')

      if (line.includes('_result') && line.includes('_table')) {
        // This is a header line
        headers = values
        continue
      }

      if (headers.length > 0 && values.length >= headers.length) {
        const row = {}
        headers.forEach((header, i) => {
          row[header] = values[i]
        })
        results.push(row)
      }
    }

    return results
  }

  async function fetchSensorTimeSeries(timeRange = '-1h', deviceId = null) {
    const deviceFilter = deviceId
      ? `|> filter(fn: (r) => r["device_id"] == "${deviceId}")`
      : ''

    const query = `
from(bucket: "telemetry")
  |> range(start: ${timeRange})
  |> filter(fn: (r) => r["_measurement"] == "simportal_sensors")
  ${deviceFilter}
  |> filter(fn: (r) => r["_field"] == "temperature" or r["_field"] == "humidity" or r["_field"] == "battery" or r["_field"] == "light")
  |> aggregateWindow(every: 30s, fn: mean, createEmpty: false)
  |> yield(name: "sensor_data")
`
    return await queryInfluxDB(query)
  }

  async function fetchLatestReadings() {
    const query = `
from(bucket: "telemetry")
  |> range(start: -5m)
  |> filter(fn: (r) => r["_measurement"] == "simportal_sensors")
  |> filter(fn: (r) => r["_field"] == "temperature" or r["_field"] == "humidity" or r["_field"] == "battery" or r["_field"] == "light" or r["_field"] == "signal")
  |> last()
  |> yield(name: "latest")
`
    return await queryInfluxDB(query)
  }

  async function fetchDeviceStats() {
    const query = `
// Count unique devices in last 5 minutes
activeDevices = from(bucket: "telemetry")
  |> range(start: -5m)
  |> filter(fn: (r) => r["_measurement"] == "simportal_sensors")
  |> group(columns: ["device_id"])
  |> count()
  |> group()
  |> count()
  |> yield(name: "active_devices")

// Average sensor values in last 5 minutes
from(bucket: "telemetry")
  |> range(start: -5m)
  |> filter(fn: (r) => r["_measurement"] == "simportal_sensors")
  |> filter(fn: (r) => r["_field"] == "temperature" or r["_field"] == "humidity" or r["_field"] == "battery")
  |> group(columns: ["_field"])
  |> mean()
  |> yield(name: "averages")
`
    return await queryInfluxDB(query)
  }

  async function fetchMessageCount() {
    const query = `
from(bucket: "telemetry")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "simportal_sensors")
  |> count()
  |> yield(name: "message_count")
`
    return await queryInfluxDB(query)
  }

  async function fetchLocationData(deviceId = null, timeRange = '-30m') {
    const deviceFilter = deviceId
      ? `|> filter(fn: (r) => r["device_id"] == "${deviceId}")`
      : ''

    const query = `
from(bucket: "telemetry")
  |> range(start: ${timeRange})
  |> filter(fn: (r) => r["_measurement"] == "simportal_location")
  ${deviceFilter}
  |> filter(fn: (r) => r["_field"] == "latitude" or r["_field"] == "longitude" or r["_field"] == "speed")
  |> yield(name: "location_data")
`
    return await queryInfluxDB(query)
  }

  async function refreshAllData() {
    loading.value = true
    error.value = null

    try {
      // Fetch all data in parallel
      const [sensorResults, latestResults, statsResults] = await Promise.all([
        fetchSensorTimeSeries('-30m').catch(() => []),
        fetchLatestReadings().catch(() => []),
        fetchDeviceStats().catch(() => [])
      ])

      // Process time series data
      processTimeSeriesData(sensorResults)

      // Process latest readings per device
      processLatestReadings(latestResults)

      // Process aggregate stats
      processStats(statsResults)

    } catch (e) {
      error.value = e.message
      console.error('Failed to refresh InfluxDB data:', e)
    } finally {
      loading.value = false
    }
  }

  function processTimeSeriesData(results) {
    const dataByField = {
      temperature: [],
      humidity: [],
      battery: [],
      light: []
    }

    const timestamps = new Set()

    results.forEach(row => {
      const field = row._field
      const value = parseFloat(row._value)
      const time = row._time

      if (field && !isNaN(value) && dataByField[field]) {
        dataByField[field].push({ time, value })
        timestamps.add(time)
      }
    })

    // Sort timestamps
    const sortedTimes = Array.from(timestamps).sort()

    timeSeriesData.labels = sortedTimes.map(t => {
      const date = new Date(t)
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    })

    // Aggregate values per timestamp
    Object.keys(dataByField).forEach(field => {
      const fieldData = dataByField[field]
      timeSeriesData.datasets[field] = sortedTimes.map(time => {
        const matches = fieldData.filter(d => d.time === time)
        if (matches.length === 0) return null
        return matches.reduce((sum, d) => sum + d.value, 0) / matches.length
      })
    })
  }

  function processLatestReadings(results) {
    results.forEach(row => {
      const deviceId = row.device_id
      const field = row._field
      const value = parseFloat(row._value)

      if (deviceId && field && !isNaN(value)) {
        if (!latestReadings[deviceId]) {
          latestReadings[deviceId] = {}
        }
        latestReadings[deviceId][field] = value
        latestReadings[deviceId].lastUpdate = row._time
      }
    })
  }

  function processStats(results) {
    results.forEach(row => {
      if (row.result === 'active_devices') {
        deviceStats.activeDevices = parseInt(row._value) || 0
      } else if (row.result === 'averages') {
        const field = row._field
        const value = parseFloat(row._value)
        if (field === 'temperature') deviceStats.avgTemperature = value
        if (field === 'humidity') deviceStats.avgHumidity = value
        if (field === 'battery') deviceStats.avgBattery = value
      }
    })
  }

  function startAutoRefresh(intervalMs = 10000) {
    stopAutoRefresh()
    refreshAllData()
    refreshInterval = setInterval(refreshAllData, intervalMs)
  }

  function stopAutoRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
    }
  }

  onUnmounted(() => {
    stopAutoRefresh()
  })

  return {
    loading,
    error,
    sensorData,
    deviceStats,
    timeSeriesData,
    latestReadings,
    queryInfluxDB,
    fetchSensorTimeSeries,
    fetchLatestReadings,
    fetchDeviceStats,
    fetchLocationData,
    refreshAllData,
    startAutoRefresh,
    stopAutoRefresh
  }
}
