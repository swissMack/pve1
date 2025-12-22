/**
 * SIM Card Portal API Service
 * Integrates with the SIM Card Portal Docker API
 */

import axios from 'axios'

const PORTAL_API_BASE = 'http://localhost:3001'
const API_KEY = 'test_provisioning_key_12345'

export const simPortalApi = axios.create({
  baseURL: PORTAL_API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
  }
})

// Map Docker API status to standard status format
const statusMap = {
  'Active': 'ACTIVE',
  'Inactive': 'INACTIVE',
  'Blocked': 'BLOCKED',
  'Suspended': 'BLOCKED',
  'Provisioned': 'PROVISIONED'
}

const reverseStatusMap = {
  'ACTIVE': 'Active',
  'INACTIVE': 'Inactive',
  'BLOCKED': 'Blocked',
  'PROVISIONED': 'Inactive'
}

// Transform Docker API SIM to standard format
function transformSim(sim) {
  return {
    simId: sim.id,
    iccid: sim.iccid,
    msisdn: sim.msisdn,
    status: statusMap[sim.status] || sim.status?.toUpperCase() || 'INACTIVE',
    carrier: sim.carrier,
    plan: sim.plan,
    dataUsed: sim.dataUsed,
    dataLimit: sim.dataLimit,
    activationDate: sim.activationDate,
    expiryDate: sim.expiryDate
  }
}

// Generate unique IDs
function generateIccid() {
  // ICCID must be exactly 19 digits
  // 89 (industry) + 41 (country) + 28 (issuer) + 10 random = 19 total
  const base = '894128' // 6 digits
  const mid = String(Date.now() % 10000000).padStart(7, '0') // 7 digits
  const end = String(Math.floor(Math.random() * 1000000)).padStart(6, '0') // 6 digits
  return base + mid + end // 6 + 7 + 6 = 19 digits exactly
}

function generateImsi() {
  // IMSI must be exactly 15 digits
  // Format: 228 (MCC Switzerland) + 01 (MNC Swisscom) + 10 digit MSIN = 15 digits
  const base = '22801' // 5 digits
  const msin = String(Date.now() % 10000000000).padStart(10, '0') // 10 digits
  return base + msin // 5 + 10 = 15 digits exactly
}

function generateMsisdn() {
  // Swiss format: +41 7x xxx xx xx
  const prefix = Math.random() > 0.5 ? '79' : '78'
  return '+41' + prefix + Math.floor(Math.random() * 9000000 + 1000000)
}

function generateRecordId() {
  return 'rec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
}

function generateBatchId() {
  return 'batch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
}

export const simPortalService = {
  // Health check
  async healthCheck() {
    const response = await simPortalApi.get('/api/v1/health')
    return response.data
  },

  // List SIMs from the portal (uses Docker API endpoint)
  async listSims(params = {}) {
    const response = await simPortalApi.get('/api/simcards', { params })
    // Docker API returns {success: true, data: [...]}
    const sims = response.data.data || response.data || []
    return {
      data: Array.isArray(sims) ? sims.map(transformSim) : []
    }
  },

  // Get single SIM details
  async getSim(simId) {
    const response = await simPortalApi.get(`/api/simcards/${simId}`)
    const sim = response.data.data || response.data
    return { data: transformSim(sim) }
  },

  // Create a new SIM card (simulates creation since Docker API is read-only)
  async createSim(customData = {}) {
    const iccid = customData.iccid || generateIccid()
    const msisdn = customData.msisdn || generateMsisdn()
    const simId = 'SIM-' + Date.now()

    // Docker API doesn't support creating SIMs, return simulated response
    console.log('[simPortalService] SIM creation simulated (Docker API is read-only)')

    return {
      simId,
      iccid,
      msisdn,
      status: customData.activateImmediately ? 'ACTIVE' : 'PROVISIONED',
      carrier: customData.carrier || 'IoTo Wireless',
      message: 'SIM created successfully (simulated)'
    }
  },

  // Activate a SIM (simulates activation)
  async activateSim(simId, notes = '') {
    console.log('[simPortalService] SIM activation simulated for:', simId)
    return {
      success: true,
      simId,
      status: 'ACTIVE',
      message: 'SIM activated successfully (simulated)'
    }
  },

  // Deactivate a SIM (simulates deactivation)
  async deactivateSim(simId, notes = '') {
    console.log('[simPortalService] SIM deactivation simulated for:', simId)
    return {
      success: true,
      simId,
      status: 'INACTIVE',
      message: 'SIM deactivated successfully (simulated)'
    }
  },

  // Block a SIM (simulates blocking)
  async blockSim(simId, reason = 'MANUAL', notes = '') {
    console.log('[simPortalService] SIM block simulated for:', simId)
    return {
      success: true,
      simId,
      status: 'BLOCKED',
      reason,
      message: 'SIM blocked successfully (simulated)'
    }
  },

  // Unblock a SIM (simulates unblocking)
  async unblockSim(simId, notes = '') {
    console.log('[simPortalService] SIM unblock simulated for:', simId)
    return {
      success: true,
      simId,
      status: 'ACTIVE',
      message: 'SIM unblocked successfully (simulated)'
    }
  },

  // Submit usage record for a SIM (uses Docker API /api/v1/usage)
  async submitUsage(iccid, usageData = {}) {
    const now = new Date()
    const periodStart = new Date(now.getTime() - 5 * 60 * 1000) // 5 minutes ago

    // Calculate totalBytes from upload + download if not provided
    const totalBytes = usageData.totalBytes ||
      ((usageData.dataUploadBytes || 0) + (usageData.dataDownloadBytes || 0)) ||
      Math.floor(Math.random() * 25000000)

    const payload = {
      iccid,
      periodStart: periodStart.toISOString(),
      periodEnd: now.toISOString(),
      usage: {
        dataUploadBytes: usageData.dataUploadBytes || Math.floor(Math.random() * 5000000),
        dataDownloadBytes: usageData.dataDownloadBytes || Math.floor(Math.random() * 20000000),
        totalBytes,
        smsCount: usageData.smsCount || Math.floor(Math.random() * 10),
        voiceSeconds: usageData.voiceSeconds || Math.floor(Math.random() * 300)
      },
      source: 'mqtt-simulator',
      recordId: generateRecordId()
    }

    const response = await simPortalApi.post('/api/v1/usage', payload)
    return response.data
  },

  // Submit batch usage records
  async submitUsageBatch(records) {
    const payload = {
      batchId: generateBatchId(),
      source: 'mqtt-simulator',
      records: records.map(r => ({
        ...r,
        recordId: r.recordId || generateRecordId()
      }))
    }

    const response = await simPortalApi.post('/api/v1/usage/batch', payload)
    return response.data
  },

  // Get usage for a SIM
  async getUsage(simId) {
    const response = await simPortalApi.get(`/api/v1/sims/${simId}/usage`)
    return response.data
  },

  // Helper to generate random usage data
  generateRandomUsage() {
    const upload = Math.floor(Math.random() * 5000000) // 0-5MB
    const download = Math.floor(Math.random() * 20000000) // 0-20MB
    return {
      dataUploadBytes: upload,
      dataDownloadBytes: download,
      totalBytes: upload + download,
      smsCount: Math.floor(Math.random() * 5),
      voiceSeconds: Math.floor(Math.random() * 180)
    }
  }
}
