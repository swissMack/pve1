/**
 * Authentication Middleware for Provisioning API
 * Supports Bearer JWT and API Key authentication
 */

import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import type { Pool } from 'pg';
import type { ApiClient, AuthContext, ErrorResponse } from '../types/provisioning.types.js';
import { getSchemaPrefix, shouldUseSupabase } from '../../lib/db.js';
import { supabase } from '../../lib/supabase.js';

// Get schema prefix based on environment (empty for Supabase, ${SCHEMA()} for local)
function SCHEMA(): string { return getSchemaPrefix(); }

// Extend Express Request to include auth context
declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return 'req_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Hash an API key using SHA256
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

/**
 * Create authentication middleware with database pool
 */
export function createAuthMiddleware(pool: Pool) {
  return async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const requestId = generateRequestId();

    // Always attach request ID
    req.auth = {
      clientId: '',
      client: {} as ApiClient,
      requestId
    };

    try {
      // Check for Authorization header
      const authHeader = req.headers.authorization;
      const apiKeyHeader = req.headers['x-api-key'] as string | undefined;

      let apiKey: string | null = null;

      // Try Bearer token first
      if (authHeader?.startsWith('Bearer ')) {
        apiKey = authHeader.substring(7);
      }
      // Then try X-API-Key header
      else if (apiKeyHeader) {
        apiKey = apiKeyHeader;
      }

      // Development mode bypass - skip auth if SKIP_AUTH=true
      // Optional: Set SKIP_AUTH_UNTIL to an ISO timestamp to auto-expire the bypass
      // Example: SKIP_AUTH_UNTIL=2025-01-10T18:00:00Z (expires at 6pm on Jan 10)
      if (process.env.SKIP_AUTH === 'true') {
        const skipAuthUntil = process.env.SKIP_AUTH_UNTIL;

        // Check if bypass has expired
        if (skipAuthUntil) {
          const expiryTime = new Date(skipAuthUntil).getTime();
          const now = Date.now();

          if (now > expiryTime) {
            console.log(`[Auth] SKIP_AUTH bypass expired at ${skipAuthUntil}`);
            // Don't bypass - continue to normal auth flow
          } else {
            const remainingMs = expiryTime - now;
            const remainingMin = Math.round(remainingMs / 60000);
            console.log(`[Auth] SKIP_AUTH bypass active, expires in ${remainingMin} minutes`);

            req.auth = {
              clientId: 'dev-client',
              client: {
                id: 'dev-client',
                name: 'Development Client (Test Mode)',
                permissions: ['usage:write', 'usage:read', 'sims:read', 'sims:write', 'provisioning:*', 'webhooks:*', 'api-clients:*'],
                isActive: true
              } as ApiClient,
              requestId
            };
            return next();
          }
        } else {
          // No expiry set - bypass indefinitely (development only!)
          req.auth = {
            clientId: 'dev-client',
            client: {
              id: 'dev-client',
              name: 'Development Client',
              permissions: ['usage:write', 'usage:read', 'sims:read', 'sims:write', 'provisioning:*', 'webhooks:*', 'api-clients:*'],
              isActive: true
            } as ApiClient,
            requestId
          };
          return next();
        }
      }

      if (!apiKey) {
        const errorResponse: ErrorResponse = {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing authentication. Provide Bearer token or X-API-Key header.',
            requestId
          }
        };
        res.status(401).json(errorResponse);
        return;
      }

      // Get API key prefix and hash
      const prefix = getApiKeyPrefix(apiKey);
      const keyHash = hashApiKey(apiKey);

      // Look up client by prefix and verify hash
      let clientRow: {
        id: string;
        name: string;
        permissions: string[];
        rate_limit_override: object | null;
        is_active: boolean;
        api_key_hash: string;
      } | null = null;

      // Use Supabase if configured, otherwise fall back to pg pool
      if (shouldUseSupabase() && supabase) {
        const { data, error } = await supabase
          .from('api_clients')
          .select('id, name, permissions, rate_limit_override, is_active, api_key_hash')
          .eq('api_key_prefix', prefix)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
          throw error;
        }
        if (data) {
          clientRow = {
            id: data.id,
            name: data.name,
            permissions: (data.permissions || []) as string[],
            rate_limit_override: data.rate_limit_override as object | null,
            is_active: data.is_active,
            api_key_hash: data.api_key_hash
          };
        }
      } else {
        const result = await pool.query<{
          id: string;
          name: string;
          permissions: string[];
          rate_limit_override: object | null;
          is_active: boolean;
          api_key_hash: string;
        }>(`
          SELECT id, name, permissions, rate_limit_override, is_active, api_key_hash
          FROM ${SCHEMA()}api_clients
          WHERE api_key_prefix = $1
        `, [prefix]);
        clientRow = result.rows[0] || null;
      }

      if (!clientRow) {
        const errorResponse: ErrorResponse = {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid API key',
            requestId
          }
        };
        res.status(401).json(errorResponse);
        return;
      }

      // Verify hash matches (timing-safe comparison would be better in production)
      if (clientRow.api_key_hash !== keyHash) {
        const errorResponse: ErrorResponse = {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid API key',
            requestId
          }
        };
        res.status(401).json(errorResponse);
        return;
      }

      // Check if client is active
      if (!clientRow.is_active) {
        const errorResponse: ErrorResponse = {
          error: {
            code: 'FORBIDDEN',
            message: 'API client is disabled',
            requestId
          }
        };
        res.status(403).json(errorResponse);
        return;
      }

      // Build client object
      const client: ApiClient = {
        id: clientRow.id,
        name: clientRow.name,
        permissions: clientRow.permissions || [],
        rateLimitOverride: clientRow.rate_limit_override as any,
        isActive: clientRow.is_active
      };

      // Update last used timestamp (fire and forget)
      if (shouldUseSupabase() && supabase) {
        supabase
          .from('api_clients')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', client.id)
          .then(({ error }: { error: Error | null }) => {
            if (error) console.error('Failed to update client last_used_at:', error);
          });
      } else {
        pool.query(`
          UPDATE ${SCHEMA()}api_clients
          SET last_used_at = NOW()
          WHERE id = $1
        `, [client.id]).catch(err => {
          console.error('Failed to update client last_used_at:', err);
        });
      }

      // Attach auth context to request
      req.auth = {
        clientId: client.id,
        client,
        requestId
      };

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      const errorResponse: ErrorResponse = {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Authentication failed due to internal error',
          requestId
        }
      };
      res.status(500).json(errorResponse);
    }
  };
}

/**
 * Permission checking middleware
 */
export function requirePermission(permission: string) {
  return function permissionMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const { auth } = req;

    if (!auth?.client) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
          requestId: auth?.requestId || 'unknown'
        }
      };
      res.status(401).json(errorResponse);
      return;
    }

    // Check for wildcard permission or specific permission
    const hasPermission = auth.client.permissions.some(p => {
      if (p === '*') return true;
      if (p === permission) return true;
      // Check wildcard patterns like "provisioning:*"
      const [category] = permission.split(':');
      if (p === `${category}:*`) return true;
      return false;
    });

    if (!hasPermission) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'FORBIDDEN',
          message: `Permission denied. Required: ${permission}`,
          requestId: auth.requestId
        }
      };
      res.status(403).json(errorResponse);
      return;
    }

    next();
  };
}

/**
 * Optional auth middleware - doesn't fail if no auth provided
 * Useful for endpoints that behave differently for authenticated vs anonymous
 */
export function createOptionalAuthMiddleware(pool: Pool) {
  const authMiddleware = createAuthMiddleware(pool);

  return function optionalAuthMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    // If no auth headers, just continue
    if (!req.headers.authorization && !req.headers['x-api-key']) {
      req.auth = {
        clientId: 'anonymous',
        client: {
          id: 'anonymous',
          name: 'Anonymous',
          permissions: [],
          isActive: true
        },
        requestId: generateRequestId()
      };
      next();
      return;
    }

    // Otherwise, validate the auth
    authMiddleware(req, res, next);
  };
}
