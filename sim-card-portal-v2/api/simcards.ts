import { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from './lib/supabase.js'
import type { DatabaseSIMCard } from './lib/supabase.js'
import { getSchemaName } from './lib/db.js'

// Import types from the main source
import { SIMCard } from '../src/data/mockData.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS for frontend access
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    switch (req.method) {
      case 'GET':
        return handleGetSIMCards(req, res)
      case 'POST':
        return handleCreateSIMCard(req, res)
      case 'PUT':
        return handleUpdateSIMCard(req, res)
      case 'DELETE':
        return handleDeleteSIMCard(req, res)
      default:
        return res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('API Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function handleGetSIMCards(req: VercelRequest, res: VercelResponse) {
  try {
    const { data, error } = await supabase
      .schema(getSchemaName())
      .from('sim_cards')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching SIM cards:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch SIM cards'
      })
    }

    // Convert database format to API format
    const simCards: SIMCard[] = (data || []).map((dbSIM: DatabaseSIMCard) => ({
      id: dbSIM.id,
      iccid: dbSIM.iccid,
      msisdn: dbSIM.msisdn || '',
      status: dbSIM.status as 'Active' | 'Inactive' | 'Suspended' | 'Terminated',
      carrier: dbSIM.carrier || '',
      plan: dbSIM.plan || '',
      dataUsed: dbSIM.data_used || '0 MB',
      dataLimit: dbSIM.data_limit || '0 MB',
      activationDate: dbSIM.activation_date || '',
      expiryDate: dbSIM.expiry_date || ''
    }))

    return res.status(200).json({
      success: true,
      data: simCards
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

async function handleCreateSIMCard(req: VercelRequest, res: VercelResponse) {
  const simData: Partial<SIMCard> = req.body

  try {
    // Convert API format to database format
    const dbSIMCard: Partial<DatabaseSIMCard> = {
      id: simData.id || `SIM${Date.now()}`,
      iccid: simData.iccid || `890123456789012${Date.now()}`,
      msisdn: simData.msisdn || null,
      status: simData.status || 'Inactive',
      carrier: simData.carrier || null,
      plan: simData.plan || null,
      data_used: simData.dataUsed || '0 MB',
      data_limit: simData.dataLimit || '10 MB',
      activation_date: simData.activationDate || new Date().toISOString().split('T')[0],
      expiry_date: simData.expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }

    const { data, error } = await supabase
      .schema(getSchemaName())
      .from('sim_cards')
      .insert(dbSIMCard as any)
      .select()
      .single()

    if (error) {
      console.error('Error creating SIM card:', error)
      return res.status(400).json({
        success: false,
        error: 'Failed to create SIM card'
      })
    }

    // Convert back to API format
    const newSIMCard: SIMCard = {
      id: data.id,
      iccid: data.iccid,
      msisdn: data.msisdn || '',
      status: data.status,
      carrier: data.carrier || '',
      plan: data.plan || '',
      dataUsed: data.data_used || '0 MB',
      dataLimit: data.data_limit || '10 MB',
      activationDate: data.activation_date || '',
      expiryDate: data.expiry_date || ''
    }

    return res.status(201).json({
      success: true,
      data: newSIMCard
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

async function handleUpdateSIMCard(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query
  const updates: Partial<SIMCard> = req.body

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'SIM Card ID is required'
    })
  }

  try {
    // Convert API format to database format
    const dbUpdates: Partial<DatabaseSIMCard> = {}
    if (updates.iccid !== undefined) dbUpdates.iccid = updates.iccid
    if (updates.msisdn !== undefined) dbUpdates.msisdn = updates.msisdn || null
    if (updates.status !== undefined) dbUpdates.status = updates.status
    if (updates.carrier !== undefined) dbUpdates.carrier = updates.carrier || null
    if (updates.plan !== undefined) dbUpdates.plan = updates.plan || null
    if (updates.dataUsed !== undefined) dbUpdates.data_used = updates.dataUsed
    if (updates.dataLimit !== undefined) dbUpdates.data_limit = updates.dataLimit
    if (updates.activationDate !== undefined) dbUpdates.activation_date = updates.activationDate
    if (updates.expiryDate !== undefined) dbUpdates.expiry_date = updates.expiryDate
    
    // Add updated_at timestamp
    dbUpdates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .schema(getSchemaName())
      .from('sim_cards')
      .update(dbUpdates as any)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating SIM card:', error)
      return res.status(400).json({
        success: false,
        error: 'Failed to update SIM card'
      })
    }

    return res.status(200).json({
      success: true,
      message: `SIM Card ${id} updated successfully`,
      data: {
        id: data.id,
        iccid: data.iccid,
        msisdn: data.msisdn || '',
        status: data.status,
        carrier: data.carrier || '',
        plan: data.plan || '',
        dataUsed: data.data_used || '0 MB',
        dataLimit: data.data_limit || '10 MB',
        activationDate: data.activation_date || '',
        expiryDate: data.expiry_date || ''
      }
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

async function handleDeleteSIMCard(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'SIM Card ID is required'
    })
  }

  try {
    const { error } = await supabase
      .schema(getSchemaName())
      .from('sim_cards')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting SIM card:', error)
      return res.status(400).json({
        success: false,
        error: 'Failed to delete SIM card'
      })
    }

    return res.status(200).json({
      success: true,
      message: `SIM Card ${id} deleted successfully`
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}