import { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from './lib/supabase.js'
import { getSchemaName } from './lib/db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== DEVICE TYPES API CALLED ===')
  console.log('Method:', req.method)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { data, error } = await supabase
      .schema(getSchemaName())
      .from('device_types')
      .select('id, name')
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching device types:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch device types'
      })
    }

    return res.status(200).json({
      success: true,
      data: data || []
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}
