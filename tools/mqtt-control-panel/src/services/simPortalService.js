/**
 * SIM Card Portal API Service
 * Integrates with the SIM Card Portal Docker API
 */

import axios from 'axios'

// Dynamic API URL based on current host
const getPortalApiBase = () => {
  const hostname = window.location.hostname
  // Use port 3001 for API on the same host
  return `http://${hostname}:3001`
}

const PORTAL_API_BASE = getPortalApiBase()
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
  const base = '894128'
  const mid = String(Date.now() % 10000000).padStart(7, '0')
  const end = String(Math.floor(Math.random() * 1000000)).padStart(6, '0')
  return base + mid + end
}

function generateImsi() {
  const base = '22801'
  const msin = String(Date.now() % 10000000000).padStart(10, '0')
  return base + msin
}

function generateMsisdn() {
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
  async healthCheck() {
    const response = await simPortalApi.get('/api/v1/health')
    return response.data
  },

  async listSims(params = {}) {
    const response = await simPortalApi.get('/api/simcards', { params })
    const sims = response.data.data || response.data || []
    return {
      data: Array.isArray(sims) ? sims.map(transformSim) : []
    }
  },

  async getSim(simId) {
    const response = await simPortalApi.get(`/api/simcards/${simId}`)
    const sim = response.data.data || response.data
    return { data: transformSim(sim) }
  },

  async createSim(customData = {}) {
    const iccid = customData.iccid || generateIccid()
    const msisdn = customData.msisdn || generateMsisdn()
    const simId = 'SIM-' + Date.now()

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

  async activateSim(simId, notes = '') {
    console.log('[simPortalService] SIM activation simulated for:', simId)
    return {
      success: true,
      simId,
      status: 'ACTIVE',
      message: 'SIM activated successfully (simulated)'
    }
  },

  async deactivateSim(simId, notes = '') {
    console.log('[simPortalService] SIM deactivation simulated for:', simId)
    return {
      success: true,
      simId,
      status: 'INACTIVE',
      message: 'SIM deactivated successfully (simulated)'
    }
  },

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

  async unblockSim(simId, notes = '') {
    console.log('[simPortalService] SIM unblock simulated for:', simId)
    return {
      success: true,
      simId,
      status: 'ACTIVE',
      message: 'SIM unblocked successfully (simulated)'
    }
  },

  async submitUsage(iccid, usageData = {}) {
    const now = new Date()
    const periodStart = new Date(now.getTime() - 5 * 60 * 1000)

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

  async getUsage(simId) {
    const response = await simPortalApi.get(`/api/v1/sims/${simId}/usage`)
    return response.data
  },

  generateRandomUsage() {
    const upload = Math.floor(Math.random() * 5000000)
    const download = Math.floor(Math.random() * 20000000)
    return {
      dataUploadBytes: upload,
      dataDownloadBytes: download,
      totalBytes: upload + download,
      smsCount: Math.floor(Math.random() * 5),
      voiceSeconds: Math.floor(Math.random() * 180)
    }
  }
}
