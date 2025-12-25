/**
 * Audit Logging Middleware for Provisioning API
 * Logs all API requests for compliance and debugging
 */

import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import type { Pool } from 'pg';
import { getSchemaPrefix, shouldUseSupabase } from '../../lib/db.js';
import { supabase } from '../../lib/supabase.js';

// Get schema prefix based on environment (empty for Supabase, ${SCHEMA} for local)
const SCHEMA = getSchemaPrefix();

/**
 * Mask sensitive fields in request body
 */
function maskSensitiveData(body: any): any {
  if (!body || typeof body !== 'object') return body;

  const sensitiveFields = ['ki', 'opc', 'pin1', 'pin2', 'puk1', 'puk2', 'secret', 'password', 'token'];
  const masked = { ...body };

  for (const field of sensitiveFields) {
    if (masked[field]) {
      const value = String(masked[field]);
      masked[field] = value.substring(0, 4) + '****';
    }
  }

  // Handle nested profile object
  if (masked.profile && typeof masked.profile === 'object') {
    masked.profile = { ...masked.profile };
  }

  return masked;
}

/**
 * Hash request body for audit (without storing actual content)
 */
function hashBody(body: any): string | null {
  if (!body || Object.keys(body).length === 0) return null;
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

/**
 * Get client IP from request (handles proxies)
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = String(forwarded).split(',');
    return ips[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Create audit logging middleware with database pool
 */
export function createAuditLogger(pool: Pool) {
  return function auditLoggerMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const startTime = Date.now();
    const requestId = req.auth?.requestId || 'unknown';
    const clientId = req.auth?.clientId || null;
    const clientIp = getClientIp(req);
    const userAgent = req.headers['user-agent'] || null;

    // Capture original end function
    const originalEnd = res.end;
    let responseStatusCode: number;

    // Override end to capture status code
    res.end = function(chunk?: any, encoding?: any, callback?: any): Response {
      responseStatusCode = res.statusCode;

      // Calculate response time
      const responseTimeMs = Date.now() - startTime;

      // Log to database (fire and forget)
      if (shouldUseSupabase() && supabase) {
        supabase
          .from('api_audit_log')
          .insert({
            request_id: requestId,
            client_id: clientId,
            client_ip: clientIp,
            user_agent: userAgent,
            method: req.method,
            endpoint: req.path,
            query_params: Object.keys(req.query).length > 0 ? req.query : null,
            request_body_hash: hashBody(req.body),
            status_code: responseStatusCode,
            response_time_ms: responseTimeMs
          })
          .then(({ error }: { error: Error | null }) => {
            if (error) console.error('Failed to write audit log:', error);
          });
      } else {
        pool.query(`
          INSERT INTO ${SCHEMA}api_audit_log
          (request_id, client_id, client_ip, user_agent, method, endpoint, query_params, request_body_hash, status_code, response_time_ms)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          requestId,
          clientId,
          clientIp,
          userAgent,
          req.method,
          req.path,
          Object.keys(req.query).length > 0 ? JSON.stringify(req.query) : null,
          hashBody(req.body),
          responseStatusCode,
          responseTimeMs
        ]).catch(err => {
          console.error('Failed to write audit log:', err);
        });
      }

      // Call original end
      return originalEnd.call(this, chunk, encoding, callback);
    };

    next();
  };
}

/**
 * Log SIM state changes to dedicated audit log
 */
export async function logSimStateChange(
  pool: Pool,
  params: {
    simId: string;
    iccid?: string;
    action: string;
    previousStatus?: string;
    newStatus?: string;
    reason?: string;
    notes?: string;
    initiatedBy: 'SYSTEM' | 'USER' | 'API';
    clientId?: string;
    correlationId?: string;
    requestId: string;
    ipAddress?: string;
    changes?: Record<string, any>;
  }
): Promise<void> {
  try {
    // Use Supabase if configured
    if (shouldUseSupabase() && supabase) {
      await supabase
        .from('sim_audit_log')
        .insert({
          sim_id: params.simId,
          iccid: params.iccid || null,
          action: params.action,
          previous_status: params.previousStatus || null,
          new_status: params.newStatus || null,
          reason: params.reason || null,
          notes: params.notes || null,
          initiated_by: params.initiatedBy,
          client_id: params.clientId || null,
          correlation_id: params.correlationId || null,
          request_id: params.requestId,
          ip_address: params.ipAddress || null,
          changes: params.changes || null
        });
      return;
    }

    // Fall back to pg pool
    await pool.query(`
      INSERT INTO ${SCHEMA}sim_audit_log
      (sim_id, iccid, action, previous_status, new_status, reason, notes, initiated_by, client_id, correlation_id, request_id, ip_address, changes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      params.simId,
      params.iccid || null,
      params.action,
      params.previousStatus || null,
      params.newStatus || null,
      params.reason || null,
      params.notes || null,
      params.initiatedBy,
      params.clientId || null,
      params.correlationId || null,
      params.requestId,
      params.ipAddress || null,
      params.changes ? JSON.stringify(params.changes) : null
    ]);
  } catch (err) {
    console.error('Failed to write SIM audit log:', err);
  }
}

/**
 * Log webhook delivery attempt
 */
export async function logWebhookDelivery(
  pool: Pool,
  params: {
    eventId: string;
    eventType: string;
    webhookId: string;
    payload: object;
    status: 'PENDING' | 'DELIVERED' | 'FAILED' | 'ABANDONED';
    attemptCount: number;
    responseCode?: number;
    responseBody?: string;
    responseTimeMs?: number;
    nextRetryAt?: Date;
  }
): Promise<number> {
  try {
    // Use Supabase if configured
    if (shouldUseSupabase() && supabase) {
      const { data, error } = await (supabase as any)
        .from('webhook_deliveries')
        .insert({
          event_id: params.eventId,
          event_type: params.eventType,
          webhook_id: params.webhookId,
          payload: params.payload,
          status: params.status,
          attempt_count: params.attemptCount,
          response_code: params.responseCode || null,
          response_body: params.responseBody || null,
          response_time_ms: params.responseTimeMs || null,
          next_retry_at: params.nextRetryAt?.toISOString() || null,
          last_attempt_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) throw error;
      return data?.id || -1;
    }

    // Fall back to pg pool
    const result = await pool.query<{ id: number }>(`
      INSERT INTO ${SCHEMA}webhook_deliveries
      (event_id, event_type, webhook_id, payload, status, attempt_count, response_code, response_body, response_time_ms, next_retry_at, last_attempt_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING id
    `, [
      params.eventId,
      params.eventType,
      params.webhookId,
      JSON.stringify(params.payload),
      params.status,
      params.attemptCount,
      params.responseCode || null,
      params.responseBody || null,
      params.responseTimeMs || null,
      params.nextRetryAt || null
    ]);
    return result.rows[0].id;
  } catch (err) {
    console.error('Failed to log webhook delivery:', err);
    return -1;
  }
}

/**
 * Update existing webhook delivery record
 */
export async function updateWebhookDelivery(
  pool: Pool,
  deliveryId: number,
  params: {
    status: 'PENDING' | 'DELIVERED' | 'FAILED' | 'ABANDONED';
    attemptCount: number;
    responseCode?: number;
    responseBody?: string;
    responseTimeMs?: number;
    nextRetryAt?: Date;
    deliveredAt?: Date;
  }
): Promise<void> {
  try {
    // Use Supabase if configured
    if (shouldUseSupabase() && supabase) {
      await supabase
        .from('webhook_deliveries')
        .update({
          status: params.status,
          attempt_count: params.attemptCount,
          response_code: params.responseCode || null,
          response_body: params.responseBody || null,
          response_time_ms: params.responseTimeMs || null,
          next_retry_at: params.nextRetryAt?.toISOString() || null,
          delivered_at: params.deliveredAt?.toISOString() || null,
          last_attempt_at: new Date().toISOString()
        })
        .eq('id', deliveryId);
      return;
    }

    // Fall back to pg pool
    await pool.query(`
      UPDATE ${SCHEMA}webhook_deliveries
      SET status = $2, attempt_count = $3, response_code = $4, response_body = $5,
          response_time_ms = $6, next_retry_at = $7, delivered_at = $8, last_attempt_at = NOW()
      WHERE id = $1
    `, [
      deliveryId,
      params.status,
      params.attemptCount,
      params.responseCode || null,
      params.responseBody || null,
      params.responseTimeMs || null,
      params.nextRetryAt || null,
      params.deliveredAt || null
    ]);
  } catch (err) {
    console.error('Failed to update webhook delivery:', err);
  }
}
