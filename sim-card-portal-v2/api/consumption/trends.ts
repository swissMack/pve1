import { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Consumption endpoint: GET /api/consumption/trends
 * Returns consumption trend data over time for charts
 */

const ANALYTICS_API_URL = process.env.ANALYTICS_API_URL || 'http://localhost:9010'
const OAUTH_CLIENT_ID = process.env.ANALYTICS_OAUTH_CLIENT_ID || 'sim-portal'
const OAUTH_CLIENT_SECRET = process.env.ANALYTICS_OAUTH_CLIENT_SECRET || ''
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || ''
const DEFAULT_TENANT = process.env.DEFAULT_TENANT || 'default-tenant'
const COST_PER_GB = parseFloat(process.env.COST_PER_GB || '0.50')

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

interface TrendPeriod {
  period: string
  periodStart: string
  periodEnd: string
}

function generatePeriods(granularity: string): TrendPeriod[] {
  const periods: TrendPeriod[] = []
  const now = new Date()

  switch (granularity) {
    case 'hourly':
    case '24h': {
      // Last 24 hours by hour
      for (let i = 23; i >= 0; i--) {
        const date = new Date(now)
        date.setHours(date.getHours() - i)
        const hour = date.getHours()
        const dayStr = date.toISOString().split('T')[0]
        periods.push({
          period: `${hour.toString().padStart(2, '0')}:00`,
          periodStart: dayStr,
          periodEnd: dayStr
        })
      }
      break
    }
    case 'daily': {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        const dayStr = date.toISOString().split('T')[0]
        periods.push({
          period: dayStr,
          periodStart: dayStr,
          periodEnd: dayStr
        })
      }
      break
    }
    case 'weekly': {
      // Last 5 weeks
      for (let i = 4; i >= 0; i--) {
        const weekEnd = new Date(now)
        weekEnd.setDate(weekEnd.getDate() - (i * 7))
        const weekStart = new Date(weekEnd)
        weekStart.setDate(weekStart.getDate() - 6)

        const weekNum = Math.ceil((weekEnd.getDate() - weekEnd.getDay() + 1) / 7)
        periods.push({
          period: `W${weekNum} ${weekEnd.toLocaleDateString('en-US', { month: 'short' })}`,
          periodStart: weekStart.toISOString().split('T')[0],
          periodEnd: weekEnd.toISOString().split('T')[0]
        })
      }
      break
    }
    case 'monthly':
    default: {
      // Last 6 months
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        periods.push({
          period: `${year}-${month}`,
          periodStart: `${year}-${month}`,
          periodEnd: `${year}-${month}`
        })
      }
      break
    }
  }

  return periods
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
    const { granularity = 'monthly', tenant, mccmnc, imsi } = req.query

    const periods = generatePeriods(granularity as string)

    // For each period, try to get data from Analytics API
    const accessToken = await getAccessToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    const tenantId = typeof tenant === 'string' ? tenant : DEFAULT_TENANT

    // Build trend data - fetch aggregated data for the full range
    const firstPeriod = periods[0]
    const lastPeriod = periods[periods.length - 1]

    const queryParams = new URLSearchParams()
    queryParams.append('period', firstPeriod.periodStart)
    queryParams.append('periodEnd', lastPeriod.periodEnd)
    queryParams.append('tenant', tenantId)

    // Handle mccmnc filter
    if (mccmnc) {
      const mccmncArray = Array.isArray(mccmnc) ? mccmnc : [mccmnc]
      mccmncArray.forEach(code => queryParams.append('mccmnc', code))
    }

    const analyticsUrl = `${ANALYTICS_API_URL}/analytics/tenant/network?${queryParams}`

    let analyticsData: Array<{ mccmnc?: string; bytes?: number; period?: string }> = []

    try {
      const response = await fetch(analyticsUrl, { method: 'GET', headers })
      if (response.ok) {
        analyticsData = await response.json() as typeof analyticsData
      }
    } catch (fetchError) {
      console.warn('Analytics API not available, using simulated data')
    }

    // Group analytics data by period if available
    const dataByPeriod = new Map<string, number>()
    for (const row of analyticsData) {
      const period = row.period || ''
      const bytes = row.bytes || 0
      dataByPeriod.set(period, (dataByPeriod.get(period) || 0) + bytes)
    }

    // Build trend response
    const trends = periods.map((p, index) => {
      // Try to match analytics data to this period
      let bytes = dataByPeriod.get(p.periodStart) || dataByPeriod.get(p.period) || 0

      // If no real data, generate reasonable sample data based on position
      if (bytes === 0 && analyticsData.length === 0) {
        // Generate sample trend data for demo purposes
        const baseGB = 50 + Math.random() * 30
        const variation = Math.sin((index / periods.length) * Math.PI) * 20
        bytes = (baseGB + variation) * 1024 * 1024 * 1024
      }

      const dataUsageGB = bytes / (1024 * 1024 * 1024)
      const cost = dataUsageGB * COST_PER_GB

      return {
        period: p.period,
        dataUsageGB: Math.round(dataUsageGB * 100) / 100,
        cost: Math.round(cost * 100) / 100,
        simCount: Math.floor(10 + Math.random() * 20) // Placeholder SIM count
      }
    })

    return res.status(200).json({
      success: true,
      data: trends,
      cached: false
    })
  } catch (error) {
    console.error('Consumption trends error:', error)
    return res.status(503).json({
      success: false,
      error: 'Analytics service unavailable'
    })
  }
}
