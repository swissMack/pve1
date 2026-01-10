/**
 * Vercel Serverless Function - Catch-all handler for /api/v1/* routes
 *
 * This wraps the Express-based v1 router for Vercel deployment.
 * Routes handled:
 *   - /api/v1/health
 *   - /api/v1/sims (CRUD + actions)
 *   - /api/v1/webhooks (CRUD)
 *   - /api/v1/usage (submit records, batch, reset)
 *   - /api/v1/api-clients (management)
 */

import { VercelRequest, VercelResponse } from '@vercel/node'
import express, { Request, Response, NextFunction } from 'express'
import pg from 'pg'
import { createV1Router } from './router.js'

const { Pool } = pg

// Lazy initialization for serverless environment
let app: express.Express | null = null
let pool: pg.Pool | null = null

function getApp(): express.Express {
  if (!app) {
    // Create Express app
    app = express()

    // Middleware - body parsing
    app.use(express.json({ limit: '100mb' }))

    // Create PostgreSQL pool for Supabase
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    })

    // Mount the v1 router
    app.use('/', createV1Router(pool))

    // 404 handler for unmatched routes
    app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Route ${req.method} ${req.path} not found in v1 API`,
        }
      })
    })

    // Error handler
    app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
      console.error('V1 API Error:', err)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: err.message || 'Internal server error',
        }
      })
    })
  }

  return app
}

// Convert Express app to Vercel handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID, X-API-Key')
    return res.status(200).end()
  }

  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID, X-API-Key')

  // Extract the path from the catch-all parameter
  // Vercel provides the path segments in req.query.path as an array
  // e.g., /api/v1/usage -> path = ['usage']
  // e.g., /api/v1/sims/123 -> path = ['sims', '123']
  const pathSegments = req.query.path
  let subPath: string

  if (Array.isArray(pathSegments)) {
    subPath = '/' + pathSegments.join('/')
  } else if (pathSegments) {
    subPath = '/' + pathSegments
  } else {
    // Root /api/v1 request (no path segments)
    subPath = '/health'
  }

  // Get query string from original URL (excluding the path parameter)
  const originalUrl = req.url || ''
  const queryIndex = originalUrl.indexOf('?')
  const queryString = queryIndex >= 0 ? originalUrl.substring(queryIndex) : ''

  // Reconstruct URL for Express (without the catch-all path param in query)
  const cleanQuery = queryString.replace(/[?&]path=[^&]*/g, '').replace(/^\?&/, '?').replace(/^&/, '')
  const expressUrl = subPath + (cleanQuery && cleanQuery !== '?' ? cleanQuery : '')

  // Debug logging for troubleshooting
  console.log(`[V1 API] ${req.method} ${originalUrl} -> ${expressUrl}`)

  // Modify request for Express routing
  const expressReq = Object.assign(req, {
    url: expressUrl,
    path: subPath,
    originalUrl: '/api/v1' + subPath,
    baseUrl: '/api/v1',
  })

  // Run Express app
  return new Promise<void>((resolve) => {
    try {
      getApp()(expressReq as any, res as any, () => {
        // Express next() called without error - request was not handled
        if (!res.headersSent) {
          res.status(404).json({
            error: {
              code: 'NOT_FOUND',
              message: `Route ${req.method} ${subPath} not found`
            }
          })
        }
        resolve()
      })
    } catch (err) {
      console.error('[V1 API] Handler error:', err)
      if (!res.headersSent) {
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to process request'
          }
        })
      }
      resolve()
    }
  })
}
