/**
 * API Client Service
 * Manages API clients for mediation and external system access
 */

import type { Pool } from 'pg';
import { createHash, randomBytes } from 'crypto';
import { getSchemaPrefix, shouldUseSupabase } from '../../lib/db.js';
import { supabase } from '../../lib/supabase.js';

const SCHEMA = getSchemaPrefix();

export interface ApiClientRecord {
  id: string;
  name: string;
  description: string | null;
  apiKeyPrefix: string;
  permissions: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApiClientRequest {
  name: string;
  description?: string;
  permissions?: string[];
}

export interface CreateApiClientResponse {
  client: ApiClientRecord;
  apiKey: string;  // Only returned once at creation time!
}

/**
 * Generate a random API key with prefix
 */
function generateApiKey(): string {
  const prefix = 'mqs_';  // mediation query simulator
  const random = randomBytes(24).toString('base64url');
  return prefix + random;
}

/**
 * Hash API key with SHA256
 */
function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Extract API key prefix (first 8 characters)
 */
function getApiKeyPrefix(apiKey: string): string {
  return apiKey.substring(0, 8);
}

export class ApiClientService {
  constructor(private pool: Pool) {}

  /**
   * List all API clients (without sensitive data)
   */
  async listClients(): Promise<ApiClientRecord[]> {
    if (shouldUseSupabase() && supabase) {
      const { data, error } = await supabase
        .from('api_clients')
        .select('id, name, description, api_key_prefix, permissions, is_active, last_used_at, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        apiKeyPrefix: row.api_key_prefix,
        permissions: (row.permissions as string[]) || [],
        isActive: row.is_active,
        lastUsedAt: row.last_used_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    }

    const result = await this.pool.query(`
      SELECT id, name, description, api_key_prefix, permissions, is_active, last_used_at, created_at, updated_at
      FROM ${SCHEMA}api_clients
      ORDER BY created_at DESC
    `);

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      apiKeyPrefix: row.api_key_prefix,
      permissions: row.permissions || [],
      isActive: row.is_active,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  /**
   * Create a new API client
   * Returns the client and the API key (key is only shown once!)
   */
  async createClient(request: CreateApiClientRequest): Promise<CreateApiClientResponse> {
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    const apiKeyPrefix = getApiKeyPrefix(apiKey);

    const defaultPermissions = request.permissions || ['usage:write', 'usage:read', 'sims:read'];

    if (shouldUseSupabase() && supabase) {
      const { data, error } = await supabase
        .from('api_clients')
        .insert({
          name: request.name,
          description: request.description || null,
          api_key_hash: apiKeyHash,
          api_key_prefix: apiKeyPrefix,
          permissions: defaultPermissions,
          is_active: true
        })
        .select('id, name, description, api_key_prefix, permissions, is_active, last_used_at, created_at, updated_at')
        .single();

      if (error) throw error;

      return {
        client: {
          id: data.id,
          name: data.name,
          description: data.description,
          apiKeyPrefix: data.api_key_prefix,
          permissions: (data.permissions as string[]) || [],
          isActive: data.is_active,
          lastUsedAt: data.last_used_at,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        },
        apiKey  // Only returned at creation!
      };
    }

    const result = await this.pool.query(`
      INSERT INTO ${SCHEMA}api_clients (
        name,
        description,
        api_key_hash,
        api_key_prefix,
        permissions,
        is_active
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, description, api_key_prefix, permissions, is_active, last_used_at, created_at, updated_at
    `, [
      request.name,
      request.description || null,
      apiKeyHash,
      apiKeyPrefix,
      JSON.stringify(defaultPermissions),
      true
    ]);

    const row = result.rows[0];
    return {
      client: {
        id: row.id,
        name: row.name,
        description: row.description,
        apiKeyPrefix: row.api_key_prefix,
        permissions: row.permissions || [],
        isActive: row.is_active,
        lastUsedAt: row.last_used_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      },
      apiKey
    };
  }

  /**
   * Toggle API client active status
   */
  async toggleClientStatus(clientId: string): Promise<ApiClientRecord | null> {
    if (shouldUseSupabase() && supabase) {
      // First get current status
      const { data: current, error: fetchError } = await supabase
        .from('api_clients')
        .select('is_active')
        .eq('id', clientId)
        .single();

      if (fetchError || !current) return null;

      // Toggle it
      const { data, error } = await supabase
        .from('api_clients')
        .update({
          is_active: !current.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', clientId)
        .select('id, name, description, api_key_prefix, permissions, is_active, last_used_at, created_at, updated_at')
        .single();

      if (error || !data) return null;

      return {
        id: data.id,
        name: data.name,
        description: data.description,
        apiKeyPrefix: data.api_key_prefix,
        permissions: (data.permissions as string[]) || [],
        isActive: data.is_active,
        lastUsedAt: data.last_used_at,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    }

    // First get current status
    const currentResult = await this.pool.query(`
      SELECT is_active FROM ${SCHEMA}api_clients WHERE id = $1
    `, [clientId]);

    if (currentResult.rows.length === 0) return null;

    const newStatus = !currentResult.rows[0].is_active;

    const result = await this.pool.query(`
      UPDATE ${SCHEMA}api_clients
      SET is_active = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, name, description, api_key_prefix, permissions, is_active, last_used_at, created_at, updated_at
    `, [newStatus, clientId]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      apiKeyPrefix: row.api_key_prefix,
      permissions: row.permissions || [],
      isActive: row.is_active,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Delete an API client
   */
  async deleteClient(clientId: string): Promise<boolean> {
    if (shouldUseSupabase() && supabase) {
      const { error } = await supabase
        .from('api_clients')
        .delete()
        .eq('id', clientId);

      return !error;
    }

    const result = await this.pool.query(`
      DELETE FROM ${SCHEMA}api_clients WHERE id = $1
    `, [clientId]);

    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Regenerate API key for an existing client
   * Returns the new API key (only shown once!)
   */
  async regenerateKey(clientId: string): Promise<{ apiKey: string } | null> {
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    const apiKeyPrefix = getApiKeyPrefix(apiKey);

    if (shouldUseSupabase() && supabase) {
      const { error } = await supabase
        .from('api_clients')
        .update({
          api_key_hash: apiKeyHash,
          api_key_prefix: apiKeyPrefix,
          updated_at: new Date().toISOString()
        })
        .eq('id', clientId);

      if (error) return null;
      return { apiKey };
    }

    const result = await this.pool.query(`
      UPDATE ${SCHEMA}api_clients
      SET api_key_hash = $1, api_key_prefix = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING id
    `, [apiKeyHash, apiKeyPrefix, clientId]);

    if (result.rows.length === 0) return null;
    return { apiKey };
  }
}
