import axios from 'axios'

/**
 * Mediation Service - POST usage records to SIM Card Portal
 * Acts as a 3rd party mediation system simulator
 */

// Create axios instance with custom config
const createMediationApi = (config) => {
  return axios.create({
    baseURL: config.portalUrl,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    }
  })
}

export const mediationService = {
  /**
   * Submit single usage record
   * @param {Object} record - Usage record
   * @param {Object} config - API configuration
   */
  async submitUsage(record, config) {
    const api = createMediationApi(config)
    const response = await api.post('/api/v1/usage', record)
    return response.data
  },

  /**
   * Submit batch of usage records (max 1000)
   * @param {string} batchId - Unique batch identifier
   * @param {Array} records - Array of usage records
   * @param {string} source - Source identifier
   * @param {Object} config - API configuration
   */
  async submitBatch(batchId, records, source, config) {
    const api = createMediationApi(config)
    const response = await api.post('/api/v1/usage/batch', {
      batchId,
      source,
      records
    })
    return response.data
  },

  /**
   * Reset billing cycle for a SIM
   * @param {string} iccid - SIM ICCID
   * @param {Object} cycleData - Cycle reset data
   * @param {Object} config - API configuration
   */
  async resetCycle(iccid, cycleData, config) {
    const api = createMediationApi(config)
    const response = await api.post('/api/v1/usage/reset', {
      iccid,
      ...cycleData
    })
    return response.data
  },

  /**
   * Test connection to the portal
   * @param {Object} config - API configuration
   */
  async testConnection(config) {
    const api = createMediationApi(config)
    try {
      const response = await api.get('/api/v1/health')
      return { success: true, data: response.data }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      }
    }
  }
}
