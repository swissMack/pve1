/**
 * Usage Service - Handles mediation data ingestion and usage tracking
 */

import type { Pool } from 'pg';
import type {
  UsageRecord,
  UsageBatchRequest,
  UsageResetRequest,
  UsageAcceptedResponse,
  UsageBatchResponse,
  UsageResetResponse,
  SimUsageResponse,
  DbUsageRecord,
  DbUsageCycle,
  ErrorCode
} from '../types/provisioning.types.js';
import { formatBytes } from './sim.service.js';
import { getSchemaPrefix, shouldUseSupabase } from '../../lib/db.js';
import { supabase } from '../../lib/supabase.js';

// Get schema prefix based on environment (empty for Supabase, ${SCHEMA} for local)
const SCHEMA = getSchemaPrefix();

export class UsageService {
  constructor(private pool: Pool) {}

  /**
   * Submit a single usage record
   */
  async submitUsageRecord(
    data: UsageRecord
  ): Promise<{ success: true; data: UsageAcceptedResponse } | { success: false; error: ErrorCode; message: string }> {
    try {
      // Use Supabase if configured
      if (shouldUseSupabase() && supabase) {
        // Check for duplicate record
        const { data: existingData } = await supabase
          .from('usage_records')
          .select('id, processed_at')
          .eq('record_id', data.recordId)
          .single();

        if (existingData) {
          return {
            success: true,
            data: {
              recordId: data.recordId,
              status: 'DUPLICATE',
              processedAt: existingData.processed_at
            }
          };
        }

        // Get SIM by ICCID
        const { data: simData } = await supabase
          .from('provisioned_sims')
          .select('sim_id')
          .eq('iccid', data.iccid)
          .single();

        const simId = simData?.sim_id || null;

        // Insert usage record
        const { data: insertedData, error: insertError } = await supabase
          .from('usage_records')
          .insert({
            record_id: data.recordId,
            iccid: data.iccid,
            sim_id: simId,
            period_start: data.periodStart,
            period_end: data.periodEnd,
            data_upload_bytes: data.usage.dataUploadBytes || 0,
            data_download_bytes: data.usage.dataDownloadBytes || 0,
            total_bytes: data.usage.totalBytes,
            sms_count: data.usage.smsCount || 0,
            voice_seconds: data.usage.voiceSeconds || 0,
            source: data.source || null,
            status: 'PROCESSED'
          })
          .select('processed_at')
          .single();

        if (insertError) throw insertError;

        // Accumulate to current cycle if SIM exists
        if (simId) {
          await this.accumulateUsage(simId, data.iccid, data.usage);
        }

        return {
          success: true,
          data: {
            recordId: data.recordId,
            status: 'ACCEPTED',
            processedAt: insertedData?.processed_at || new Date().toISOString()
          }
        };
      }

      // Fall back to pg pool
      // Check for duplicate record
      const existing = await this.pool.query(
        `SELECT id, processed_at FROM ${SCHEMA}usage_records WHERE record_id = $1`,
        [data.recordId]
      );

      if (existing.rows.length > 0) {
        // Return duplicate status (not an error per spec)
        return {
          success: true,
          data: {
            recordId: data.recordId,
            status: 'DUPLICATE',
            processedAt: existing.rows[0].processed_at
          }
        };
      }

      // Get SIM by ICCID
      const simResult = await this.pool.query<{ sim_id: string }>(
        `SELECT sim_id FROM ${SCHEMA}provisioned_sims WHERE iccid = $1`,
        [data.iccid]
      );

      const simId = simResult.rows[0]?.sim_id || null;

      // Insert usage record
      const result = await this.pool.query<{ processed_at: string }>(`
        INSERT INTO ${SCHEMA}usage_records
        (record_id, iccid, sim_id, period_start, period_end,
         data_upload_bytes, data_download_bytes, total_bytes, sms_count, voice_seconds,
         source, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PROCESSED')
        RETURNING processed_at
      `, [
        data.recordId,
        data.iccid,
        simId,
        data.periodStart,
        data.periodEnd,
        data.usage.dataUploadBytes || 0,
        data.usage.dataDownloadBytes || 0,
        data.usage.totalBytes,
        data.usage.smsCount || 0,
        data.usage.voiceSeconds || 0,
        data.source || null
      ]);

      // Accumulate to current cycle if SIM exists
      if (simId) {
        await this.accumulateUsage(simId, data.iccid, data.usage);
      }

      return {
        success: true,
        data: {
          recordId: data.recordId,
          status: 'ACCEPTED',
          processedAt: result.rows[0].processed_at
        }
      };
    } catch (error) {
      console.error('Error submitting usage record:', error);
      throw error;
    }
  }

  /**
   * Submit a batch of usage records
   */
  async submitUsageBatch(
    data: UsageBatchRequest
  ): Promise<UsageBatchResponse> {
    const processedAt = new Date().toISOString();
    let recordsProcessed = 0;
    let recordsFailed = 0;
    const errors: Array<{ recordId: string; error: string }> = [];

    for (const record of data.records) {
      try {
        // Use Supabase if configured
        if (shouldUseSupabase() && supabase) {
          // Check for duplicate
          const { data: existingData } = await supabase
            .from('usage_records')
            .select('id')
            .eq('record_id', record.recordId)
            .single();

          if (existingData) {
            // Duplicate - count as processed (idempotent)
            recordsProcessed++;
            continue;
          }

          // Get SIM by ICCID
          const { data: simData } = await supabase
            .from('provisioned_sims')
            .select('sim_id')
            .eq('iccid', record.iccid)
            .single();

          const simId = simData?.sim_id || null;

          // Insert record
          await supabase
            .from('usage_records')
            .insert({
              record_id: record.recordId,
              iccid: record.iccid,
              sim_id: simId,
              period_start: record.periodStart,
              period_end: record.periodEnd,
              data_upload_bytes: record.usage.dataUploadBytes || 0,
              data_download_bytes: record.usage.dataDownloadBytes || 0,
              total_bytes: record.usage.totalBytes,
              sms_count: record.usage.smsCount || 0,
              voice_seconds: record.usage.voiceSeconds || 0,
              source: record.source || data.source || null,
              batch_id: data.batchId,
              status: 'PROCESSED'
            });

          // Accumulate to current cycle if SIM exists
          if (simId) {
            await this.accumulateUsage(simId, record.iccid, record.usage);
          }

          recordsProcessed++;
        } else {
          // Fall back to pg pool
          // Check for duplicate
          const existing = await this.pool.query(
            `SELECT id FROM ${SCHEMA}usage_records WHERE record_id = $1`,
            [record.recordId]
          );

          if (existing.rows.length > 0) {
            // Duplicate - count as processed (idempotent)
            recordsProcessed++;
            continue;
          }

          // Get SIM by ICCID
          const simResult = await this.pool.query<{ sim_id: string }>(
            `SELECT sim_id FROM ${SCHEMA}provisioned_sims WHERE iccid = $1`,
            [record.iccid]
          );

          const simId = simResult.rows[0]?.sim_id || null;

          // Insert record
          await this.pool.query(`
            INSERT INTO ${SCHEMA}usage_records
            (record_id, iccid, sim_id, period_start, period_end,
             data_upload_bytes, data_download_bytes, total_bytes, sms_count, voice_seconds,
             source, batch_id, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'PROCESSED')
          `, [
            record.recordId,
            record.iccid,
            simId,
            record.periodStart,
            record.periodEnd,
            record.usage.dataUploadBytes || 0,
            record.usage.dataDownloadBytes || 0,
            record.usage.totalBytes,
            record.usage.smsCount || 0,
            record.usage.voiceSeconds || 0,
            record.source || data.source || null,
            data.batchId
          ]);

          // Accumulate to current cycle if SIM exists
          if (simId) {
            await this.accumulateUsage(simId, record.iccid, record.usage);
          }

          recordsProcessed++;
        }
      } catch (error: any) {
        recordsFailed++;
        errors.push({
          recordId: record.recordId,
          error: error.message || 'Processing failed'
        });

        // Continue processing other records
        if (errors.length >= 100) {
          // Limit error collection
          break;
        }
      }
    }

    return {
      batchId: data.batchId,
      recordsReceived: data.records.length,
      recordsProcessed,
      recordsFailed,
      errors: errors.length > 0 ? errors : undefined,
      processedAt
    };
  }

  /**
   * Accumulate usage to current billing cycle
   */
  private async accumulateUsage(
    simId: string,
    iccid: string,
    usage: { dataUploadBytes?: number; dataDownloadBytes?: number; totalBytes: number; smsCount?: number; voiceSeconds?: number }
  ): Promise<void> {
    // Use Supabase if configured
    if (shouldUseSupabase() && supabase) {
      // Try to get current cycle
      const { data: currentCycle } = await supabase
        .from('usage_cycles')
        .select('id, total_upload_bytes, total_download_bytes, total_bytes, sms_count, voice_seconds')
        .eq('sim_id', simId)
        .eq('is_current', true)
        .single();

      if (currentCycle) {
        // Update existing cycle
        await supabase
          .from('usage_cycles')
          .update({
            total_upload_bytes: (currentCycle.total_upload_bytes || 0) + (usage.dataUploadBytes || 0),
            total_download_bytes: (currentCycle.total_download_bytes || 0) + (usage.dataDownloadBytes || 0),
            total_bytes: (currentCycle.total_bytes || 0) + usage.totalBytes,
            sms_count: (currentCycle.sms_count || 0) + (usage.smsCount || 0),
            voice_seconds: (currentCycle.voice_seconds || 0) + (usage.voiceSeconds || 0),
            last_updated: new Date().toISOString()
          })
          .eq('id', currentCycle.id);
      } else {
        // Create new cycle
        const now = new Date();
        const cycleId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        await supabase
          .from('usage_cycles')
          .upsert({
            sim_id: simId,
            iccid: iccid,
            cycle_id: cycleId,
            cycle_start: cycleStart.toISOString(),
            cycle_end: cycleEnd.toISOString(),
            total_upload_bytes: usage.dataUploadBytes || 0,
            total_download_bytes: usage.dataDownloadBytes || 0,
            total_bytes: usage.totalBytes,
            sms_count: usage.smsCount || 0,
            voice_seconds: usage.voiceSeconds || 0,
            is_current: true
          }, { onConflict: 'sim_id,cycle_id' });
      }
      return;
    }

    // Fall back to pg pool
    // Try to update existing current cycle
    const result = await this.pool.query(`
      UPDATE ${SCHEMA}usage_cycles
      SET
        total_upload_bytes = total_upload_bytes + $2,
        total_download_bytes = total_download_bytes + $3,
        total_bytes = total_bytes + $4,
        sms_count = sms_count + $5,
        voice_seconds = voice_seconds + $6,
        last_updated = NOW()
      WHERE sim_id = $1 AND is_current = true
      RETURNING id
    `, [
      simId,
      usage.dataUploadBytes || 0,
      usage.dataDownloadBytes || 0,
      usage.totalBytes,
      usage.smsCount || 0,
      usage.voiceSeconds || 0
    ]);

    // If no current cycle exists, create one
    if (result.rowCount === 0) {
      const now = new Date();
      const cycleId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      await this.pool.query(`
        INSERT INTO ${SCHEMA}usage_cycles
        (sim_id, iccid, cycle_id, cycle_start, cycle_end,
         total_upload_bytes, total_download_bytes, total_bytes, sms_count, voice_seconds,
         is_current)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
        ON CONFLICT (sim_id, cycle_id) DO UPDATE SET
          total_upload_bytes = usage_cycles.total_upload_bytes + $6,
          total_download_bytes = usage_cycles.total_download_bytes + $7,
          total_bytes = usage_cycles.total_bytes + $8,
          sms_count = usage_cycles.sms_count + $9,
          voice_seconds = usage_cycles.voice_seconds + $10,
          last_updated = NOW()
      `, [
        simId,
        iccid,
        cycleId,
        cycleStart.toISOString(),
        cycleEnd.toISOString(),
        usage.dataUploadBytes || 0,
        usage.dataDownloadBytes || 0,
        usage.totalBytes,
        usage.smsCount || 0,
        usage.voiceSeconds || 0
      ]);
    }
  }

  /**
   * Reset billing cycle
   */
  async resetBillingCycle(
    data: UsageResetRequest
  ): Promise<{ success: true; data: UsageResetResponse } | { success: false; error: ErrorCode; message: string }> {
    // Use Supabase if configured
    if (shouldUseSupabase() && supabase) {
      // Get SIM by ICCID
      const { data: simData, error: simError } = await supabase
        .from('provisioned_sims')
        .select('sim_id')
        .eq('iccid', data.iccid)
        .single();

      if (simError || !simData) {
        return {
          success: false,
          error: 'SIM_NOT_FOUND',
          message: `SIM with ICCID ${data.iccid} not found`
        };
      }

      const simId = simData.sim_id;

      // Get current cycle data for archiving
      const { data: currentCycleData } = await supabase
        .from('usage_cycles')
        .select('*')
        .eq('sim_id', simId)
        .eq('is_current', true)
        .single();

      let previousCycleData: UsageResetResponse['previousCycle'] | undefined;

      if (currentCycleData) {
        const cycle = currentCycleData as any;

        // Archive current cycle
        const finalUsage = data.finalUsage || {
          dataUploadBytes: cycle.total_upload_bytes,
          dataDownloadBytes: cycle.total_download_bytes,
          totalBytes: cycle.total_bytes,
          smsCount: cycle.sms_count,
          voiceSeconds: cycle.voice_seconds
        };

        await (supabase as any)
          .from('usage_cycles')
          .update({
            is_current: false,
            archived_at: new Date().toISOString(),
            final_usage: finalUsage
          })
          .eq('id', cycle.id);

        previousCycleData = {
          id: cycle.cycle_id,
          archivedUsage: finalUsage
        };
      }

      // Create new cycle
      await supabase
        .from('usage_cycles')
        .upsert({
          sim_id: simId,
          iccid: data.iccid,
          cycle_id: data.billingCycleId,
          cycle_start: data.cycleStart,
          cycle_end: data.cycleEnd,
          is_current: true,
          total_upload_bytes: 0,
          total_download_bytes: 0,
          total_bytes: 0,
          sms_count: 0,
          voice_seconds: 0,
          archived_at: null,
          final_usage: null
        }, { onConflict: 'sim_id,cycle_id' });

      return {
        success: true,
        data: {
          iccid: data.iccid,
          previousCycle: previousCycleData,
          newCycle: {
            id: data.billingCycleId,
            start: data.cycleStart,
            end: data.cycleEnd
          }
        }
      };
    }

    // Fall back to pg pool
    // Get SIM by ICCID
    const simResult = await this.pool.query<{ sim_id: string }>(
      `SELECT sim_id FROM ${SCHEMA}provisioned_sims WHERE iccid = $1`,
      [data.iccid]
    );

    if (simResult.rows.length === 0) {
      return {
        success: false,
        error: 'SIM_NOT_FOUND',
        message: `SIM with ICCID ${data.iccid} not found`
      };
    }

    const simId = simResult.rows[0].sim_id;

    // Get current cycle data for archiving
    const currentCycle = await this.pool.query<DbUsageCycle>(`
      SELECT * FROM ${SCHEMA}usage_cycles
      WHERE sim_id = $1 AND is_current = true
    `, [simId]);

    let previousCycleData: UsageResetResponse['previousCycle'] | undefined;

    if (currentCycle.rows.length > 0) {
      const cycle = currentCycle.rows[0];

      // Archive current cycle
      const finalUsage = data.finalUsage || {
        dataUploadBytes: cycle.total_upload_bytes,
        dataDownloadBytes: cycle.total_download_bytes,
        totalBytes: cycle.total_bytes,
        smsCount: cycle.sms_count,
        voiceSeconds: cycle.voice_seconds
      };

      await this.pool.query(`
        UPDATE ${SCHEMA}usage_cycles
        SET is_current = false, archived_at = NOW(), final_usage = $2
        WHERE id = $1
      `, [cycle.id, JSON.stringify(finalUsage)]);

      previousCycleData = {
        id: cycle.cycle_id,
        archivedUsage: finalUsage
      };
    }

    // Create new cycle
    await this.pool.query(`
      INSERT INTO ${SCHEMA}usage_cycles
      (sim_id, iccid, cycle_id, cycle_start, cycle_end, is_current)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (sim_id, cycle_id) DO UPDATE SET
        is_current = true,
        cycle_start = $4,
        cycle_end = $5,
        total_upload_bytes = 0,
        total_download_bytes = 0,
        total_bytes = 0,
        sms_count = 0,
        voice_seconds = 0,
        archived_at = NULL,
        final_usage = NULL,
        last_updated = NOW()
    `, [simId, data.iccid, data.billingCycleId, data.cycleStart, data.cycleEnd]);

    return {
      success: true,
      data: {
        iccid: data.iccid,
        previousCycle: previousCycleData,
        newCycle: {
          id: data.billingCycleId,
          start: data.cycleStart,
          end: data.cycleEnd
        }
      }
    };
  }

  /**
   * Get usage for a SIM
   */
  async getSimUsage(
    simId: string,
    cycle: string = 'current'
  ): Promise<{ success: true; data: SimUsageResponse } | { success: false; error: ErrorCode; message: string }> {
    // Use Supabase if configured
    if (shouldUseSupabase() && supabase) {
      // Get SIM details
      const { data: simData, error: simError } = await supabase
        .from('provisioned_sims')
        .select('sim_id, iccid, data_limit_bytes')
        .eq('sim_id', simId)
        .single();

      if (simError || !simData) {
        return {
          success: false,
          error: 'SIM_NOT_FOUND',
          message: `SIM ${simId} not found`
        };
      }

      const sim = simData as any;

      // Get usage cycle
      let cycleQuery = supabase
        .from('usage_cycles')
        .select('*')
        .eq('sim_id', simId);

      if (cycle === 'current') {
        cycleQuery = cycleQuery.eq('is_current', true);
      } else {
        cycleQuery = cycleQuery.eq('cycle_id', cycle);
      }

      const { data: cycleData } = await cycleQuery.single();

      if (!cycleData) {
        // Return empty usage for non-existent cycle
        const now = new Date();
        const cycleId = cycle === 'current'
          ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
          : cycle;

        return {
          success: true,
          data: {
            simId,
            iccid: sim.iccid,
            billingCycle: {
              id: cycleId,
              start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
              end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
            },
            usage: {
              dataUploadBytes: 0,
              dataDownloadBytes: 0,
              totalBytes: 0,
              totalFormatted: '0 B',
              percentOfLimit: 0
            },
            limit: {
              totalBytes: sim.data_limit_bytes || 0,
              totalFormatted: formatBytes(sim.data_limit_bytes || 0)
            },
            lastUpdated: now.toISOString()
          }
        };
      }

      const usageCycle = cycleData as any;
      const dataLimit = Number(sim.data_limit_bytes) || 0;
      const totalBytes = Number(usageCycle.total_bytes) || 0;
      const totalUploadBytes = Number(usageCycle.total_upload_bytes) || 0;
      const totalDownloadBytes = Number(usageCycle.total_download_bytes) || 0;
      const percentOfLimit = dataLimit > 0
        ? Math.round((totalBytes / dataLimit) * 10000) / 100
        : 0;

      return {
        success: true,
        data: {
          simId,
          iccid: sim.iccid,
          billingCycle: {
            id: usageCycle.cycle_id,
            start: usageCycle.cycle_start,
            end: usageCycle.cycle_end
          },
          usage: {
            dataUploadBytes: totalUploadBytes,
            dataDownloadBytes: totalDownloadBytes,
            totalBytes: totalBytes,
            totalFormatted: formatBytes(totalBytes),
            percentOfLimit
          },
          limit: {
            totalBytes: dataLimit,
            totalFormatted: formatBytes(dataLimit)
          },
          lastUpdated: usageCycle.last_updated
        }
      };
    }

    // Fall back to pg pool
    // Get SIM details
    const simResult = await this.pool.query<{ sim_id: string; iccid: string; data_limit_bytes: number | null }>(
      `SELECT sim_id, iccid, data_limit_bytes FROM ${SCHEMA}provisioned_sims WHERE sim_id = $1`,
      [simId]
    );

    if (simResult.rows.length === 0) {
      return {
        success: false,
        error: 'SIM_NOT_FOUND',
        message: `SIM ${simId} not found`
      };
    }

    const sim = simResult.rows[0];

    // Build cycle query
    let cycleQuery: string;
    let cycleParams: any[];

    if (cycle === 'current') {
      cycleQuery = `SELECT * FROM ${SCHEMA}usage_cycles WHERE sim_id = $1 AND is_current = true`;
      cycleParams = [simId];
    } else {
      cycleQuery = `SELECT * FROM ${SCHEMA}usage_cycles WHERE sim_id = $1 AND cycle_id = $2`;
      cycleParams = [simId, cycle];
    }

    const cycleResult = await this.pool.query<DbUsageCycle>(cycleQuery, cycleParams);

    if (cycleResult.rows.length === 0) {
      // Return empty usage for non-existent cycle
      const now = new Date();
      const cycleId = cycle === 'current'
        ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        : cycle;

      return {
        success: true,
        data: {
          simId,
          iccid: sim.iccid,
          billingCycle: {
            id: cycleId,
            start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
            end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
          },
          usage: {
            dataUploadBytes: 0,
            dataDownloadBytes: 0,
            totalBytes: 0,
            totalFormatted: '0 B',
            percentOfLimit: 0
          },
          limit: {
            totalBytes: sim.data_limit_bytes || 0,
            totalFormatted: formatBytes(sim.data_limit_bytes || 0)
          },
          lastUpdated: now.toISOString()
        }
      };
    }

    const usageCycle = cycleResult.rows[0];
    const dataLimit = Number(sim.data_limit_bytes) || 0;
    const totalBytes = Number(usageCycle.total_bytes) || 0;
    const totalUploadBytes = Number(usageCycle.total_upload_bytes) || 0;
    const totalDownloadBytes = Number(usageCycle.total_download_bytes) || 0;
    const percentOfLimit = dataLimit > 0
      ? Math.round((totalBytes / dataLimit) * 10000) / 100
      : 0;

    return {
      success: true,
      data: {
        simId,
        iccid: sim.iccid,
        billingCycle: {
          id: usageCycle.cycle_id,
          start: usageCycle.cycle_start,
          end: usageCycle.cycle_end
        },
        usage: {
          dataUploadBytes: totalUploadBytes,
          dataDownloadBytes: totalDownloadBytes,
          totalBytes: totalBytes,
          totalFormatted: formatBytes(totalBytes),
          percentOfLimit
        },
        limit: {
          totalBytes: dataLimit,
          totalFormatted: formatBytes(dataLimit)
        },
        lastUpdated: usageCycle.last_updated
      }
    };
  }

  /**
   * Get usage history for a SIM (all cycles)
   */
  async getUsageHistory(
    simId: string,
    limitNum: number = 12
  ): Promise<Array<{
    cycleId: string;
    start: string;
    end: string;
    totalBytes: number;
    totalFormatted: string;
    isCurrent: boolean;
  }>> {
    // Use Supabase if configured
    if (shouldUseSupabase() && supabase) {
      const { data, error } = await supabase
        .from('usage_cycles')
        .select('*')
        .eq('sim_id', simId)
        .order('cycle_start', { ascending: false })
        .limit(limitNum);

      if (error || !data) return [];

      return (data as any[]).map(cycle => ({
        cycleId: cycle.cycle_id,
        start: cycle.cycle_start,
        end: cycle.cycle_end,
        totalBytes: cycle.total_bytes,
        totalFormatted: formatBytes(cycle.total_bytes),
        isCurrent: cycle.is_current
      }));
    }

    // Fall back to pg pool
    const result = await this.pool.query<DbUsageCycle>(`
      SELECT * FROM ${SCHEMA}usage_cycles
      WHERE sim_id = $1
      ORDER BY cycle_start DESC
      LIMIT $2
    `, [simId, limitNum]);

    return result.rows.map(cycle => ({
      cycleId: cycle.cycle_id,
      start: cycle.cycle_start,
      end: cycle.cycle_end,
      totalBytes: cycle.total_bytes,
      totalFormatted: formatBytes(cycle.total_bytes),
      isCurrent: cycle.is_current
    }));
  }
}
