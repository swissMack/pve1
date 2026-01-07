import { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * MCCMNC Lookup API: GET /api/mccmnc/lookup
 * Returns carrier names for given MCCMNC codes
 * Uses external MCC-MNC reference API with 24-hour caching
 */

const MCCMNC_API_URL = process.env.MCCMNC_API_URL || 'https://mcc-mnc.net/api'

// In-memory cache for carrier mappings (24-hour TTL)
const carrierCache = new Map<string, { data: CarrierInfo; expiresAt: number }>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

interface CarrierInfo {
  mccmnc: string
  carrierName: string
  countryCode: string
  networkType?: string
}

// Fallback mappings for common carriers (used when external API is unavailable)
const FALLBACK_CARRIERS: Record<string, CarrierInfo> = {
  '22288': { mccmnc: '22288', carrierName: 'TIM Italy', countryCode: 'IT', networkType: 'GSM' },
  '22210': { mccmnc: '22210', carrierName: 'Vodafone Italy', countryCode: 'IT', networkType: 'GSM' },
  '22201': { mccmnc: '22201', carrierName: 'TIM Italy', countryCode: 'IT', networkType: 'GSM' },
  '22299': { mccmnc: '22299', carrierName: 'Tre Italy', countryCode: 'IT', networkType: 'GSM' },
  '26201': { mccmnc: '26201', carrierName: 'T-Mobile Germany', countryCode: 'DE', networkType: 'GSM' },
  '26202': { mccmnc: '26202', carrierName: 'Vodafone Germany', countryCode: 'DE', networkType: 'GSM' },
  '26203': { mccmnc: '26203', carrierName: 'O2 Germany', countryCode: 'DE', networkType: 'GSM' },
  '23410': { mccmnc: '23410', carrierName: 'O2 UK', countryCode: 'GB', networkType: 'GSM' },
  '23415': { mccmnc: '23415', carrierName: 'Vodafone UK', countryCode: 'GB', networkType: 'GSM' },
  '23420': { mccmnc: '23420', carrierName: 'Three UK', countryCode: 'GB', networkType: 'GSM' },
  '23430': { mccmnc: '23430', carrierName: 'EE UK', countryCode: 'GB', networkType: 'GSM' },
  '20801': { mccmnc: '20801', carrierName: 'Orange France', countryCode: 'FR', networkType: 'GSM' },
  '20810': { mccmnc: '20810', carrierName: 'SFR France', countryCode: 'FR', networkType: 'GSM' },
  '20820': { mccmnc: '20820', carrierName: 'Bouygues France', countryCode: 'FR', networkType: 'GSM' },
  '31026': { mccmnc: '31026', carrierName: 'T-Mobile US', countryCode: 'US', networkType: 'GSM' },
  '310260': { mccmnc: '310260', carrierName: 'T-Mobile US', countryCode: 'US', networkType: 'LTE' },
  '311480': { mccmnc: '311480', carrierName: 'Verizon US', countryCode: 'US', networkType: 'LTE' },
  '310410': { mccmnc: '310410', carrierName: 'AT&T US', countryCode: 'US', networkType: 'GSM' }
}

/**
 * Validate MCCMNC format (5-6 digits)
 */
function isValidMccmnc(code: string): boolean {
  return /^\d{5,6}$/.test(code)
}

/**
 * Lookup carrier info from external API or cache
 */
async function lookupCarrier(mccmnc: string): Promise<CarrierInfo> {
  // Check cache first
  const cached = carrierCache.get(mccmnc)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  // Check fallback carriers
  if (FALLBACK_CARRIERS[mccmnc]) {
    const fallback = FALLBACK_CARRIERS[mccmnc]
    carrierCache.set(mccmnc, { data: fallback, expiresAt: Date.now() + CACHE_TTL_MS })
    return fallback
  }

  try {
    // Try external API
    const response = await fetch(`${MCCMNC_API_URL}?mccmnc=${mccmnc}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    })

    if (response.ok) {
      const data = await response.json() as { network?: string; operator?: string; countryCode?: string; iso?: string; type?: string }

      const carrierInfo: CarrierInfo = {
        mccmnc,
        carrierName: data.network || data.operator || `Network ${mccmnc}`,
        countryCode: data.countryCode || data.iso || mccmnc.substring(0, 3),
        networkType: data.type || 'GSM'
      }

      carrierCache.set(mccmnc, { data: carrierInfo, expiresAt: Date.now() + CACHE_TTL_MS })
      return carrierInfo
    }
  } catch (error) {
    console.warn(`Failed to lookup MCCMNC ${mccmnc}:`, error)
  }

  // Return generic fallback
  const genericInfo: CarrierInfo = {
    mccmnc,
    carrierName: `Network ${mccmnc}`,
    countryCode: mccmnc.substring(0, 3),
    networkType: 'Unknown'
  }

  carrierCache.set(mccmnc, { data: genericInfo, expiresAt: Date.now() + CACHE_TTL_MS })
  return genericInfo
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { codes } = req.query

    if (!codes) {
      return res.status(400).json({
        success: false,
        error: 'MCCMNC codes required',
        message: 'Provide codes as comma-separated or repeated query parameter'
      })
    }

    const codeArray = Array.isArray(codes) ? codes : codes.split(',').map(c => c.trim())

    // Validate all codes
    for (const code of codeArray) {
      if (!isValidMccmnc(code)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid MCCMNC format',
          message: `MCCMNC code must be 5-6 digits: ${code}`
        })
      }
    }

    // Lookup all carriers in parallel
    const carrierPromises = codeArray.map(code => lookupCarrier(code))
    const carriers = await Promise.all(carrierPromises)

    return res.status(200).json({
      success: true,
      data: carriers
    })
  } catch (error) {
    console.error('MCCMNC lookup error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to lookup carrier information'
    })
  }
}
