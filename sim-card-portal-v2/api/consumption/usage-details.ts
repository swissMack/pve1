import { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Consumption endpoint: GET /api/consumption/usage-details
 * Returns detailed usage records per IMSI and MCCMNC for the requested date range
 */

const ANALYTICS_API_URL = process.env.ANALYTICS_API_URL || 'http://localhost:9010'
const OAUTH_CLIENT_ID = process.env.ANALYTICS_OAUTH_CLIENT_ID || 'sim-portal'
const OAUTH_CLIENT_SECRET = process.env.ANALYTICS_OAUTH_CLIENT_SECRET || ''
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || ''
const DEFAULT_TENANT = process.env.DEFAULT_TENANT || 'default-tenant'
const DEFAULT_CUSTOMER = process.env.DEFAULT_CUSTOMER || 'default-customer'

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

function dateToPeriod(dateStr: string, granularity: string): string {
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  switch (granularity) {
    case '24h':
    case 'daily':
      return `${year}-${month}-${day}`
    case 'weekly':
    case 'monthly':
    default:
      return `${year}-${month}`
  }
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
    const { start_date, end_date, granularity = 'monthly', mccmnc, imsi, tenant, customer } = req.query

    if (!start_date || typeof start_date !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'start_date is required'
      })
    }

    if (!end_date || typeof end_date !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'end_date is required'
      })
    }

    // Convert dates to period format for Analytics API
    const period = dateToPeriod(start_date, granularity as string)
    const periodEnd = dateToPeriod(end_date, granularity as string)

    // Build query for Analytics API - use tenant/network endpoint for broad data
    const queryParams = new URLSearchParams()
    queryParams.append('period', period)
    queryParams.append('periodEnd', periodEnd)
    queryParams.append('tenant', typeof tenant === 'string' ? tenant : DEFAULT_TENANT)

    // Handle mccmnc filter
    if (mccmnc) {
      const mccmncArray = Array.isArray(mccmnc) ? mccmnc : [mccmnc]
      mccmncArray.forEach(code => queryParams.append('mccmnc', code))
    }

    const accessToken = await getAccessToken()

    // First, get network-level data
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

    // Transform data to match frontend expectations
    // The frontend expects: { imsi, mccmnc, bytes, day/month/year, latestEventAt }
    interface AnalyticsRow {
      mccmnc?: string
      bytes?: number
      period?: string
      latestEventAt?: string
      imsi?: string
    }

    const transformedData = (rawData as AnalyticsRow[]).map((row: AnalyticsRow) => {
      const periodValue = row.period || period
      const granularityStr = granularity as string

      return {
        imsi: row.imsi || 'All IMSIs',
        mccmnc: row.mccmnc || 'Unknown',
        bytes: row.bytes || 0,
        ...(granularityStr === 'daily' || granularityStr === '24h'
          ? { day: periodValue }
          : granularityStr === 'monthly'
            ? { month: periodValue }
            : { year: periodValue.substring(0, 4) }
        ),
        latestEventAt: row.latestEventAt || new Date().toISOString()
      }
    })

    return res.status(200).json({
      success: true,
      data: transformedData,
      cached: false
    })
  } catch (error) {
    console.error('Consumption usage-details error:', error)
    return res.status(503).json({
      success: false,
      error: 'Analytics service unavailable'
    })
  }
}
