import { ref, computed } from 'vue'
import { mediationService } from '../services/mediationService.js'
import { analyticsService } from '../services/analyticsService.js'

/**
 * Composable for 3rd Party Mediation Simulator state management
 */
export function useMediation() {
  // ============ Connection Config ============
  // Note: Analytics endpoints are now served from the same API as the portal (port 3001)
  const config = ref({
    portalUrl: import.meta.env.VITE_PORTAL_API_URL || 'http://localhost:3001',
    analyticsUrl: import.meta.env.VITE_PORTAL_API_URL || 'http://localhost:3001', // Same as portal - consumption endpoints
    apiKey: import.meta.env.VITE_PORTAL_API_KEY || '',
    tenant: 'test-tenant',
    customer: 'test-customer'
  })

  const connectionStatus = ref({
    portal: null,  // 'connected' | 'error' | null
    analytics: null
  })

  // ============ SIM Pool (ICCIDs) ============
  const simPool = ref([])

  // ============ Generator Settings ============
  const generatorSettings = ref({
    recordCount: 10,
    periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    periodEnd: new Date(),
    hourStart: 0,             // Start hour (0-23)
    hourEnd: 23,              // End hour (0-23)
    bytesMin: 1_000_000,      // 1 MB
    bytesMax: 100_000_000,    // 100 MB
    uploadRatio: 0.3,         // 30% upload, 70% download
    smsMin: 0,
    smsMax: 50,
    source: 'mqtt-simulator'
  })

  // ============ Generated Records ============
  const generatedRecords = ref([])

  // ============ Submission State ============
  const submissionHistory = ref([])
  const submitting = ref(false)
  const submissionError = ref(null)

  // ============ Analytics Query State ============
  const analyticsLoading = ref(false)
  const analyticsError = ref(null)
  const analyticsResponse = ref(null)

  // ============ Helper Functions ============
  function generateIccid() {
    // Standard format: 8901 prefix + 16 random digits = 20 digits
    return '8901' + Math.random().toString().slice(2, 18)
  }

  function generateRecordId(index) {
    const timestamp = Date.now()
    return `rec_${timestamp}_${String(index).padStart(4, '0')}`
  }

  function generateBatchId() {
    return `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  function randomDateInRange(start, end, hourStart = 0, hourEnd = 23) {
    // Generate a random date between start and end
    const startTime = start.getTime()
    const endTime = end.getTime()
    const randomTime = startTime + Math.random() * (endTime - startTime)
    const randomDate = new Date(randomTime)

    // Constrain the hour to the specified range
    const randomHour = randomInt(hourStart, hourEnd)
    const randomMinute = randomInt(0, 59)
    const randomSecond = randomInt(0, 59)

    randomDate.setHours(randomHour, randomMinute, randomSecond, randomInt(0, 999))
    return randomDate
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
  }

  // ============ SIM Pool Methods ============
  function addIccid(iccid) {
    if (iccid && !simPool.value.includes(iccid)) {
      simPool.value.push(iccid)
    }
  }

  function removeIccid(iccid) {
    const index = simPool.value.indexOf(iccid)
    if (index !== -1) {
      simPool.value.splice(index, 1)
    }
  }

  function generateIccids(count = 5) {
    for (let i = 0; i < count; i++) {
      simPool.value.push(generateIccid())
    }
  }

  function clearSimPool() {
    simPool.value = []
  }

  // ============ Record Generation ============
  function generateUsageRecord(iccid, index) {
    const settings = generatorSettings.value
    const totalBytes = randomInt(settings.bytesMin, settings.bytesMax)
    const uploadBytes = Math.floor(totalBytes * settings.uploadRatio)
    const downloadBytes = totalBytes - uploadBytes

    // Random period within date range, constrained by hour settings
    const periodStart = randomDateInRange(settings.periodStart, settings.periodEnd, settings.hourStart, settings.hourEnd)
    const periodEnd = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000 - 1) // End of day

    return {
      iccid: iccid,
      recordId: generateRecordId(index),
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      usage: {
        totalBytes: totalBytes,
        dataUploadBytes: uploadBytes,
        dataDownloadBytes: downloadBytes,
        smsCount: randomInt(settings.smsMin, settings.smsMax)
      },
      source: settings.source,
      // UI helper fields (not sent to API)
      _formattedBytes: formatBytes(totalBytes),
      _periodDate: periodStart.toLocaleDateString()
    }
  }

  function generateRecords() {
    if (simPool.value.length === 0) {
      return
    }

    const settings = generatorSettings.value
    const records = []

    for (let i = 0; i < settings.recordCount; i++) {
      // Pick random ICCID from pool
      const iccid = simPool.value[randomInt(0, simPool.value.length - 1)]
      records.push(generateUsageRecord(iccid, i))
    }

    generatedRecords.value = records
  }

  function clearGeneratedRecords() {
    generatedRecords.value = []
  }

  // ============ Submission Methods ============
  async function submitSingle(record) {
    submitting.value = true
    submissionError.value = null

    try {
      // Remove UI helper fields before sending
      const { _formattedBytes, _periodDate, ...cleanRecord } = record

      const result = await mediationService.submitUsage(cleanRecord, config.value)

      addToHistory({
        type: 'single',
        recordCount: 1,
        status: result.status || 'ACCEPTED',
        response: result,
        timestamp: new Date()
      })

      return result
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message
      submissionError.value = errorMsg

      addToHistory({
        type: 'single',
        recordCount: 1,
        status: 'ERROR',
        error: errorMsg,
        timestamp: new Date()
      })

      throw err
    } finally {
      submitting.value = false
    }
  }

  async function submitBatch() {
    if (generatedRecords.value.length === 0) return

    submitting.value = true
    submissionError.value = null

    try {
      const batchId = generateBatchId()
      const source = generatorSettings.value.source

      // Remove UI helper fields and regenerate record_ids to ensure uniqueness per submission
      // This allows submitting the same generated records multiple times as separate batches
      const submissionTimestamp = Date.now()
      const cleanRecords = generatedRecords.value.map((record, index) => {
        const { _formattedBytes, _periodDate, recordId, ...clean } = record
        return {
          ...clean,
          recordId: `rec_${submissionTimestamp}_${String(index).padStart(4, '0')}`
        }
      })

      const result = await mediationService.submitBatch(batchId, cleanRecords, source, config.value)

      addToHistory({
        type: 'batch',
        batchId: batchId,
        recordCount: cleanRecords.length,
        recordsProcessed: result.recordsProcessed,
        recordsFailed: result.recordsFailed,
        status: result.recordsFailed > 0 ? 'PARTIAL' : 'ACCEPTED',
        response: result,
        timestamp: new Date()
      })

      return result
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message
      submissionError.value = errorMsg

      addToHistory({
        type: 'batch',
        recordCount: generatedRecords.value.length,
        status: 'ERROR',
        error: errorMsg,
        timestamp: new Date()
      })

      throw err
    } finally {
      submitting.value = false
    }
  }

  function addToHistory(entry) {
    submissionHistory.value.unshift(entry) // Add to beginning
    // Keep only last 50 entries
    if (submissionHistory.value.length > 50) {
      submissionHistory.value.pop()
    }
  }

  function clearHistory() {
    submissionHistory.value = []
  }

  // ============ Connection Testing ============
  async function testPortalConnection() {
    try {
      const result = await mediationService.testConnection(config.value)
      connectionStatus.value.portal = result.success ? 'connected' : 'error'
      return result
    } catch (err) {
      connectionStatus.value.portal = 'error'
      return { success: false, error: err.message }
    }
  }

  async function testAnalyticsConnection() {
    try {
      const result = await analyticsService.ping(config.value.analyticsUrl)
      connectionStatus.value.analytics = result.success ? 'connected' : 'error'
      return result
    } catch (err) {
      connectionStatus.value.analytics = 'error'
      return { success: false, error: err.message }
    }
  }

  // ============ Analytics Query ============
  async function executeAnalyticsQuery(endpoint, params) {
    analyticsLoading.value = true
    analyticsError.value = null
    analyticsResponse.value = null

    try {
      const startTime = Date.now()
      const result = await analyticsService.executeQuery(endpoint, params, config.value.analyticsUrl)
      const duration = Date.now() - startTime

      analyticsResponse.value = {
        data: result,
        duration: duration,
        timestamp: new Date()
      }

      return result
    } catch (err) {
      analyticsError.value = err.response?.data?.message || err.message
      throw err
    } finally {
      analyticsLoading.value = false
    }
  }

  function clearAnalyticsResponse() {
    analyticsResponse.value = null
    analyticsError.value = null
  }

  // ============ Computed ============
  const hasSimPool = computed(() => simPool.value.length > 0)
  const hasGeneratedRecords = computed(() => generatedRecords.value.length > 0)
  const canGenerate = computed(() => hasSimPool.value)
  const canSubmit = computed(() => hasGeneratedRecords.value && !submitting.value)

  // ============ Return ============
  return {
    // Config
    config,
    connectionStatus,

    // SIM Pool
    simPool,
    addIccid,
    removeIccid,
    generateIccids,
    clearSimPool,

    // Generator
    generatorSettings,
    generatedRecords,
    generateRecords,
    clearGeneratedRecords,

    // Submission
    submitting,
    submissionError,
    submissionHistory,
    submitSingle,
    submitBatch,
    clearHistory,

    // Connection
    testPortalConnection,
    testAnalyticsConnection,

    // Analytics
    analyticsLoading,
    analyticsError,
    analyticsResponse,
    executeAnalyticsQuery,
    clearAnalyticsResponse,

    // Computed
    hasSimPool,
    hasGeneratedRecords,
    canGenerate,
    canSubmit,

    // Helpers
    formatBytes,
    generateIccid
  }
}
