/**
 * SIM Card Portal API Service
 * Integrates with the SIM Card Portal v2 API
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

  // List SIMs from the portal
  async listSims(params = {}) {
    const response = await simPortalApi.get('/api/v1/sims', { params })
    return response.data
  },

  // Get single SIM details
  async getSim(simId) {
    const response = await simPortalApi.get(`/api/v1/sims/${simId}`)
    return response.data
  },

  // Create a new SIM card
  async createSim(customData = {}) {
    const iccid = customData.iccid || generateIccid()
    const msisdn = customData.msisdn || generateMsisdn()

    // Call Provisioning API v1 first
    const payload = {
      iccid,
      imsi: customData.imsi || generateImsi(),
      msisdn,
      profile: {
        apn: customData.apn || 'iot.simportal.ch',
        ratePlanId: customData.ratePlanId || 'plan_iot_standard',
        dataLimit: customData.dataLimit || 1073741824, // 1GB in bytes
        billingAccountId: customData.billingAccountId || 'ba_demo_001',
        customerId: customData.customerId || 'cust_demo_001'
      },
      metadata: {
        source: 'mqtt-simulator',
        createdBy: 'control-panel',
        ...customData.metadata
      },
      activateImmediately: customData.activateImmediately ?? true
    }

    const response = await simPortalApi.post('/api/v1/sims', payload)

    // Also create in legacy sim_cards table for Portal UI visibility
    try {
      await simPortalApi.post('/api/simcards', {
        id: response.data.simId,
        iccid,
        msisdn,
        status: response.data.status === 'ACTIVE' ? 'Active' : 'Inactive',
        carrier: 'Swiss Telecom',
        plan: customData.ratePlanId || 'IoT Standard',
        dataUsed: '0 MB',
        dataLimit: '1 GB',
        activationDate: new Date().toISOString().split('T')[0],
        expiryDate: customData.expiryDate || null
      })
      console.log('[simPortalService] SIM also added to legacy table for Portal UI')
    } catch (legacyErr) {
      console.warn('[simPortalService] Failed to add to legacy table (non-critical):', legacyErr.message)
    }

    return response.data
  },

  // Activate a SIM
  async activateSim(simId, notes = '') {
    const response = await simPortalApi.post(`/api/v1/sims/${simId}/activate`, {
      reason: 'Activated via MQTT Simulator',
      notes,
      notifyProvisioning: true
    })
    return response.data
  },

  // Deactivate a SIM
  async deactivateSim(simId, notes = '') {
    const response = await simPortalApi.post(`/api/v1/sims/${simId}/deactivate`, {
      reason: 'Deactivated via MQTT Simulator',
      notes,
      notifyProvisioning: true
    })
    return response.data
  },

  // Block a SIM
  async blockSim(simId, reason = 'MANUAL', notes = '') {
    const response = await simPortalApi.post(`/api/v1/sims/${simId}/block`, {
      reason, // MANUAL, FRAUD_SUSPECTED, USAGE_THRESHOLD_EXCEEDED, etc.
      notes,
      notifyProvisioning: true
    })
    return response.data
  },

  // Unblock a SIM
  async unblockSim(simId, notes = '') {
    const response = await simPortalApi.post(`/api/v1/sims/${simId}/unblock`, {
      reason: 'MANUAL',
      notes,
      notifyProvisioning: true
    })
    return response.data
  },

  // Submit usage record for a SIM
  async submitUsage(iccid, usageData = {}) {
    const now = new Date()
    const periodStart = new Date(now.getTime() - 5 * 60 * 1000) // 5 minutes ago

    const payload = {
      iccid,
      periodStart: periodStart.toISOString(),
      periodEnd: now.toISOString(),
      usage: {
        dataUploadBytes: usageData.upload || Math.floor(Math.random() * 5000000), // 0-5MB upload
        dataDownloadBytes: usageData.download || Math.floor(Math.random() * 20000000), // 0-20MB download
        totalBytes: usageData.total || (usageData.upload || 0) + (usageData.download || 0) || Math.floor(Math.random() * 25000000),
        smsCount: usageData.sms || Math.floor(Math.random() * 10),
        voiceSeconds: usageData.voice || Math.floor(Math.random() * 300)
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
