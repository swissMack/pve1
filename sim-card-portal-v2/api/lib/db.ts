/**
 * Database Abstraction Layer
 *
 * Supports both direct PostgreSQL (pg Pool) and Supabase client.
 * Uses Supabase when configured, falls back to pg Pool for local development.
 *
 * Schema handling:
 * - Local development: Uses "sim-card-portal-v2" schema prefix
 * - Supabase: Uses public schema (no prefix needed)
 */

import type { Pool, QueryResult } from 'pg'
import { supabase, isSupabaseConfigured } from './supabase.js'
import type { Database } from './database.types.js'

// Re-export for convenience
export { supabase, isSupabaseConfigured }

/**
 * Database client type - either pg Pool or Supabase
 */
export type DbClient = Pool | typeof supabase

/**
 * Check if we should use public schema (Supabase mode)
 */
export function usePublicSchema(): boolean {
  return process.env.USE_PUBLIC_SCHEMA === 'true'
}

/**
 * Determine if we should use Supabase or pg Pool
 */
export function shouldUseSupabase(): boolean {
  return isSupabaseConfigured() && supabase !== null
}

/**
 * Get the appropriate schema prefix for SQL queries
 * Returns empty string for public schema (Supabase/Proxmox), or the schema prefix for local dev
 */
export function getSchemaPrefix(): string {
  // Use public schema if Supabase is configured OR USE_PUBLIC_SCHEMA=true
  return (shouldUseSupabase() || usePublicSchema()) ? '' : '"sim-card-portal-v2".'
}

/**
 * Get the schema name for Supabase client .schema() method
 * Returns 'public' for Supabase deployment, 'sim-card-portal-v2' for local dev
 * Note: Cast to 'public' for TypeScript compatibility with generated types
 */
export function getSchemaName(): 'public' {
  // Use public schema if Supabase is configured OR USE_PUBLIC_SCHEMA=true
  return ((shouldUseSupabase() || usePublicSchema()) ? 'public' : 'sim-card-portal-v2') as 'public'
}

/**
 * Get table name with appropriate schema prefix
 */
export function tableName(name: string): string {
  return shouldUseSupabase() ? name : `"sim-card-portal-v2".${name}`
}

/**
 * Generic query result type
 */
export interface DbQueryResult<T> {
  rows: T[]
  rowCount: number
}

/**
 * Execute a raw SQL query using pg Pool
 * For use when Supabase is not available or for complex queries
 */
export async function executeQuery<T = Record<string, unknown>>(
  pool: Pool,
  sql: string,
  params?: unknown[]
): Promise<DbQueryResult<T>> {
  const result = await pool.query(sql, params)
  return {
    rows: result.rows as T[],
    rowCount: result.rowCount ?? result.rows.length
  }
}

/**
 * Execute a query that works with both pg Pool and Supabase
 * Automatically adjusts schema prefix based on environment
 */
export async function query<T = Record<string, unknown>>(
  pool: Pool,
  sql: string,
  params?: unknown[]
): Promise<DbQueryResult<T>> {
  // Replace schema placeholder with appropriate value
  const adjustedSql = sql.replace(/\{schema\}\./g, getSchemaPrefix())

  const result = await pool.query(adjustedSql, params)
  return {
    rows: result.rows as T[],
    rowCount: result.rowCount ?? result.rows.length
  }
}

// ============================================================================
// Supabase Query Helpers
// ============================================================================

type TableName = keyof Database['public']['Tables']

/**
 * Select from a table using Supabase client
 */
export async function selectFrom<T extends TableName>(
  table: T,
  options?: {
    columns?: string
    filters?: Array<{ column: string; operator: string; value: unknown }>
    orderBy?: { column: string; ascending?: boolean }
    limit?: number
    offset?: number
    single?: boolean
  }
): Promise<{
  data: Database['public']['Tables'][T]['Row'][] | Database['public']['Tables'][T]['Row'] | null
  error: Error | null
  count?: number
}> {
  if (!supabase) {
    return { data: null, error: new Error('Supabase not configured') }
  }

  let query = supabase
    .from(table)
    .select(options?.columns || '*', { count: 'exact' })

  // Apply filters
  if (options?.filters) {
    for (const filter of options.filters) {
      query = query.filter(filter.column, filter.operator, filter.value) as typeof query
    }
  }

  // Apply ordering
  if (options?.orderBy) {
    query = query.order(options.orderBy.column, {
      ascending: options.orderBy.ascending ?? true
    }) as typeof query
  }

  // Apply pagination
  if (options?.limit) {
    query = query.limit(options.limit)
  }
  if (options?.offset) {
    query = query.range(
      options.offset,
      options.offset + (options.limit || 10) - 1
    )
  }

  // Single row
  if (options?.single) {
    const { data, error } = await query.single()
    return { data: data as Database['public']['Tables'][T]['Row'] | null, error }
  }

  const { data, error, count } = await query
  return { data: data as Database['public']['Tables'][T]['Row'][] | null, error, count: count ?? undefined }
}

/**
 * Insert into a table using Supabase client
 */
export async function insertInto<T extends TableName>(
  table: T,
  data: Database['public']['Tables'][T]['Insert'] | Database['public']['Tables'][T]['Insert'][]
): Promise<{
  data: Database['public']['Tables'][T]['Row'][] | null
  error: Error | null
}> {
  if (!supabase) {
    return { data: null, error: new Error('Supabase not configured') }
  }

  const { data: result, error } = await supabase
    .from(table)
    .insert(data as any)
    .select()

  return { data: result as Database['public']['Tables'][T]['Row'][] | null, error }
}

/**
 * Update a table using Supabase client
 */
export async function updateTable<T extends TableName>(
  table: T,
  data: Database['public']['Tables'][T]['Update'],
  filters: Array<{ column: string; value: unknown }>
): Promise<{
  data: Database['public']['Tables'][T]['Row'][] | null
  error: Error | null
}> {
  if (!supabase) {
    return { data: null, error: new Error('Supabase not configured') }
  }

  let query = supabase.from(table).update(data as any)

  for (const filter of filters) {
    query = query.eq(filter.column as any, filter.value as any) as typeof query
  }

  const { data: result, error } = await query.select()
  return { data: result as Database['public']['Tables'][T]['Row'][] | null, error }
}

/**
 * Delete from a table using Supabase client
 */
export async function deleteFrom<T extends TableName>(
  table: T,
  filters: Array<{ column: string; value: unknown }>
): Promise<{
  error: Error | null
}> {
  if (!supabase) {
    return { error: new Error('Supabase not configured') }
  }

  let query = supabase.from(table).delete()

  for (const filter of filters) {
    query = query.eq(filter.column as any, filter.value as any) as typeof query
  }

  const { error } = await query
  return { error }
}

// ============================================================================
// Hybrid Query Functions
// These work with both pg Pool and Supabase based on configuration
// ============================================================================

/**
 * Get a single row by ID from any table
 */
export async function getById<T extends TableName>(
  pool: Pool,
  table: T,
  idColumn: string,
  idValue: string
): Promise<Database['public']['Tables'][T]['Row'] | null> {
  if (shouldUseSupabase() && supabase) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq(idColumn as any, idValue)
      .single()

    if (error) {
      console.error(`Error fetching ${table} by ${idColumn}:`, error)
      return null
    }
    return data as unknown as Database['public']['Tables'][T]['Row'] | null
  }

  // Fall back to pg Pool
  const result = await pool.query(
    `SELECT * FROM ${tableName(table)} WHERE ${idColumn} = $1`,
    [idValue]
  )
  return result.rows[0] as unknown as Database['public']['Tables'][T]['Row'] | null
}

/**
 * Insert a row and return the result
 */
export async function insertRow<T extends TableName>(
  pool: Pool,
  table: T,
  data: Database['public']['Tables'][T]['Insert'],
  returning: string = '*'
): Promise<Database['public']['Tables'][T]['Row'] | null> {
  if (shouldUseSupabase() && supabase) {
    const { data: result, error } = await supabase
      .from(table)
      .insert(data as any)
      .select(returning)
      .single()

    if (error) {
      console.error(`Error inserting into ${table}:`, error)
      throw error
    }
    return result as unknown as Database['public']['Tables'][T]['Row'] | null
  }

  // Fall back to pg Pool - need to build INSERT query
  const columns = Object.keys(data as object)
  const values = Object.values(data as object)
  const placeholders = columns.map((_, i) => `$${i + 1}`)

  const result = await pool.query(
    `INSERT INTO ${tableName(table)} (${columns.join(', ')})
     VALUES (${placeholders.join(', ')})
     RETURNING ${returning}`,
    values
  )
  return result.rows[0] as unknown as Database['public']['Tables'][T]['Row'] | null
}

/**
 * Update a row and return the result
 */
export async function updateRow<T extends TableName>(
  pool: Pool,
  table: T,
  idColumn: string,
  idValue: string,
  data: Database['public']['Tables'][T]['Update'],
  returning: string = '*'
): Promise<Database['public']['Tables'][T]['Row'] | null> {
  if (shouldUseSupabase() && supabase) {
    const { data: result, error } = await supabase
      .from(table)
      .update(data as any)
      .eq(idColumn as any, idValue)
      .select(returning)
      .single()

    if (error) {
      console.error(`Error updating ${table}:`, error)
      throw error
    }
    return result as unknown as Database['public']['Tables'][T]['Row'] | null
  }

  // Fall back to pg Pool - need to build UPDATE query
  const entries = Object.entries(data as object).filter(([_, v]) => v !== undefined)
  if (entries.length === 0) return null

  const setClause = entries.map(([k], i) => `${k} = $${i + 1}`).join(', ')
  const values = [...entries.map(([_, v]) => v), idValue]

  const result = await pool.query(
    `UPDATE ${tableName(table)}
     SET ${setClause}, updated_at = NOW()
     WHERE ${idColumn} = $${entries.length + 1}
     RETURNING ${returning}`,
    values
  )
  return result.rows[0] as unknown as Database['public']['Tables'][T]['Row'] | null
}

// ============================================================================
// Connection Management
// ============================================================================

/**
 * Create a pg Pool with environment-based configuration
 */
export function createPool(): Pool | null {
  // Only create pool if we're not using Supabase exclusively
  if (shouldUseSupabase()) {
    return null
  }

  // Dynamic import to avoid issues when pg is not available
  const pg = require('pg')
  const { Pool: PgPool } = pg

  return new PgPool({
    connectionString: process.env.DATABASE_URL,
    user: process.env.DATABASE_URL ? undefined : (process.env.DB_USER || 'simportal'),
    password: process.env.DATABASE_URL ? undefined : process.env.DB_PASSWORD,
    host: process.env.DATABASE_URL ? undefined : (process.env.DB_HOST || 'localhost'),
    port: process.env.DATABASE_URL ? undefined : parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DATABASE_URL ? undefined : (process.env.DB_NAME || 'simcardportal'),
    max: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
  })
}
