import axios from 'axios'

/**
 * Analytics Service - GET analytics data from Analytics Service API
 * Used to verify submitted usage data
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
   * Ping the analytics service
   * @param {string} baseUrl - Analytics API base URL
   */
  async ping(baseUrl) {
    const api = createAnalyticsApi(baseUrl)
    try {
      const response = await api.get('/ping')
      return { success: true, data: response.data }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      }
    }
  },

  /**
   * Get usage per IMSI
   * @param {Object} params - { tenant, customer, imsi[], period, periodEnd? }
   * @param {string} baseUrl - Analytics API base URL
   */
  async getImsiUsage(params, baseUrl) {
    const api = createAnalyticsApi(baseUrl)
    const queryString = buildQueryParams(params)
    const response = await api.get(`/analytics/imsi?${queryString}`)
    return response.data
  },

  /**
   * Get usage per IMSI per network
   * @param {Object} params - { tenant, customer, imsi[], mccmnc[]?, period, periodEnd? }
   * @param {string} baseUrl - Analytics API base URL
   */
  async getImsiNetworkUsage(params, baseUrl) {
    const api = createAnalyticsApi(baseUrl)
    const queryString = buildQueryParams(params)
    const response = await api.get(`/analytics/imsi/network?${queryString}`)
    return response.data
  },

  /**
   * Get usage per customer per network
   * @param {Object} params - { tenant, customer, mccmnc[]?, period, periodEnd? }
   * @param {string} baseUrl - Analytics API base URL
   */
  async getCustomerNetworkUsage(params, baseUrl) {
    const api = createAnalyticsApi(baseUrl)
    const queryString = buildQueryParams(params)
    const response = await api.get(`/analytics/customer/network?${queryString}`)
    return response.data
  },

  /**
   * Get usage per tenant per network
   * @param {Object} params - { tenant, mccmnc[]?, period, periodEnd? }
   * @param {string} baseUrl - Analytics API base URL
   */
  async getTenantNetworkUsage(params, baseUrl) {
    const api = createAnalyticsApi(baseUrl)
    const queryString = buildQueryParams(params)
    const response = await api.get(`/analytics/tenant/network?${queryString}`)
    return response.data
  },

  /**
   * Get unique IMSI count per customer per network
   * @param {Object} params - { tenant, customer, mccmnc[]?, period, periodEnd? }
   * @param {string} baseUrl - Analytics API base URL
   */
  async getUniqueImsiCustomerNetwork(params, baseUrl) {
    const api = createAnalyticsApi(baseUrl)
    const queryString = buildQueryParams(params)
    const response = await api.get(`/analytics/unique/imsi/count/customer/network?${queryString}`)
    return response.data
  },

  /**
   * Get unique IMSI count per tenant per network
   * @param {Object} params - { tenant, mccmnc[]?, period, periodEnd? }
   * @param {string} baseUrl - Analytics API base URL
   */
  async getUniqueImsiTenantNetwork(params, baseUrl) {
    const api = createAnalyticsApi(baseUrl)
    const queryString = buildQueryParams(params)
    const response = await api.get(`/analytics/unique/imsi/count/tenant/network?${queryString}`)
    return response.data
  },

  /**
   * Execute query for any endpoint
   * @param {string} endpoint - Endpoint key
   * @param {Object} params - Query parameters
   * @param {string} baseUrl - Analytics API base URL
   */
  async executeQuery(endpoint, params, baseUrl) {
    const methodMap = {
      'imsi': this.getImsiUsage,
      'imsi/network': this.getImsiNetworkUsage,
      'customer/network': this.getCustomerNetworkUsage,
      'tenant/network': this.getTenantNetworkUsage,
      'unique/imsi/count/customer/network': this.getUniqueImsiCustomerNetwork,
      'unique/imsi/count/tenant/network': this.getUniqueImsiTenantNetwork
    }

    const method = methodMap[endpoint]
    if (!method) {
      throw new Error(`Unknown endpoint: ${endpoint}`)
    }

    return method.call(this, params, baseUrl)
  }
}

// Endpoint definitions for UI
export const ANALYTICS_ENDPOINTS = [
  {
    key: 'imsi',
    label: 'Usage per IMSI',
    path: '/analytics/imsi',
    requiredParams: ['tenant', 'customer', 'imsi', 'period'],
    optionalParams: ['periodEnd']
  },
  {
    key: 'imsi/network',
    label: 'Usage per IMSI per Network',
    path: '/analytics/imsi/network',
    requiredParams: ['tenant', 'customer', 'imsi', 'period'],
    optionalParams: ['mccmnc', 'periodEnd']
  },
  {
    key: 'customer/network',
    label: 'Usage per Customer per Network',
    path: '/analytics/customer/network',
    requiredParams: ['tenant', 'customer', 'period'],
    optionalParams: ['mccmnc', 'periodEnd']
  },
  {
    key: 'tenant/network',
    label: 'Usage per Tenant per Network',
    path: '/analytics/tenant/network',
    requiredParams: ['tenant', 'period'],
    optionalParams: ['mccmnc', 'periodEnd']
  },
  {
    key: 'unique/imsi/count/customer/network',
    label: 'Unique IMSI Count (Customer/Network)',
    path: '/analytics/unique/imsi/count/customer/network',
    requiredParams: ['tenant', 'customer', 'period'],
    optionalParams: ['mccmnc', 'periodEnd']
  },
  {
    key: 'unique/imsi/count/tenant/network',
    label: 'Unique IMSI Count (Tenant/Network)',
    path: '/analytics/unique/imsi/count/tenant/network',
    requiredParams: ['tenant', 'period'],
    optionalParams: ['mccmnc', 'periodEnd']
  }
]
