import { VercelRequest, VercelResponse } from '@vercel/node'
import { sign, verify } from 'jsonwebtoken'
import { supabase } from './lib/supabase.js'
import type { DatabaseUser, DatabaseUserSession } from './lib/supabase.js'
import { getSchemaName } from './lib/db.js'
import * as crypto from 'crypto'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-should-be-in-env'

interface User {
  id: string
  username: string
  role: string
}

// Helper function to hash passwords
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS for frontend access
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    switch (req.method) {
      case 'POST':
        return handleAuth(req, res)
      default:
        return res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Auth API Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function handleAuth(req: VercelRequest, res: VercelResponse) {
  const { action, username, password, token } = req.body

  switch (action) {
    case 'login':
      return handleLogin(username, password, res)
    case 'verify':
      return handleVerifyToken(token, res)
    case 'refresh':
      return handleRefreshToken(token, res)
    default:
      return res.status(400).json({ error: 'Invalid action' })
  }
}

async function handleLogin(username: string, password: string, res: VercelResponse) {
  try {
    // First, try to fetch user from database
    // Note: 'users' table may not exist in generated types, using type assertion
    const { data: user, error: userError } = await (supabase
      .schema(getSchemaName()) as any)
      .from('users')
      .select('*')
      .eq('username', username)
      .single() as { data: DatabaseUser | null; error: any }

    if (userError && userError.code !== 'PGRST116') {
      // PGRST116 means no rows returned, which we'll handle below
      console.error('Database error:', userError)
      throw userError
    }

    let authenticatedUser: DatabaseUser | null = null

    if (user) {
      // User exists in database, verify password
      const hashedPassword = hashPassword(password)
      if (user.password_hash === hashedPassword) {
        authenticatedUser = user
      }
    } else if (username === 'admin' && password === '1234567') {
      // Fallback to hardcoded admin for initial setup
      // Create admin user in database if it doesn't exist
      const hashedPassword = hashPassword('1234567')
      const { data: newUser, error: createError } = await (supabase
        .schema(getSchemaName()) as any)
        .from('users')
        .insert({
          id: 'admin-001',
          username: 'admin',
          password_hash: hashedPassword,
          role: 'administrator'
        })
        .select()
        .single() as { data: DatabaseUser | null; error: any }

      if (createError && createError.code !== '23505') {
        // 23505 is unique violation, which means user already exists
        console.error('Error creating admin user:', createError)
      }

      authenticatedUser = newUser || {
        id: 'admin-001',
        username: 'admin',
        password_hash: hashedPassword,
        role: 'administrator'
      }
    }

    if (authenticatedUser) {
      const token = sign(
        { 
          userId: authenticatedUser.id, 
          username: authenticatedUser.username, 
          role: authenticatedUser.role 
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      )

      // Store token in database for session management
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
      await (supabase
        .schema(getSchemaName()) as any)
        .from('user_sessions')
        .insert({
          user_id: authenticatedUser.id,
          token,
          expires_at: expiresAt.toISOString()
        })

      return res.status(200).json({
        success: true,
        token,
        user: {
          id: authenticatedUser.id,
          username: authenticatedUser.username,
          role: authenticatedUser.role
        }
      })
    } else {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      })
    }
  } catch (error) {
    console.error('Login error:', error)
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    })
  }
}

async function handleVerifyToken(token: string, res: VercelResponse) {
  try {
    const decoded = verify(token, JWT_SECRET) as any

    // Check if token exists in database and is not expired
    const { data: session, error: sessionError } = await (supabase
      .schema(getSchemaName()) as any)
      .from('user_sessions')
      .select('*')
      .eq('token', token)
      .eq('user_id', decoded.userId)
      .single() as { data: DatabaseUserSession | null; error: any }

    if (sessionError || !session) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      })
    }

    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      // Clean up expired session
      await (supabase
        .schema(getSchemaName()) as any)
        .from('user_sessions')
        .delete()
        .eq('token', token)

      return res.status(401).json({
        success: false,
        error: 'Token has expired'
      })
    }

    return res.status(200).json({
      success: true,
      user: {
        id: decoded.userId,
        username: decoded.username,
        role: decoded.role
      }
    })
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    })
  }
}

async function handleRefreshToken(token: string, res: VercelResponse) {
  try {
    const decoded = verify(token, JWT_SECRET) as any

    // Verify old token exists in database
    const { data: oldSession, error: sessionError } = await (supabase
      .schema(getSchemaName()) as any)
      .from('user_sessions')
      .select('*')
      .eq('token', token)
      .eq('user_id', decoded.userId)
      .single() as { data: DatabaseUserSession | null; error: any }

    if (sessionError || !oldSession) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token for refresh'
      })
    }

    // Generate new token
    const newToken = sign(
      {
        userId: decoded.userId,
        username: decoded.username,
        role: decoded.role
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    )

    // Update token in database
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await (supabase
      .schema(getSchemaName()) as any)
      .from('user_sessions')
      .update({
        token: newToken,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('token', token)

    return res.status(200).json({
      success: true,
      token: newToken
    })
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid token for refresh'
    })
  }
}