import axios from 'axios'

/**
 * Analytics Service - GET analytics/consumption data from SIM Card Portal API
 * Updated to use the deployed consumption endpoints (port 3001)
 * Used to verify submitted usage data and view analytics
 */

// Create axios instance with custom config
const createAnalyticsApi = (baseUrl) => {
  return axios.create({
    baseURL: baseUrl,
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

// Build query string from params object (handles arrays for imsi/mccmnc)
const buildQueryParams = (params) => {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return

    if (Array.isArray(value)) {
      // Handle array params (imsi, mccmnc) - add each as separate param
      value.forEach(v => {
        if (v) searchParams.append(key, v)
      })
    } else {
      searchParams.append(key, value)
    }
  })

  return searchParams.toString()
}

export const analyticsService = {
  /**
   * Ping the API service (health check)
   * @param {string} baseUrl - API base URL
   */
  async ping(baseUrl) {
    const api = createAnalyticsApi(baseUrl)
    try {
      const response = await api.get('/api/health')
      return { success: true, data: response.data }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      }
    }
  },

  /**
   * Get KPI summary data
   * @param {Object} params - { startDate?, endDate? }
   * @param {string} baseUrl - API base URL
   */
  async getKpis(params, baseUrl) {
    const api = createAnalyticsApi(baseUrl)
    const queryString = buildQueryParams(params)
    const response = await api.get(`/api/consumption/kpis?${queryString}`)
    return response.data
  },

  /**
   * Get usage trends data
   * @param {Object} params - { startDate?, endDate?, granularity? }
   * @param {string} baseUrl - API base URL
   */
  async getTrends(params, baseUrl) {
    const api = createAnalyticsApi(baseUrl)
    const queryString = buildQueryParams(params)
    const response = await api.get(`/api/consumption/trends?${queryString}`)
    return response.data
  },

  /**
   * Get carrier breakdown data
   * @param {Object} params - { startDate?, endDate? }
   * @param {string} baseUrl - API base URL
   */
  async getCarriers(params, baseUrl) {
    const api = createAnalyticsApi(baseUrl)
    const queryString = buildQueryParams(params)
    const response = await api.get(`/api/consumption/carriers?${queryString}`)
    return response.data
  },

  /**
   * Get detailed usage records
   * @param {Object} params - { startDate?, endDate?, iccid?, limit?, offset? }
   * @param {string} baseUrl - API base URL
   */
  async getUsageDetails(params, baseUrl) {
    const api = createAnalyticsApi(baseUrl)
    const queryString = buildQueryParams(params)
    const response = await api.get(`/api/consumption/usage-details?${queryString}`)
    return response.data
  },

  /**
   * Get unique IMSI list
   * @param {Object} params - { startDate?, endDate? }
   * @param {string} baseUrl - API base URL
   */
  async getUniqueImsis(params, baseUrl) {
    const api = createAnalyticsApi(baseUrl)
    const queryString = buildQueryParams(params)
    const response = await api.get(`/api/consumption/unique-imsis?${queryString}`)
    return response.data
  },

  /**
   * Get carrier locations data
   * @param {Object} params - { startDate?, endDate? }
   * @param {string} baseUrl - API base URL
   */
  async getCarrierLocations(params, baseUrl) {
    const api = createAnalyticsApi(baseUrl)
    const queryString = buildQueryParams(params)
    const response = await api.get(`/api/consumption/carrier-locations?${queryString}`)
    return response.data
  },

  /**
   * Get regional usage data
   * @param {Object} params - { startDate?, endDate? }
   * @param {string} baseUrl - API base URL
   */
  async getRegional(params, baseUrl) {
    const api = createAnalyticsApi(baseUrl)
    const queryString = buildQueryParams(params)
    const response = await api.get(`/api/consumption/regional?${queryString}`)
    return response.data
  },

  /**
   * Execute query for any endpoint
   * @param {string} endpoint - Endpoint key
   * @param {Object} params - Query parameters
   * @param {string} baseUrl - API base URL
   */
  async executeQuery(endpoint, params, baseUrl) {
    const methodMap = {
      'kpis': this.getKpis,
      'trends': this.getTrends,
      'carriers': this.getCarriers,
      'usage-details': this.getUsageDetails,
      'unique-imsis': this.getUniqueImsis,
      'carrier-locations': this.getCarrierLocations,
      'regional': this.getRegional
    }

    const method = methodMap[endpoint]
    if (!method) {
      throw new Error(`Unknown endpoint: ${endpoint}`)
    }

    return method.call(this, params, baseUrl)
  }
}

// Endpoint definitions for UI - Updated to match deployed API
export const ANALYTICS_ENDPOINTS = [
  {
    key: 'kpis',
    label: 'KPI Summary',
    path: '/api/consumption/kpis',
    requiredParams: [],
    optionalParams: ['startDate', 'endDate'],
    description: 'Total usage, active SIMs, and key metrics'
  },
  {
    key: 'trends',
    label: 'Usage Trends',
    path: '/api/consumption/trends',
    requiredParams: [],
    optionalParams: ['startDate', 'endDate', 'granularity'],
    description: 'Usage over time with configurable granularity'
  },
  {
    key: 'carriers',
    label: 'Carrier Breakdown',
    path: '/api/consumption/carriers',
    requiredParams: [],
    optionalParams: ['startDate', 'endDate'],
    description: 'Usage breakdown by carrier/network'
  },
  {
    key: 'usage-details',
    label: 'Usage Details',
    path: '/api/consumption/usage-details',
    requiredParams: [],
    optionalParams: ['startDate', 'endDate', 'iccid', 'limit', 'offset'],
    description: 'Detailed usage records with filtering'
  },
  {
    key: 'unique-imsis',
    label: 'Unique IMSIs',
    path: '/api/consumption/unique-imsis',
    requiredParams: [],
    optionalParams: ['startDate', 'endDate'],
    description: 'List of unique IMSIs with usage'
  },
  {
    key: 'carrier-locations',
    label: 'Carrier Locations',
    path: '/api/consumption/carrier-locations',
    requiredParams: [],
    optionalParams: ['startDate', 'endDate'],
    description: 'Geographic distribution of carrier usage'
  },
  {
    key: 'regional',
    label: 'Regional Usage',
    path: '/api/consumption/regional',
    requiredParams: [],
    optionalParams: ['startDate', 'endDate'],
    description: 'Usage aggregated by region'
  }
]
