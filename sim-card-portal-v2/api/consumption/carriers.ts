import { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Consumption endpoint: GET /api/consumption/carriers
 * Returns carrier breakdown data with MCCMNC codes and usage
 */

const ANALYTICS_API_URL = process.env.ANALYTICS_API_URL || 'http://localhost:9010'
const OAUTH_CLIENT_ID = process.env.ANALYTICS_OAUTH_CLIENT_ID || 'sim-portal'
const OAUTH_CLIENT_SECRET = process.env.ANALYTICS_OAUTH_CLIENT_SECRET || ''
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || ''
const DEFAULT_TENANT = process.env.DEFAULT_TENANT || 'default-tenant'

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

function getCurrentPeriod(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function getStartOfYearPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-01`
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
    const { tenant } = req.query

    // Default to current year's data for carrier breakdown
    const period = getStartOfYearPeriod()
    const periodEnd = getCurrentPeriod()

    const queryParams = new URLSearchParams()
    queryParams.append('period', period)
    queryParams.append('periodEnd', periodEnd)
    queryParams.append('tenant', typeof tenant === 'string' ? tenant : DEFAULT_TENANT)

    const accessToken = await getAccessToken()
    const analyticsUrl = `${ANALYTICS_API_URL}/analytics/tenant/network?${queryParams}`

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

    const rawData = await response.json()

    // Transform to carrier format expected by frontend
    // Frontend expects: { mccmnc, bytes, ... }
    interface AnalyticsRow {
      mccmnc?: string
      bytes?: number
      period?: string
    }

    // Aggregate by MCCMNC
    const carrierMap = new Map<string, number>()
    for (const row of rawData as AnalyticsRow[]) {
      const mccmnc = row.mccmnc || 'Unknown'
      const bytes = row.bytes || 0
      carrierMap.set(mccmnc, (carrierMap.get(mccmnc) || 0) + bytes)
    }

    const carriers = Array.from(carrierMap.entries()).map(([mccmnc, bytes]) => ({
      mccmnc,
      bytes,
      dataUsageGB: bytes / (1024 * 1024 * 1024)
    }))

    // Sort by bytes descending
    carriers.sort((a, b) => b.bytes - a.bytes)

    return res.status(200).json({
      success: true,
      data: carriers,
      cached: false
    })
  } catch (error) {
    console.error('Consumption carriers error:', error)
    return res.status(503).json({
      success: false,
      error: 'Analytics service unavailable'
    })
  }
}
