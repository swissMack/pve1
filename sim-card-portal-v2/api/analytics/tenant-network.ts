import { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Proxy endpoint for Analytics API: GET /analytics/tenant/network
 * Returns deduplicated byte usage per MCCMNC network for the authenticated tenant
 */

const ANALYTICS_API_URL = process.env.ANALYTICS_API_URL || 'http://localhost:9010'
const OAUTH_CLIENT_ID = process.env.ANALYTICS_OAUTH_CLIENT_ID || 'sim-portal'
const OAUTH_CLIENT_SECRET = process.env.ANALYTICS_OAUTH_CLIENT_SECRET || ''
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || ''

// Token cache to avoid requesting new token for every request
let tokenCache: { token: string; expiresAt: number } | null = null

/**
 * Get OAuth2 access token from Keycloak
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) {
    return tokenCache.token
  }

  // If no Keycloak URL configured, skip auth (for development)
  if (!KEYCLOAK_URL) {
    console.warn('KEYCLOAK_URL not configured, skipping OAuth2 authentication')
    return ''
  }

  const tokenUrl = `${KEYCLOAK_URL}/protocol/openid-connect/token`

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: OAUTH_CLIENT_ID,
      client_secret: OAUTH_CLIENT_SECRET
    })
  })

  if (!response.ok) {
    throw new Error(`OAuth2 token request failed: ${response.status}`)
  }

  const data = await response.json() as { access_token: string; expires_in: number }
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000)
  }

  return tokenCache.token
}

/**
 * Validate period format (yyyy, yyyy-MM, or yyyy-MM-dd)
 */
function isValidPeriod(period: string): boolean {
  return /^\d{4}(-\d{2}(-\d{2})?)?$/.test(period)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }

  try {
    // Extract query parameters
    const { period, periodEnd, mccmnc, tenant } = req.query

    // Validate required parameters
    if (!period || typeof period !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid period format',
        message: 'Period must be in format yyyy, yyyy-MM, or yyyy-MM-dd'
      })
    }

    if (!isValidPeriod(period)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid period format',
        message: 'Period must be in format yyyy, yyyy-MM, or yyyy-MM-dd'
      })
    }

    if (periodEnd && typeof periodEnd === 'string' && !isValidPeriod(periodEnd)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid periodEnd format',
        message: 'periodEnd must be in format yyyy, yyyy-MM, or yyyy-MM-dd'
      })
    }

    // Build query string for Analytics API
    const queryParams = new URLSearchParams()
    queryParams.append('period', period)

    if (periodEnd && typeof periodEnd === 'string') {
      queryParams.append('periodEnd', periodEnd)
    }

    // Handle mccmnc array parameter
    if (mccmnc) {
      const mccmncArray = Array.isArray(mccmnc) ? mccmnc : [mccmnc]
      mccmncArray.forEach(code => queryParams.append('mccmnc', code))
    }

    // Use tenant from query or default (in production, derive from session)
    const tenantId = (typeof tenant === 'string' ? tenant : 'default-tenant')
    queryParams.append('tenant', tenantId)

    // Get OAuth2 token
    const accessToken = await getAccessToken()

    // Forward request to Analytics API
    const analyticsUrl = `${ANALYTICS_API_URL}/analytics/tenant/network?${queryParams}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    const response = await fetch(analyticsUrl, {
      method: 'GET',
      headers
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Analytics API error:', response.status, errorText)

      if (response.status === 401) {
        // Clear token cache on auth error
        tokenCache = null
        return res.status(401).json({
          success: false,
          error: 'Authentication failed with Analytics API'
        })
      }

      return res.status(response.status).json({
        success: false,
        error: 'Analytics API request failed',
        message: errorText
      })
    }

    const data = await response.json()

    return res.status(200).json({
      success: true,
      data: data,
      cached: false
    })
  } catch (error) {
    console.error('Proxy error:', error)

    if (error instanceof Error && error.message.includes('fetch')) {
      return res.status(503).json({
        success: false,
        error: 'Analytics service unavailable',
        message: 'Unable to connect to Analytics API'
      })
    }

    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}
