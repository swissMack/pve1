/**
 * Mock API Server for Billing & Provisioning
 * Provides realistic test data for the dashboard
 */

import express from 'express'
import cors from 'cors'

const app = express()
const PORT = process.env.API_PORT || 3001

app.use(cors())
app.use(express.json())

// Simple Bearer token auth middleware
const AUTH_TOKEN = 'test_provisioning_key_12345'

function authenticate(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || auth !== `Bearer ${AUTH_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

// ============ Health Check ============

app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      database: { status: 'up', latency: 12 },
      cache: { status: 'up', latency: 2 },
      mqtt: { status: 'up', latency: 5 },
      billing: { status: 'up', latency: 8 },
      provisioning: { status: 'up', latency: 15 }
    },
    uptime: process.uptime()
  })
})

// ============ Mock Data Generators ============

function generateIccid() {
  return '8901' + Math.random().toString().slice(2, 18)
}

function generateMsisdn() {
  return '+1' + Math.floor(Math.random() * 9000000000 + 1000000000)
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Generate mock SIMs
const carriers = ['AT&T', 'Verizon', 'T-Mobile', 'Sprint']
const statuses = ['active', 'inactive', 'blocked', 'pending']

const mockSims = Array.from({ length: 50 }, (_, i) => ({
  simId: `sim-${1000 + i}`,
  iccid: generateIccid(),
  msisdn: generateMsisdn(),
  status: randomChoice(statuses),
  carrier: randomChoice(carriers),
  activationDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
  lastSeen: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
  dataUsage: {
    current: Math.floor(Math.random() * 5000),
    limit: 10000,
    unit: 'MB'
  },
  plan: randomChoice(['Basic', 'Standard', 'Premium', 'Enterprise']),
  notes: ''
}))

// Generate mock invoices
const invoiceStatuses = ['paid', 'pending', 'overdue', 'draft']
const mockInvoices = Array.from({ length: 30 }, (_, i) => ({
  invoiceId: `INV-${2024}${String(i + 1).padStart(4, '0')}`,
  carrier: randomChoice(carriers),
  amount: Math.floor(Math.random() * 50000) + 1000,
  currency: 'USD',
  status: randomChoice(invoiceStatuses),
  issueDate: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString(),
  dueDate: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
  periodStart: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  periodEnd: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  lineItems: [
    { description: 'Data Usage', quantity: Math.floor(Math.random() * 1000), unitPrice: 0.05 },
    { description: 'SMS', quantity: Math.floor(Math.random() * 500), unitPrice: 0.02 },
    { description: 'Voice Minutes', quantity: Math.floor(Math.random() * 300), unitPrice: 0.10 }
  ]
}))

// ============ SIM Provisioning Endpoints ============

// GET /api/v1/sims - List all SIMs
app.get('/api/v1/sims', authenticate, (req, res) => {
  const { status, iccid, carrier, limit = 50, offset = 0 } = req.query

  let filtered = [...mockSims]

  if (status) {
    filtered = filtered.filter(s => s.status === status)
  }
  if (iccid) {
    filtered = filtered.filter(s => s.iccid.includes(iccid))
  }
  if (carrier) {
    filtered = filtered.filter(s => s.carrier === carrier)
  }

  const total = filtered.length
  const data = filtered.slice(Number(offset), Number(offset) + Number(limit))

  res.json({
    data,
    pagination: {
      total,
      limit: Number(limit),
      offset: Number(offset),
      hasMore: Number(offset) + data.length < total
    }
  })
})

// GET /api/v1/sims/:id - Get SIM details
app.get('/api/v1/sims/:id', authenticate, (req, res) => {
  const sim = mockSims.find(s => s.simId === req.params.id)
  if (!sim) {
    return res.status(404).json({ error: 'SIM not found' })
  }
  res.json({ data: sim })
})

// POST /api/v1/sims/:id/block - Block a SIM
app.post('/api/v1/sims/:id/block', authenticate, (req, res) => {
  const sim = mockSims.find(s => s.simId === req.params.id)
  if (!sim) {
    return res.status(404).json({ error: 'SIM not found' })
  }

  const { reason, notes } = req.body
  sim.status = 'blocked'
  sim.notes = notes || ''
  sim.blockReason = reason
  sim.blockedAt = new Date().toISOString()

  res.json({
    success: true,
    message: `SIM ${sim.iccid} has been blocked`,
    data: sim
  })
})

// POST /api/v1/sims/:id/unblock - Unblock a SIM
app.post('/api/v1/sims/:id/unblock', authenticate, (req, res) => {
  const sim = mockSims.find(s => s.simId === req.params.id)
  if (!sim) {
    return res.status(404).json({ error: 'SIM not found' })
  }

  const { notes } = req.body
  sim.status = 'active'
  sim.notes = notes || ''
  delete sim.blockReason
  delete sim.blockedAt
  sim.unblockedAt = new Date().toISOString()

  res.json({
    success: true,
    message: `SIM ${sim.iccid} has been unblocked`,
    data: sim
  })
})

// ============ Billing Endpoints ============

// GET /api/v1/invoices - List invoices
app.get('/api/v1/invoices', authenticate, (req, res) => {
  const { status, carrier, limit = 20, offset = 0 } = req.query

  let filtered = [...mockInvoices]

  if (status) {
    filtered = filtered.filter(i => i.status === status)
  }
  if (carrier) {
    filtered = filtered.filter(i => i.carrier === carrier)
  }

  // Sort by issue date descending
  filtered.sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate))

  const total = filtered.length
  const data = filtered.slice(Number(offset), Number(offset) + Number(limit))

  res.json({
    data,
    pagination: {
      total,
      limit: Number(limit),
      offset: Number(offset),
      hasMore: Number(offset) + data.length < total
    }
  })
})

// GET /api/v1/invoices/:id - Get invoice details
app.get('/api/v1/invoices/:id', authenticate, (req, res) => {
  const invoice = mockInvoices.find(i => i.invoiceId === req.params.id)
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' })
  }
  res.json({ data: invoice })
})

// ============ KPI Endpoints ============

// GET /api/v1/kpis - Get billing KPIs
app.get('/api/v1/kpis', authenticate, (req, res) => {
  const totalSpend = mockInvoices.reduce((sum, i) => sum + i.amount, 0)
  const activeSims = mockSims.filter(s => s.status === 'active').length
  const totalDataUsage = mockSims.reduce((sum, s) => sum + s.dataUsage.current, 0)

  res.json({
    data: {
      totalSpend: {
        value: totalSpend,
        currency: 'USD',
        change: 12.5,
        period: 'vs last month'
      },
      activeSims: {
        value: activeSims,
        total: mockSims.length,
        change: 5.2,
        period: 'vs last month'
      },
      dataUsage: {
        value: totalDataUsage,
        unit: 'MB',
        change: -3.1,
        period: 'vs last month'
      },
      avgCostPerSim: {
        value: Math.round(totalSpend / activeSims),
        currency: 'USD',
        change: 8.7,
        period: 'vs last month'
      }
    }
  })
})

// GET /api/v1/kpis/trends - Get usage trends
app.get('/api/v1/kpis/trends', authenticate, (req, res) => {
  const { granularity = 'daily' } = req.query

  const points = granularity === 'daily' ? 30 : granularity === 'weekly' ? 12 : 6
  const baseData = 50000

  const data = Array.from({ length: points }, (_, i) => {
    const date = new Date()
    if (granularity === 'daily') date.setDate(date.getDate() - (points - i))
    else if (granularity === 'weekly') date.setDate(date.getDate() - (points - i) * 7)
    else date.setMonth(date.getMonth() - (points - i))

    return {
      date: date.toISOString().split('T')[0],
      dataUsage: Math.floor(baseData + Math.random() * 20000 - 10000),
      cost: Math.floor((baseData / 10) + Math.random() * 2000 - 1000),
      activeSims: Math.floor(40 + Math.random() * 10)
    }
  })

  res.json({ data, granularity })
})

// GET /api/v1/kpis/carriers - Get carrier breakdown
app.get('/api/v1/kpis/carriers', authenticate, (req, res) => {
  const carrierData = carriers.map(carrier => {
    const carrierSims = mockSims.filter(s => s.carrier === carrier)
    const carrierInvoices = mockInvoices.filter(i => i.carrier === carrier)

    return {
      carrier,
      simCount: carrierSims.length,
      activeSims: carrierSims.filter(s => s.status === 'active').length,
      dataUsage: carrierSims.reduce((sum, s) => sum + s.dataUsage.current, 0),
      totalSpend: carrierInvoices.reduce((sum, i) => sum + i.amount, 0),
      percentage: Math.round((carrierSims.length / mockSims.length) * 100)
    }
  })

  res.json({ data: carrierData })
})

// ============ Start Server ============

app.listen(PORT, () => {
  console.log(`Billing & Provisioning API running on http://localhost:${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/api/v1/health`)
})
