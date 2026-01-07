import { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'
import { getSchemaName } from '../lib/db.js'

/**
 * Consumption endpoint: GET /api/consumption/unique-imsis
 * Returns unique IMSI values for filter options
 */

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
    if (!isSupabaseConfigured()) {
      // Return empty array if Supabase not configured
      return res.status(200).json({
        success: true,
        data: [],
        message: 'Supabase not configured'
      })
    }

    // Query unique IMSIs from provisioned_sims table
    const { data, error } = await supabase
      .schema(getSchemaName())
      .from('provisioned_sims')
      .select('imsi')
      .not('imsi', 'is', null)
      .order('imsi')

    if (error) {
      console.error('Error fetching unique IMSIs:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch IMSIs'
      })
    }

    // Transform to expected format and deduplicate
    const uniqueImsis = [...new Set((data || []).map(row => row.imsi).filter(Boolean))]
    const formattedData = uniqueImsis.map(imsi => ({ imsi }))

    return res.status(200).json({
      success: true,
      data: formattedData,
      cached: false
    })
  } catch (error) {
    console.error('Consumption unique-imsis error:', error)
    return res.status(503).json({
      success: false,
      error: 'Service unavailable'
    })
  }
}
