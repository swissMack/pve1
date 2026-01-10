/**
 * Rate Limiting Middleware for Provisioning API
 * Implements per-client, per-endpoint-category rate limiting
 */

import { Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import type { ErrorResponse, RateLimitConfig, DEFAULT_RATE_LIMITS } from '../types/provisioning.types.js';
import { getSchemaPrefix, shouldUseSupabase } from '../../lib/db.js';
import { supabase } from '../../lib/supabase.js';

// Get schema prefix based on environment (empty for Supabase, ${SCHEMA()} for local)
function SCHEMA(): string { return getSchemaPrefix(); }

// Rate limit configuration
const RATE_LIMITS: RateLimitConfig = {
  provisioning_write: { limit: 100, windowMs: 60000 },   // 100 req/min
  provisioning_read: { limit: 500, windowMs: 60000 },    // 500 req/min
  usage_single: { limit: 200, windowMs: 60000 },         // 200 req/min
  usage_batch: { limit: 20, windowMs: 60000 }            // 20 req/min
};

type EndpointCategory = keyof RateLimitConfig;

// In-memory rate limit store (for fallback if DB fails)
const memoryStore = new Map<string, { count: number; windowStart: number }>();

/**
 * Get the rate limit category for an endpoint
 */
function getEndpointCategory(method: string, path: string): EndpointCategory {
  // Usage endpoints
  if (path.includes('/usage')) {
    if (path.includes('/batch')) {
      return 'usage_batch';
    }
    return 'usage_single';
  }

  // Provisioning endpoints
  if (method === 'GET') {
    return 'provisioning_read';
  }
  return 'provisioning_write';
}

/**
 * Create rate limiting middleware with database pool
 */
export function createRateLimiter(pool: Pool) {
  return function rateLimiterMiddleware(category?: EndpointCategory) {
    return async function rateLimiter(
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> {
      const clientId = req.auth?.clientId || 'anonymous';
      const requestId = req.auth?.requestId || 'unknown';

      // Determine category if not specified
      const endpointCategory = category || getEndpointCategory(req.method, req.path);

      // Get rate limit config (check for client override)
      let limitConfig = RATE_LIMITS[endpointCategory];
      if (req.auth?.client?.rateLimitOverride?.[endpointCategory]) {
        limitConfig = req.auth.client.rateLimitOverride[endpointCategory] as typeof limitConfig;
      }

      const { limit, windowMs } = limitConfig;
      const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

      try {
        let currentCount: number;

        // Use Supabase if configured
        if (shouldUseSupabase() && supabase) {
          // Check for existing bucket
          const { data: existingData } = await (supabase as any)
            .from('rate_limit_buckets')
            .select('id, request_count')
            .eq('client_id', clientId)
            .eq('endpoint_category', endpointCategory)
            .eq('window_start', windowStart.toISOString())
            .single();

          if (existingData) {
            // Update existing bucket
            const newCount = existingData.request_count + 1;
            await (supabase as any)
              .from('rate_limit_buckets')
              .update({ request_count: newCount })
              .eq('id', existingData.id);
            currentCount = newCount;
          } else {
            // Insert new bucket
            await (supabase as any)
              .from('rate_limit_buckets')
              .insert({
                client_id: clientId,
                endpoint_category: endpointCategory,
                window_start: windowStart.toISOString(),
                request_count: 1
              });
            currentCount = 1;
          }
        } else {
          // Fall back to pg pool
          const result = await pool.query<{ request_count: number }>(`
            INSERT INTO ${SCHEMA()}rate_limit_buckets (client_id, endpoint_category, window_start, request_count)
            VALUES ($1, $2, $3, 1)
            ON CONFLICT (client_id, endpoint_category, window_start)
            DO UPDATE SET request_count = rate_limit_buckets.request_count + 1
            RETURNING request_count
          `, [clientId, endpointCategory, windowStart]);

          currentCount = result.rows[0].request_count;
        }

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', limit.toString());
        res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - currentCount).toString());
        res.setHeader('X-RateLimit-Reset', new Date(windowStart.getTime() + windowMs).toISOString());

        if (currentCount > limit) {
          const errorResponse: ErrorResponse = {
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: `Rate limit exceeded. Maximum ${limit} requests per ${windowMs / 1000} seconds for ${endpointCategory}.`,
              requestId
            }
          };
          res.status(429).json(errorResponse);
          return;
        }

        next();
      } catch (dbError) {
        // Fallback to in-memory rate limiting
        console.error('Rate limit DB error, using in-memory fallback:', dbError);

        const key = `${clientId}:${endpointCategory}`;
        const now = Date.now();
        const windowStartMs = Math.floor(now / windowMs) * windowMs;

        let bucket = memoryStore.get(key);
        if (!bucket || bucket.windowStart !== windowStartMs) {
          bucket = { count: 0, windowStart: windowStartMs };
        }
        bucket.count++;
        memoryStore.set(key, bucket);

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', limit.toString());
        res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - bucket.count).toString());
        res.setHeader('X-RateLimit-Reset', new Date(windowStartMs + windowMs).toISOString());

        if (bucket.count > limit) {
          const errorResponse: ErrorResponse = {
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: `Rate limit exceeded. Maximum ${limit} requests per ${windowMs / 1000} seconds for ${endpointCategory}.`,
              requestId
            }
          };
          res.status(429).json(errorResponse);
          return;
        }

        next();
      }
    };
  };
}

/**
 * Cleanup old memory store entries periodically
 */
export function cleanupMemoryStore(): void {
  const now = Date.now();
  const maxAge = 120000; // 2 minutes

  for (const [key, bucket] of memoryStore.entries()) {
    if (now - bucket.windowStart > maxAge) {
      memoryStore.delete(key);
    }
  }
}

// Run cleanup every minute
setInterval(cleanupMemoryStore, 60000);

/**
 * Get current rate limit status for a client
 */
export async function getRateLimitStatus(
  pool: Pool,
  clientId: string
): Promise<Record<EndpointCategory, { current: number; limit: number; resetsAt: string }>> {
  const result: Record<EndpointCategory, { current: number; limit: number; resetsAt: string }> = {} as any;

  for (const [category, config] of Object.entries(RATE_LIMITS) as [EndpointCategory, typeof RATE_LIMITS[EndpointCategory]][]) {
    const windowMs = config.windowMs;
    const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

    try {
      let requestCount = 0;

      // Use Supabase if configured
      if (shouldUseSupabase() && supabase) {
        const { data } = await (supabase as any)
          .from('rate_limit_buckets')
          .select('request_count')
          .eq('client_id', clientId)
          .eq('endpoint_category', category)
          .eq('window_start', windowStart.toISOString())
          .single();

        requestCount = data?.request_count || 0;
      } else {
        // Fall back to pg pool
        const dbResult = await pool.query<{ request_count: number }>(`
          SELECT request_count
          FROM ${SCHEMA()}rate_limit_buckets
          WHERE client_id = $1 AND endpoint_category = $2 AND window_start = $3
        `, [clientId, category, windowStart]);

        requestCount = dbResult.rows[0]?.request_count || 0;
      }

      result[category] = {
        current: requestCount,
        limit: config.limit,
        resetsAt: new Date(windowStart.getTime() + windowMs).toISOString()
      };
    } catch {
      result[category] = {
        current: 0,
        limit: config.limit,
        resetsAt: new Date(Date.now() + windowMs).toISOString()
      };
    }
  }

  return result;
}
