/**
 * SIM Service - Core business logic for SIM lifecycle management
 */

import type { Pool } from 'pg';
import { createHash } from 'crypto';
import type {
  CreateSimRequest,
  UpdateSimRequest,
  ActionRequest,
  BlockRequest,
  SimResponse,
  SimDetailResponse,
  SimSearchParams,
  SimStatus,
  BlockReason,
  Initiator,
  DbProvisionedSim,
  ErrorCode,
  canTransition
} from '../types/provisioning.types.js';
import { logSimStateChange } from '../middleware/audit-logger.js';
import { getSchemaPrefix, shouldUseSupabase } from '../../lib/db.js';
import { supabase } from '../../lib/supabase.js';

// Get schema prefix based on environment (empty for Supabase, ${SCHEMA} for local)
const SCHEMA = getSchemaPrefix();

// State transitions map
const STATE_TRANSITIONS: Record<SimStatus, SimStatus[]> = {
  'PROVISIONED': ['ACTIVE'],
  'ACTIVE': ['INACTIVE', 'BLOCKED'],
  'INACTIVE': ['ACTIVE', 'BLOCKED'],
  'BLOCKED': ['ACTIVE', 'INACTIVE']
};

function canTransitionState(from: SimStatus, to: SimStatus): boolean {
  return STATE_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Encrypt sensitive data (simplified - use proper encryption in production)
 */
function encryptSensitiveField(value: string | undefined): string | null {
  if (!value) return null;
  // In production, use proper encryption with pgcrypto or application-level encryption
  // For now, we'll use base64 encoding as a placeholder
  return Buffer.from(value).toString('base64');
}

/**
 * Decrypt sensitive data
 */
function decryptSensitiveField(value: string | null): string | null {
  if (!value) return null;
  return Buffer.from(value, 'base64').toString('utf8');
}

/**
 * Generate HATEOAS links for a SIM
 */
function generateLinks(simId: string, status: SimStatus): SimResponse['links'] {
  const baseUrl = '/api/v1/sims';
  const links: SimResponse['links'] = {
    self: `${baseUrl}/${simId}`,
    usage: `${baseUrl}/${simId}/usage`
  };

  // Add action links based on status
  if (status === 'PROVISIONED' || status === 'INACTIVE') {
    links.activate = `${baseUrl}/${simId}/activate`;
  }
  if (status === 'ACTIVE') {
    links.deactivate = `${baseUrl}/${simId}/deactivate`;
  }

  return links;
}

/**
 * Convert database row to API response
 */
function toSimResponse(row: DbProvisionedSim): SimResponse {
  return {
    simId: row.sim_id,
    iccid: row.iccid,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    links: generateLinks(row.sim_id, row.status)
  };
}

/**
 * Convert database row to detailed API response
 */
function toSimDetailResponse(row: DbProvisionedSim): SimDetailResponse {
  return {
    ...toSimResponse(row),
    imsi: row.imsi,
    msisdn: row.msisdn,
    imei: row.imei || undefined,
    profile: {
      apn: row.apn,
      ratePlanId: row.rate_plan_id,
      dataLimit: row.data_limit_bytes || undefined,
      billingAccountId: row.billing_account_id,
      customerId: row.customer_id
    },
    metadata: row.metadata || undefined,
    blockReason: row.block_reason || undefined,
    blockNotes: row.block_notes || undefined,
    blockedAt: row.blocked_at || undefined,
    activatedAt: row.activated_at || undefined,
    deactivatedAt: row.deactivated_at || undefined
  };
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export class SimService {
  constructor(private pool: Pool) {}

  /**
   * Create a new SIM
   */
  async createSim(
    data: CreateSimRequest,
    context: { clientId: string; requestId: string; ipAddress?: string }
  ): Promise<{ success: true; data: SimResponse } | { success: false; error: ErrorCode; message: string }> {
    try {
      // Determine initial status
      const initialStatus: SimStatus = data.activateImmediately ? 'ACTIVE' : 'PROVISIONED';

      // Use Supabase if configured
      if (shouldUseSupabase() && supabase) {
        // Check for duplicate ICCID
        const { data: existingData } = await supabase
          .from('provisioned_sims')
          .select('sim_id')
          .eq('iccid', data.iccid)
          .single();

        if (existingData) {
          return {
            success: false,
            error: 'DUPLICATE_ICCID',
            message: `SIM with ICCID ${data.iccid} already exists`
          };
        }

        // Insert SIM
        const { data: simData, error: insertError } = await supabase
          .from('provisioned_sims')
          .insert({
            iccid: data.iccid,
            imsi: data.imsi,
            msisdn: data.msisdn,
            imei: data.imei || null,
            puk1: encryptSensitiveField(data.puk1),
            puk2: encryptSensitiveField(data.puk2),
            pin1: encryptSensitiveField(data.pin1),
            pin2: encryptSensitiveField(data.pin2),
            ki: encryptSensitiveField(data.ki),
            opc: encryptSensitiveField(data.opc),
            apn: data.profile.apn,
            rate_plan_id: data.profile.ratePlanId,
            data_limit_bytes: data.profile.dataLimit || null,
            billing_account_id: data.profile.billingAccountId,
            customer_id: data.profile.customerId,
            status: initialStatus,
            metadata: data.metadata || null,
            activated_at: data.activateImmediately ? new Date().toISOString() : null
          })
          .select('*')
          .single();

        if (insertError) throw insertError;
        const sim = simData as unknown as DbProvisionedSim;

        // Log the creation
        await logSimStateChange(this.pool, {
          simId: sim.sim_id,
          iccid: sim.iccid,
          action: 'CREATE',
          newStatus: initialStatus,
          initiatedBy: 'API',
          clientId: context.clientId,
          requestId: context.requestId,
          ipAddress: context.ipAddress
        });

        return { success: true, data: toSimResponse(sim) };
      }

      // Fall back to pg pool
      // Check for duplicate ICCID
      const existing = await this.pool.query(
        `SELECT sim_id FROM ${SCHEMA}provisioned_sims WHERE iccid = $1`,
        [data.iccid]
      );

      if (existing.rows.length > 0) {
        return {
          success: false,
          error: 'DUPLICATE_ICCID',
          message: `SIM with ICCID ${data.iccid} already exists`
        };
      }

      // Insert SIM
      const result = await this.pool.query<DbProvisionedSim>(`
        INSERT INTO ${SCHEMA}provisioned_sims (
          iccid, imsi, msisdn, imei, puk1, puk2, pin1, pin2, ki, opc,
          apn, rate_plan_id, data_limit_bytes, billing_account_id, customer_id,
          status, metadata, activated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, $17, $18
        ) RETURNING *
      `, [
        data.iccid,
        data.imsi,
        data.msisdn,
        data.imei || null,
        encryptSensitiveField(data.puk1),
        encryptSensitiveField(data.puk2),
        encryptSensitiveField(data.pin1),
        encryptSensitiveField(data.pin2),
        encryptSensitiveField(data.ki),
        encryptSensitiveField(data.opc),
        data.profile.apn,
        data.profile.ratePlanId,
        data.profile.dataLimit || null,
        data.profile.billingAccountId,
        data.profile.customerId,
        initialStatus,
        data.metadata ? JSON.stringify(data.metadata) : null,
        data.activateImmediately ? new Date().toISOString() : null
      ]);

      const sim = result.rows[0];

      // Log the creation
      await logSimStateChange(this.pool, {
        simId: sim.sim_id,
        iccid: sim.iccid,
        action: 'CREATE',
        newStatus: initialStatus,
        initiatedBy: 'API',
        clientId: context.clientId,
        requestId: context.requestId,
        ipAddress: context.ipAddress
      });

      return { success: true, data: toSimResponse(sim) };
    } catch (error) {
      console.error('Error creating SIM:', error);
      throw error;
    }
  }

  /**
   * Get SIM by ID
   */
  async getSimById(simId: string): Promise<SimDetailResponse | null> {
    // Use Supabase if configured
    if (shouldUseSupabase() && supabase) {
      const { data: simData, error } = await supabase
        .from('provisioned_sims')
        .select('*')
        .eq('sim_id', simId)
        .single();

      if (error || !simData) return null;

      const sim = toSimDetailResponse(simData as unknown as DbProvisionedSim);

      // Get usage summary
      const { data: usageData } = await supabase
        .from('usage_cycles')
        .select('total_bytes, last_updated')
        .eq('sim_id', simId)
        .eq('is_current', true)
        .single();

      if (usageData) {
        const dataLimit = (simData as any).data_limit_bytes || 0;
        sim.usageSummary = {
          currentCycle: {
            totalBytes: usageData.total_bytes,
            totalFormatted: formatBytes(usageData.total_bytes),
            percentOfLimit: dataLimit > 0 ? (usageData.total_bytes / dataLimit) * 100 : 0
          },
          lastUpdated: usageData.last_updated
        };
      }

      return sim;
    }

    // Fall back to pg pool
    const result = await this.pool.query<DbProvisionedSim>(
      `SELECT * FROM ${SCHEMA}provisioned_sims WHERE sim_id = $1`,
      [simId]
    );

    if (result.rows.length === 0) return null;

    const sim = toSimDetailResponse(result.rows[0]);

    // Get usage summary
    const usageResult = await this.pool.query<{
      total_bytes: number;
      last_updated: string;
    }>(`
      SELECT total_bytes, last_updated
      FROM ${SCHEMA}usage_cycles
      WHERE sim_id = $1 AND is_current = true
    `, [simId]);

    if (usageResult.rows.length > 0) {
      const usage = usageResult.rows[0];
      const dataLimit = result.rows[0].data_limit_bytes || 0;
      sim.usageSummary = {
        currentCycle: {
          totalBytes: usage.total_bytes,
          totalFormatted: formatBytes(usage.total_bytes),
          percentOfLimit: dataLimit > 0 ? (usage.total_bytes / dataLimit) * 100 : 0
        },
        lastUpdated: usage.last_updated
      };
    }

    return sim;
  }

  /**
   * Get SIM by ICCID
   */
  async getSimByIccid(iccid: string): Promise<SimDetailResponse | null> {
    // Use Supabase if configured
    if (shouldUseSupabase() && supabase) {
      const { data, error } = await supabase
        .from('provisioned_sims')
        .select('*')
        .eq('iccid', iccid)
        .single();

      if (error || !data) return null;
      return toSimDetailResponse(data as unknown as DbProvisionedSim);
    }

    // Fall back to pg pool
    const result = await this.pool.query<DbProvisionedSim>(
      `SELECT * FROM ${SCHEMA}provisioned_sims WHERE iccid = $1`,
      [iccid]
    );

    if (result.rows.length === 0) return null;
    return toSimDetailResponse(result.rows[0]);
  }

  /**
   * Get SIM by MSISDN
   */
  async getSimByMsisdn(msisdn: string): Promise<SimDetailResponse | null> {
    // Use Supabase if configured
    if (shouldUseSupabase() && supabase) {
      const { data, error } = await supabase
        .from('provisioned_sims')
        .select('*')
        .eq('msisdn', msisdn)
        .single();

      if (error || !data) return null;
      return toSimDetailResponse(data as unknown as DbProvisionedSim);
    }

    // Fall back to pg pool
    const result = await this.pool.query<DbProvisionedSim>(
      `SELECT * FROM ${SCHEMA}provisioned_sims WHERE msisdn = $1`,
      [msisdn]
    );

    if (result.rows.length === 0) return null;
    return toSimDetailResponse(result.rows[0]);
  }

  /**
   * Search SIMs with pagination
   */
  async searchSims(params: SimSearchParams): Promise<{
    data: SimResponse[];
    pagination: { total: number; limit: number; offset: number; hasMore: boolean };
  }> {
    const limit = Math.min(params.limit || 20, 100);
    const offset = params.offset || 0;

    // Use Supabase if configured
    if (shouldUseSupabase() && supabase) {
      let query = supabase
        .from('provisioned_sims')
        .select('*', { count: 'exact' });

      // Apply filters
      if (params.iccid) query = query.eq('iccid', params.iccid);
      if (params.msisdn) query = query.eq('msisdn', params.msisdn);
      if (params.status) query = query.eq('status', params.status);
      if (params.customerId) query = query.eq('customer_id', params.customerId);
      if (params.billingAccountId) query = query.eq('billing_account_id', params.billingAccountId);

      // Apply pagination and ordering
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      const total = count || 0;
      const rows = (data || []) as unknown as DbProvisionedSim[];

      return {
        data: rows.map(toSimResponse),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + rows.length < total
        }
      };
    }

    // Fall back to pg pool
    // Build WHERE clause
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 0;

    if (params.iccid) {
      paramIndex++;
      conditions.push(`iccid = $${paramIndex}`);
      values.push(params.iccid);
    }
    if (params.msisdn) {
      paramIndex++;
      conditions.push(`msisdn = $${paramIndex}`);
      values.push(params.msisdn);
    }
    if (params.status) {
      paramIndex++;
      conditions.push(`status = $${paramIndex}`);
      values.push(params.status);
    }
    if (params.customerId) {
      paramIndex++;
      conditions.push(`customer_id = $${paramIndex}`);
      values.push(params.customerId);
    }
    if (params.billingAccountId) {
      paramIndex++;
      conditions.push(`billing_account_id = $${paramIndex}`);
      values.push(params.billingAccountId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM ${SCHEMA}provisioned_sims ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    paramIndex++;
    const limitParam = paramIndex;
    paramIndex++;
    const offsetParam = paramIndex;

    const result = await this.pool.query<DbProvisionedSim>(
      `SELECT * FROM ${SCHEMA}provisioned_sims ${whereClause}
       ORDER BY created_at DESC LIMIT $${limitParam} OFFSET $${offsetParam}`,
      [...values, limit, offset]
    );

    return {
      data: result.rows.map(toSimResponse),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + result.rows.length < total
      }
    };
  }

  /**
   * Update SIM (partial update with deep merge)
   */
  async updateSim(
    simId: string,
    data: UpdateSimRequest,
    context: { clientId: string; requestId: string; ipAddress?: string }
  ): Promise<{ success: true; data: SimResponse } | { success: false; error: ErrorCode; message: string }> {
    // Use Supabase if configured
    if (shouldUseSupabase() && supabase) {
      // Get current SIM
      const { data: currentData, error: fetchError } = await supabase
        .from('provisioned_sims')
        .select('*')
        .eq('sim_id', simId)
        .single();

      if (fetchError || !currentData) {
        return { success: false, error: 'SIM_NOT_FOUND', message: `SIM ${simId} not found` };
      }

      const currentSim = currentData as unknown as DbProvisionedSim;
      const changes: Record<string, any> = {};
      const updateData: Record<string, any> = {};

      if (data.imei !== undefined) {
        updateData.imei = data.imei;
        changes.imei = { from: currentSim.imei, to: data.imei };
      }

      // Deep merge profile
      if (data.profile) {
        if (data.profile.apn !== undefined) {
          updateData.apn = data.profile.apn;
          changes['profile.apn'] = { from: currentSim.apn, to: data.profile.apn };
        }
        if (data.profile.ratePlanId !== undefined) {
          updateData.rate_plan_id = data.profile.ratePlanId;
          changes['profile.ratePlanId'] = { from: currentSim.rate_plan_id, to: data.profile.ratePlanId };
        }
        if (data.profile.dataLimit !== undefined) {
          updateData.data_limit_bytes = data.profile.dataLimit;
          changes['profile.dataLimit'] = { from: currentSim.data_limit_bytes, to: data.profile.dataLimit };
        }
        if (data.profile.billingAccountId !== undefined) {
          updateData.billing_account_id = data.profile.billingAccountId;
          changes['profile.billingAccountId'] = { from: currentSim.billing_account_id, to: data.profile.billingAccountId };
        }
        if (data.profile.customerId !== undefined) {
          updateData.customer_id = data.profile.customerId;
          changes['profile.customerId'] = { from: currentSim.customer_id, to: data.profile.customerId };
        }
      }

      // Deep merge metadata
      if (data.metadata) {
        const mergedMetadata = { ...(currentSim.metadata || {}), ...data.metadata };
        updateData.metadata = mergedMetadata;
        changes.metadata = { merged: data.metadata };
      }

      if (Object.keys(updateData).length === 0) {
        return { success: true, data: toSimResponse(currentSim) };
      }

      updateData.updated_at = new Date().toISOString();

      const { data: updatedData, error: updateError } = await supabase
        .from('provisioned_sims')
        .update(updateData)
        .eq('sim_id', simId)
        .select('*')
        .single();

      if (updateError) throw updateError;

      // Log the update
      await logSimStateChange(this.pool, {
        simId,
        iccid: currentSim.iccid,
        action: 'UPDATE',
        initiatedBy: 'API',
        clientId: context.clientId,
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        changes
      });

      return { success: true, data: toSimResponse(updatedData as unknown as DbProvisionedSim) };
    }

    // Fall back to pg pool
    // Get current SIM
    const current = await this.pool.query<DbProvisionedSim>(
      `SELECT * FROM ${SCHEMA}provisioned_sims WHERE sim_id = $1`,
      [simId]
    );

    if (current.rows.length === 0) {
      return { success: false, error: 'SIM_NOT_FOUND', message: `SIM ${simId} not found` };
    }

    const currentSim = current.rows[0];
    const changes: Record<string, any> = {};

    // Build update fields
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 0;

    if (data.imei !== undefined) {
      paramIndex++;
      updates.push(`imei = $${paramIndex}`);
      values.push(data.imei);
      changes.imei = { from: currentSim.imei, to: data.imei };
    }

    // Deep merge profile
    if (data.profile) {
      if (data.profile.apn !== undefined) {
        paramIndex++;
        updates.push(`apn = $${paramIndex}`);
        values.push(data.profile.apn);
        changes['profile.apn'] = { from: currentSim.apn, to: data.profile.apn };
      }
      if (data.profile.ratePlanId !== undefined) {
        paramIndex++;
        updates.push(`rate_plan_id = $${paramIndex}`);
        values.push(data.profile.ratePlanId);
        changes['profile.ratePlanId'] = { from: currentSim.rate_plan_id, to: data.profile.ratePlanId };
      }
      if (data.profile.dataLimit !== undefined) {
        paramIndex++;
        updates.push(`data_limit_bytes = $${paramIndex}`);
        values.push(data.profile.dataLimit);
        changes['profile.dataLimit'] = { from: currentSim.data_limit_bytes, to: data.profile.dataLimit };
      }
      if (data.profile.billingAccountId !== undefined) {
        paramIndex++;
        updates.push(`billing_account_id = $${paramIndex}`);
        values.push(data.profile.billingAccountId);
        changes['profile.billingAccountId'] = { from: currentSim.billing_account_id, to: data.profile.billingAccountId };
      }
      if (data.profile.customerId !== undefined) {
        paramIndex++;
        updates.push(`customer_id = $${paramIndex}`);
        values.push(data.profile.customerId);
        changes['profile.customerId'] = { from: currentSim.customer_id, to: data.profile.customerId };
      }
    }

    // Deep merge metadata
    if (data.metadata) {
      const mergedMetadata = { ...(currentSim.metadata || {}), ...data.metadata };
      paramIndex++;
      updates.push(`metadata = $${paramIndex}`);
      values.push(JSON.stringify(mergedMetadata));
      changes.metadata = { merged: data.metadata };
    }

    if (updates.length === 0) {
      return { success: true, data: toSimResponse(currentSim) };
    }

    // Add simId for WHERE clause
    paramIndex++;
    values.push(simId);

    const result = await this.pool.query<DbProvisionedSim>(
      `UPDATE ${SCHEMA}provisioned_sims
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE sim_id = $${paramIndex}
       RETURNING *`,
      values
    );

    // Log the update
    await logSimStateChange(this.pool, {
      simId,
      iccid: currentSim.iccid,
      action: 'UPDATE',
      initiatedBy: 'API',
      clientId: context.clientId,
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      changes
    });

    return { success: true, data: toSimResponse(result.rows[0]) };
  }

  /**
   * Activate SIM
   */
  async activateSim(
    simId: string,
    data: ActionRequest,
    context: { clientId: string; requestId: string; ipAddress?: string }
  ): Promise<{ success: true; data: SimResponse; emitWebhook: boolean } | { success: false; error: ErrorCode; message: string }> {
    // Use Supabase if configured
    if (shouldUseSupabase() && supabase) {
      const { data: simData, error: fetchError } = await supabase
        .from('provisioned_sims')
        .select('*')
        .eq('sim_id', simId)
        .single();

      if (fetchError || !simData) {
        return { success: false, error: 'SIM_NOT_FOUND', message: `SIM ${simId} not found` };
      }

      const sim = simData as unknown as DbProvisionedSim;

      if (!canTransitionState(sim.status, 'ACTIVE')) {
        return {
          success: false,
          error: 'INVALID_STATE_TRANSITION',
          message: `Cannot activate SIM in ${sim.status} status`
        };
      }

      const { data: updatedData, error: updateError } = await supabase
        .from('provisioned_sims')
        .update({
          status: 'ACTIVE',
          activated_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('sim_id', simId)
        .select('*')
        .single();

      if (updateError) throw updateError;

      await logSimStateChange(this.pool, {
        simId,
        iccid: sim.iccid,
        action: 'ACTIVATE',
        previousStatus: sim.status,
        newStatus: 'ACTIVE',
        reason: data.reason,
        notes: data.notes,
        initiatedBy: 'API',
        clientId: context.clientId,
        correlationId: data.correlationId,
        requestId: context.requestId,
        ipAddress: context.ipAddress
      });

      return {
        success: true,
        data: toSimResponse(updatedData as unknown as DbProvisionedSim),
        emitWebhook: data.notifyProvisioning !== false
      };
    }

    // Fall back to pg pool
    const current = await this.pool.query<DbProvisionedSim>(
      `SELECT * FROM ${SCHEMA}provisioned_sims WHERE sim_id = $1`,
      [simId]
    );

    if (current.rows.length === 0) {
      return { success: false, error: 'SIM_NOT_FOUND', message: `SIM ${simId} not found` };
    }

    const sim = current.rows[0];

    if (!canTransitionState(sim.status, 'ACTIVE')) {
      return {
        success: false,
        error: 'INVALID_STATE_TRANSITION',
        message: `Cannot activate SIM in ${sim.status} status`
      };
    }

    const result = await this.pool.query<DbProvisionedSim>(
      `UPDATE ${SCHEMA}provisioned_sims
       SET status = 'ACTIVE', activated_at = NOW(), updated_at = NOW()
       WHERE sim_id = $1
       RETURNING *`,
      [simId]
    );

    await logSimStateChange(this.pool, {
      simId,
      iccid: sim.iccid,
      action: 'ACTIVATE',
      previousStatus: sim.status,
      newStatus: 'ACTIVE',
      reason: data.reason,
      notes: data.notes,
      initiatedBy: 'API',
      clientId: context.clientId,
      correlationId: data.correlationId,
      requestId: context.requestId,
      ipAddress: context.ipAddress
    });

    return {
      success: true,
      data: toSimResponse(result.rows[0]),
      emitWebhook: data.notifyProvisioning !== false
    };
  }

  /**
   * Deactivate SIM
   */
  async deactivateSim(
    simId: string,
    data: ActionRequest,
    context: { clientId: string; requestId: string; ipAddress?: string }
  ): Promise<{ success: true; data: SimResponse; emitWebhook: boolean } | { success: false; error: ErrorCode; message: string }> {
    // Use Supabase if configured
    if (shouldUseSupabase() && supabase) {
      const { data: simData, error: fetchError } = await supabase
        .from('provisioned_sims')
        .select('*')
        .eq('sim_id', simId)
        .single();

      if (fetchError || !simData) {
        return { success: false, error: 'SIM_NOT_FOUND', message: `SIM ${simId} not found` };
      }

      const sim = simData as unknown as DbProvisionedSim;

      if (!canTransitionState(sim.status, 'INACTIVE')) {
        return {
          success: false,
          error: 'INVALID_STATE_TRANSITION',
          message: `Cannot deactivate SIM in ${sim.status} status`
        };
      }

      const { data: updatedData, error: updateError } = await supabase
        .from('provisioned_sims')
        .update({
          status: 'INACTIVE',
          deactivated_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('sim_id', simId)
        .select('*')
        .single();

      if (updateError) throw updateError;

      await logSimStateChange(this.pool, {
        simId,
        iccid: sim.iccid,
        action: 'DEACTIVATE',
        previousStatus: sim.status,
        newStatus: 'INACTIVE',
        reason: data.reason,
        notes: data.notes,
        initiatedBy: 'API',
        clientId: context.clientId,
        correlationId: data.correlationId,
        requestId: context.requestId,
        ipAddress: context.ipAddress
      });

      return {
        success: true,
        data: toSimResponse(updatedData as unknown as DbProvisionedSim),
        emitWebhook: data.notifyProvisioning !== false
      };
    }

    // Fall back to pg pool
    const current = await this.pool.query<DbProvisionedSim>(
      `SELECT * FROM ${SCHEMA}provisioned_sims WHERE sim_id = $1`,
      [simId]
    );

    if (current.rows.length === 0) {
      return { success: false, error: 'SIM_NOT_FOUND', message: `SIM ${simId} not found` };
    }

    const sim = current.rows[0];

    if (!canTransitionState(sim.status, 'INACTIVE')) {
      return {
        success: false,
        error: 'INVALID_STATE_TRANSITION',
        message: `Cannot deactivate SIM in ${sim.status} status`
      };
    }

    const result = await this.pool.query<DbProvisionedSim>(
      `UPDATE ${SCHEMA}provisioned_sims
       SET status = 'INACTIVE', deactivated_at = NOW(), updated_at = NOW()
       WHERE sim_id = $1
       RETURNING *`,
      [simId]
    );

    await logSimStateChange(this.pool, {
      simId,
      iccid: sim.iccid,
      action: 'DEACTIVATE',
      previousStatus: sim.status,
      newStatus: 'INACTIVE',
      reason: data.reason,
      notes: data.notes,
      initiatedBy: 'API',
      clientId: context.clientId,
      correlationId: data.correlationId,
      requestId: context.requestId,
      ipAddress: context.ipAddress
    });

    return {
      success: true,
      data: toSimResponse(result.rows[0]),
      emitWebhook: data.notifyProvisioning !== false
    };
  }

  /**
   * Block SIM
   */
  async blockSim(
    simId: string,
    data: BlockRequest,
    context: { clientId: string; requestId: string; ipAddress?: string }
  ): Promise<{ success: true; data: SimResponse; emitWebhook: boolean } | { success: false; error: ErrorCode; message: string }> {
    // Use Supabase if configured
    if (shouldUseSupabase() && supabase) {
      const { data: simData, error: fetchError } = await supabase
        .from('provisioned_sims')
        .select('*')
        .eq('sim_id', simId)
        .single();

      if (fetchError || !simData) {
        return { success: false, error: 'SIM_NOT_FOUND', message: `SIM ${simId} not found` };
      }

      const sim = simData as unknown as DbProvisionedSim;

      if (!canTransitionState(sim.status, 'BLOCKED')) {
        return {
          success: false,
          error: 'INVALID_STATE_TRANSITION',
          message: `Cannot block SIM in ${sim.status} status`
        };
      }

      const { data: updatedData, error: updateError } = await supabase
        .from('provisioned_sims')
        .update({
          status: 'BLOCKED',
          previous_status: sim.status,
          block_reason: data.reason,
          block_notes: data.notes || null,
          blocked_at: new Date().toISOString(),
          blocked_by: 'API',
          updated_at: new Date().toISOString()
        })
        .eq('sim_id', simId)
        .select('*')
        .single();

      if (updateError) throw updateError;

      await logSimStateChange(this.pool, {
        simId,
        iccid: sim.iccid,
        action: 'BLOCK',
        previousStatus: sim.status,
        newStatus: 'BLOCKED',
        reason: data.reason,
        notes: data.notes,
        initiatedBy: 'API',
        clientId: context.clientId,
        correlationId: data.correlationId,
        requestId: context.requestId,
        ipAddress: context.ipAddress
      });

      return {
        success: true,
        data: toSimResponse(updatedData as unknown as DbProvisionedSim),
        emitWebhook: data.notifyProvisioning !== false
      };
    }

    // Fall back to pg pool
    const current = await this.pool.query<DbProvisionedSim>(
      `SELECT * FROM ${SCHEMA}provisioned_sims WHERE sim_id = $1`,
      [simId]
    );

    if (current.rows.length === 0) {
      return { success: false, error: 'SIM_NOT_FOUND', message: `SIM ${simId} not found` };
    }

    const sim = current.rows[0];

    if (!canTransitionState(sim.status, 'BLOCKED')) {
      return {
        success: false,
        error: 'INVALID_STATE_TRANSITION',
        message: `Cannot block SIM in ${sim.status} status`
      };
    }

    const result = await this.pool.query<DbProvisionedSim>(
      `UPDATE ${SCHEMA}provisioned_sims
       SET status = 'BLOCKED', previous_status = $2, block_reason = $3, block_notes = $4,
           blocked_at = NOW(), blocked_by = 'API', updated_at = NOW()
       WHERE sim_id = $1
       RETURNING *`,
      [simId, sim.status, data.reason, data.notes || null]
    );

    await logSimStateChange(this.pool, {
      simId,
      iccid: sim.iccid,
      action: 'BLOCK',
      previousStatus: sim.status,
      newStatus: 'BLOCKED',
      reason: data.reason,
      notes: data.notes,
      initiatedBy: 'API',
      clientId: context.clientId,
      correlationId: data.correlationId,
      requestId: context.requestId,
      ipAddress: context.ipAddress
    });

    return {
      success: true,
      data: toSimResponse(result.rows[0]),
      emitWebhook: data.notifyProvisioning !== false
    };
  }

  /**
   * Unblock SIM (returns to previous status)
   */
  async unblockSim(
    simId: string,
    data: BlockRequest,
    context: { clientId: string; requestId: string; ipAddress?: string }
  ): Promise<{ success: true; data: SimResponse; emitWebhook: boolean } | { success: false; error: ErrorCode; message: string }> {
    // Use Supabase if configured
    if (shouldUseSupabase() && supabase) {
      const { data: simData, error: fetchError } = await supabase
        .from('provisioned_sims')
        .select('*')
        .eq('sim_id', simId)
        .single();

      if (fetchError || !simData) {
        return { success: false, error: 'SIM_NOT_FOUND', message: `SIM ${simId} not found` };
      }

      const sim = simData as unknown as DbProvisionedSim;

      if (sim.status !== 'BLOCKED') {
        return {
          success: false,
          error: 'INVALID_STATE_TRANSITION',
          message: 'SIM is not blocked'
        };
      }

      // Return to previous status (default to INACTIVE if not set)
      const newStatus = sim.previous_status || 'INACTIVE';

      const { data: updatedData, error: updateError } = await supabase
        .from('provisioned_sims')
        .update({
          status: newStatus,
          previous_status: null,
          block_reason: null,
          block_notes: null,
          blocked_at: null,
          blocked_by: null,
          updated_at: new Date().toISOString()
        })
        .eq('sim_id', simId)
        .select('*')
        .single();

      if (updateError) throw updateError;

      await logSimStateChange(this.pool, {
        simId,
        iccid: sim.iccid,
        action: 'UNBLOCK',
        previousStatus: 'BLOCKED',
        newStatus,
        reason: data.reason,
        notes: data.notes,
        initiatedBy: 'API',
        clientId: context.clientId,
        correlationId: data.correlationId,
        requestId: context.requestId,
        ipAddress: context.ipAddress
      });

      return {
        success: true,
        data: toSimResponse(updatedData as unknown as DbProvisionedSim),
        emitWebhook: data.notifyProvisioning !== false
      };
    }

    // Fall back to pg pool
    const current = await this.pool.query<DbProvisionedSim>(
      `SELECT * FROM ${SCHEMA}provisioned_sims WHERE sim_id = $1`,
      [simId]
    );

    if (current.rows.length === 0) {
      return { success: false, error: 'SIM_NOT_FOUND', message: `SIM ${simId} not found` };
    }

    const sim = current.rows[0];

    if (sim.status !== 'BLOCKED') {
      return {
        success: false,
        error: 'INVALID_STATE_TRANSITION',
        message: 'SIM is not blocked'
      };
    }

    // Return to previous status (default to INACTIVE if not set)
    const newStatus = sim.previous_status || 'INACTIVE';

    const result = await this.pool.query<DbProvisionedSim>(
      `UPDATE ${SCHEMA}provisioned_sims
       SET status = $2, previous_status = NULL, block_reason = NULL, block_notes = NULL,
           blocked_at = NULL, blocked_by = NULL, updated_at = NOW()
       WHERE sim_id = $1
       RETURNING *`,
      [simId, newStatus]
    );

    await logSimStateChange(this.pool, {
      simId,
      iccid: sim.iccid,
      action: 'UNBLOCK',
      previousStatus: 'BLOCKED',
      newStatus,
      reason: data.reason,
      notes: data.notes,
      initiatedBy: 'API',
      clientId: context.clientId,
      correlationId: data.correlationId,
      requestId: context.requestId,
      ipAddress: context.ipAddress
    });

    return {
      success: true,
      data: toSimResponse(result.rows[0]),
      emitWebhook: data.notifyProvisioning !== false
    };
  }
}
