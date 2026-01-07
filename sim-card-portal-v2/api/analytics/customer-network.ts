import { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Proxy endpoint for Analytics API: GET /analytics/customer/network
 * Returns deduplicated byte usage per MCCMNC network for a specific customer
 */

const ANALYTICS_API_URL = process.env.ANALYTICS_API_URL || 'http://localhost:9010'
const OAUTH_CLIENT_ID = process.env.ANALYTICS_OAUTH_CLIENT_ID || 'sim-portal'
const OAUTH_CLIENT_SECRET = process.env.ANALYTICS_OAUTH_CLIENT_SECRET || ''
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || ''

let tokenCache: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) {
    return tokenCache.token
  }

  if (!KEYCLOAK_URL) {
    return ''
  }

  const tokenUrl = `${KEYCLOAK_URL}/protocol/openid-connect/token`

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

function isValidPeriod(period: string): boolean {
  return /^\d{4}(-\d{2}(-\d{2})?)?$/.test(period)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { period, periodEnd, mccmnc, customer, tenant } = req.query

    if (!period || typeof period !== 'string' || !isValidPeriod(period)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid period format',
        message: 'Period must be in format yyyy, yyyy-MM, or yyyy-MM-dd'
      })
    }

    if (!customer || typeof customer !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Customer identifier required'
      })
    }

    const queryParams = new URLSearchParams()
    queryParams.append('period', period)
    queryParams.append('customer', customer)
    queryParams.append('tenant', typeof tenant === 'string' ? tenant : 'default-tenant')

    if (periodEnd && typeof periodEnd === 'string' && isValidPeriod(periodEnd)) {
      queryParams.append('periodEnd', periodEnd)
    }

    if (mccmnc) {
      const mccmncArray = Array.isArray(mccmnc) ? mccmnc : [mccmnc]
      mccmncArray.forEach(code => queryParams.append('mccmnc', code))
    }

    const accessToken = await getAccessToken()
    const analyticsUrl = `${ANALYTICS_API_URL}/analytics/customer/network?${queryParams}`

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    const response = await fetch(analyticsUrl, { method: 'GET', headers })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Analytics API error:', response.status, errorText)

      if (response.status === 401) {
        tokenCache = null
        return res.status(401).json({ success: false, error: 'Authentication failed' })
      }

      return res.status(response.status).json({
        success: false,
        error: 'Analytics API request failed',
        message: errorText
      })
    }

    const data = await response.json()
    return res.status(200).json({ success: true, data, cached: false })
  } catch (error) {
    console.error('Proxy error:', error)
    return res.status(503).json({
      success: false,
      error: 'Analytics service unavailable'
    })
  }
}
