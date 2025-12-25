import { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from './lib/supabase.js'
import { getSchemaName } from './lib/db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== SIM CARDS API CALLED ===')
  console.log('Method:', req.method)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { available } = req.query

    let query = supabase
      .schema(getSchemaName())
      .from('sim_cards')
      .select(`
        id,
        iccid,
        msisdn,
        status,
        carriers:carrier_id(name),
        plans:plan_id(name)
      `)
      .order('id', { ascending: true })

    // Filter for available status SIM cards if requested
    if (available === 'true') {
      query = query.eq('status', 'available' as any)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching SIM cards:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch SIM cards'
      })
    }

    // Transform the data to include carrier and plan names
    const transformedData = (data || []).map((sim: any) => ({
      id: sim.id,
      iccid: sim.iccid,
      msisdn: sim.msisdn,
      status: sim.status,
      carrier: sim.carriers?.name || 'Unknown',
      plan: sim.plans?.name || 'Unknown'
    }))

    return res.status(200).json({
      success: true,
      data: transformedData
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}
