/**
 * Provisioning API v1 Router
 * Main router that wires up all endpoints
 */

import { Router, Request, Response } from 'express';
import type { Pool } from 'pg';

// Supabase client
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

// Middleware
import { createAuthMiddleware, requirePermission } from './middleware/auth.js';
import { validate, validateSimId, validateWebhookId } from './middleware/validator.js';
import { createRateLimiter } from './middleware/rate-limiter.js';
import { createAuditLogger } from './middleware/audit-logger.js';

// Services
import { SimService } from './services/sim.service.js';
import { WebhookService } from './services/webhook.service.js';
import { UsageService } from './services/usage.service.js';
import { ApiClientService } from './services/api-client.service.js';

// Types
import type {
  CreateSimRequest,
  UpdateSimRequest,
  ActionRequest,
  BlockRequest,
  WebhookRegistration,
  UsageRecord,
  UsageBatchRequest,
  UsageResetRequest,
  SimSearchParams,
  ErrorResponse
} from './types/provisioning.types.js';

/**
 * Create the v1 API router
 */
export function createV1Router(pool: Pool): Router {
  const router = Router();

  // Initialize services
  const simService = new SimService(pool);
  const webhookService = new WebhookService(pool);
  const usageService = new UsageService(pool);
  const apiClientService = new ApiClientService(pool);

  // Initialize middleware
  const authenticate = createAuthMiddleware(pool);
  const rateLimiter = createRateLimiter(pool);
  const auditLogger = createAuditLogger(pool);

  // Apply global middleware
  router.use(auditLogger);

  // ============================================================================
  // HEALTH CHECK (no auth required)
  // ============================================================================

  router.get('/health', async (req: Request, res: Response) => {
    try {
      // Use Supabase when configured, fall back to pool
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase.from('provisioned_sims').select('sim_id').limit(1);
        if (error) throw error;
      } else {
        await pool.query('SELECT 1');
      }
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: 'unhealthy', timestamp: new Date().toISOString() });
    }
  });

  // ============================================================================
  // PROVISIONING ENDPOINTS
  // ============================================================================

  // Create SIM
  router.post('/sims',
    authenticate,
    requirePermission('provisioning:write'),
    rateLimiter('provisioning_write'),
    validate('createSim'),
    async (req: Request, res: Response) => {
      const data: CreateSimRequest = req.body;
      const context = {
        clientId: req.auth!.clientId,
        requestId: req.auth!.requestId,
        ipAddress: req.ip
      };

      const result = await simService.createSim(data, context);

      if (result.success) {
        // Emit webhook if activated immediately
        if (data.activateImmediately) {
          const sim = await simService.getSimById(result.data.simId);
          if (sim) {
            webhookService.emitEvent(
              'SIM_ACTIVATED',
              { simId: sim.simId, iccid: sim.iccid, imsi: sim.imsi, msisdn: sim.msisdn },
              'PROVISIONED',
              'ACTIVE',
              'API'
            ).catch(err => console.error('Webhook emit error:', err));
          }
        }

        res.status(201).json(result.data);
      } else {
        const errorResponse: ErrorResponse = {
          error: {
            code: result.error,
            message: result.message,
            requestId: req.auth!.requestId
          }
        };
        const statusCode = result.error === 'DUPLICATE_ICCID' ? 409 : 400;
        res.status(statusCode).json(errorResponse);
      }
    }
  );

  // Search SIMs
  router.get('/sims',
    authenticate,
    requirePermission('provisioning:read'),
    rateLimiter('provisioning_read'),
    async (req: Request, res: Response) => {
      const params: SimSearchParams = {
        iccid: req.query.iccid as string | undefined,
        msisdn: req.query.msisdn as string | undefined,
        status: req.query.status as any,
        customerId: req.query.customerId as string | undefined,
        billingAccountId: req.query.billingAccountId as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined
      };

      const result = await simService.searchSims(params);
      res.json(result);
    }
  );

  // Get SIM by ID
  router.get('/sims/:simId',
    authenticate,
    requirePermission('provisioning:read'),
    rateLimiter('provisioning_read'),
    validateSimId,
    async (req: Request, res: Response) => {
      const sim = await simService.getSimById(req.params.simId);

      if (!sim) {
        const errorResponse: ErrorResponse = {
          error: {
            code: 'SIM_NOT_FOUND',
            message: `SIM ${req.params.simId} not found`,
            requestId: req.auth!.requestId
          }
        };
        res.status(404).json(errorResponse);
        return;
      }

      res.json(sim);
    }
  );

  // Update SIM
  router.patch('/sims/:simId',
    authenticate,
    requirePermission('provisioning:write'),
    rateLimiter('provisioning_write'),
    validateSimId,
    validate('updateSim'),
    async (req: Request, res: Response) => {
      const data: UpdateSimRequest = req.body;
      const context = {
        clientId: req.auth!.clientId,
        requestId: req.auth!.requestId,
        ipAddress: req.ip
      };

      const result = await simService.updateSim(req.params.simId, data, context);

      if (result.success) {
        res.json(result.data);
      } else {
        const errorResponse: ErrorResponse = {
          error: {
            code: result.error,
            message: result.message,
            requestId: req.auth!.requestId
          }
        };
        const statusCode = result.error === 'SIM_NOT_FOUND' ? 404 : 400;
        res.status(statusCode).json(errorResponse);
      }
    }
  );

  // Activate SIM
  router.post('/sims/:simId/activate',
    authenticate,
    requirePermission('provisioning:write'),
    rateLimiter('provisioning_write'),
    validateSimId,
    validate('actionRequest'),
    async (req: Request, res: Response) => {
      const data: ActionRequest = req.body || {};
      const context = {
        clientId: req.auth!.clientId,
        requestId: req.auth!.requestId,
        ipAddress: req.ip
      };

      const result = await simService.activateSim(req.params.simId, data, context);

      if (result.success) {
        // Emit webhook
        if (result.emitWebhook) {
          const sim = await simService.getSimById(req.params.simId);
          if (sim) {
            webhookService.emitEvent(
              'SIM_ACTIVATED',
              { simId: sim.simId, iccid: sim.iccid, imsi: sim.imsi, msisdn: sim.msisdn },
              'PROVISIONED', // Could be INACTIVE too
              'ACTIVE',
              'API',
              data.reason,
              data.correlationId
            ).catch(err => console.error('Webhook emit error:', err));
          }
        }

        res.json(result.data);
      } else {
        const errorResponse: ErrorResponse = {
          error: {
            code: result.error,
            message: result.message,
            requestId: req.auth!.requestId
          }
        };
        const statusCode = result.error === 'SIM_NOT_FOUND' ? 404 : 409;
        res.status(statusCode).json(errorResponse);
      }
    }
  );

  // Deactivate SIM
  router.post('/sims/:simId/deactivate',
    authenticate,
    requirePermission('provisioning:write'),
    rateLimiter('provisioning_write'),
    validateSimId,
    validate('actionRequest'),
    async (req: Request, res: Response) => {
      const data: ActionRequest = req.body || {};
      const context = {
        clientId: req.auth!.clientId,
        requestId: req.auth!.requestId,
        ipAddress: req.ip
      };

      const result = await simService.deactivateSim(req.params.simId, data, context);

      if (result.success) {
        if (result.emitWebhook) {
          const sim = await simService.getSimById(req.params.simId);
          if (sim) {
            webhookService.emitEvent(
              'SIM_DEACTIVATED',
              { simId: sim.simId, iccid: sim.iccid, imsi: sim.imsi, msisdn: sim.msisdn },
              'ACTIVE',
              'INACTIVE',
              'API',
              data.reason,
              data.correlationId
            ).catch(err => console.error('Webhook emit error:', err));
          }
        }

        res.json(result.data);
      } else {
        const errorResponse: ErrorResponse = {
          error: {
            code: result.error,
            message: result.message,
            requestId: req.auth!.requestId
          }
        };
        const statusCode = result.error === 'SIM_NOT_FOUND' ? 404 : 409;
        res.status(statusCode).json(errorResponse);
      }
    }
  );

  // Block SIM
  router.post('/sims/:simId/block',
    authenticate,
    requirePermission('provisioning:write'),
    rateLimiter('provisioning_write'),
    validateSimId,
    validate('blockRequest'),
    async (req: Request, res: Response) => {
      const data: BlockRequest = req.body;
      const context = {
        clientId: req.auth!.clientId,
        requestId: req.auth!.requestId,
        ipAddress: req.ip
      };

      const result = await simService.blockSim(req.params.simId, data, context);

      if (result.success) {
        if (result.emitWebhook) {
          const sim = await simService.getSimById(req.params.simId);
          if (sim) {
            webhookService.emitEvent(
              'SIM_BLOCKED',
              { simId: sim.simId, iccid: sim.iccid, imsi: sim.imsi, msisdn: sim.msisdn },
              'ACTIVE', // Could be INACTIVE too
              'BLOCKED',
              'API',
              data.reason,
              data.correlationId
            ).catch(err => console.error('Webhook emit error:', err));
          }
        }

        res.json(result.data);
      } else {
        const errorResponse: ErrorResponse = {
          error: {
            code: result.error,
            message: result.message,
            requestId: req.auth!.requestId
          }
        };
        const statusCode = result.error === 'SIM_NOT_FOUND' ? 404 : 409;
        res.status(statusCode).json(errorResponse);
      }
    }
  );

  // Unblock SIM
  router.post('/sims/:simId/unblock',
    authenticate,
    requirePermission('provisioning:write'),
    rateLimiter('provisioning_write'),
    validateSimId,
    validate('blockRequest'),
    async (req: Request, res: Response) => {
      const data: BlockRequest = req.body;
      const context = {
        clientId: req.auth!.clientId,
        requestId: req.auth!.requestId,
        ipAddress: req.ip
      };

      const result = await simService.unblockSim(req.params.simId, data, context);

      if (result.success) {
        if (result.emitWebhook) {
          const sim = await simService.getSimById(req.params.simId);
          if (sim) {
            webhookService.emitEvent(
              'SIM_UNBLOCKED',
              { simId: sim.simId, iccid: sim.iccid, imsi: sim.imsi, msisdn: sim.msisdn },
              'BLOCKED',
              sim.status,
              'API',
              data.reason,
              data.correlationId
            ).catch(err => console.error('Webhook emit error:', err));
          }
        }

        res.json(result.data);
      } else {
        const errorResponse: ErrorResponse = {
          error: {
            code: result.error,
            message: result.message,
            requestId: req.auth!.requestId
          }
        };
        const statusCode = result.error === 'SIM_NOT_FOUND' ? 404 : 409;
        res.status(statusCode).json(errorResponse);
      }
    }
  );

  // Get SIM usage
  router.get('/sims/:simId/usage',
    authenticate,
    requirePermission('usage:read'),
    rateLimiter('provisioning_read'),
    validateSimId,
    async (req: Request, res: Response) => {
      const cycle = (req.query.cycle as string) || 'current';
      const result = await usageService.getSimUsage(req.params.simId, cycle);

      if (result.success) {
        res.json(result.data);
      } else {
        const errorResponse: ErrorResponse = {
          error: {
            code: result.error,
            message: result.message,
            requestId: req.auth!.requestId
          }
        };
        res.status(404).json(errorResponse);
      }
    }
  );

  // ============================================================================
  // WEBHOOK ENDPOINTS
  // ============================================================================

  // Register webhook
  router.post('/webhooks',
    authenticate,
    requirePermission('webhooks:write'),
    rateLimiter('provisioning_write'),
    validate('webhook'),
    async (req: Request, res: Response) => {
      const data: WebhookRegistration = req.body;
      const result = await webhookService.registerWebhook(data, req.auth!.clientId);

      if (result.success) {
        res.status(201).json(result.data);
      } else {
        const errorResponse: ErrorResponse = {
          error: {
            code: result.error,
            message: result.message,
            requestId: req.auth!.requestId
          }
        };
        res.status(400).json(errorResponse);
      }
    }
  );

  // List webhooks
  router.get('/webhooks',
    authenticate,
    requirePermission('webhooks:read'),
    rateLimiter('provisioning_read'),
    async (req: Request, res: Response) => {
      const webhooks = await webhookService.listWebhooks(req.auth!.clientId);
      res.json({ data: webhooks });
    }
  );

  // Get webhook
  router.get('/webhooks/:webhookId',
    authenticate,
    requirePermission('webhooks:read'),
    rateLimiter('provisioning_read'),
    validateWebhookId,
    async (req: Request, res: Response) => {
      const webhook = await webhookService.getWebhook(req.params.webhookId, req.auth!.clientId);

      if (!webhook) {
        const errorResponse: ErrorResponse = {
          error: {
            code: 'WEBHOOK_NOT_FOUND',
            message: `Webhook ${req.params.webhookId} not found`,
            requestId: req.auth!.requestId
          }
        };
        res.status(404).json(errorResponse);
        return;
      }

      res.json(webhook);
    }
  );

  // Delete webhook
  router.delete('/webhooks/:webhookId',
    authenticate,
    requirePermission('webhooks:write'),
    rateLimiter('provisioning_write'),
    validateWebhookId,
    async (req: Request, res: Response) => {
      const deleted = await webhookService.deleteWebhook(req.params.webhookId, req.auth!.clientId);

      if (deleted) {
        res.status(204).send();
      } else {
        const errorResponse: ErrorResponse = {
          error: {
            code: 'WEBHOOK_NOT_FOUND',
            message: `Webhook ${req.params.webhookId} not found`,
            requestId: req.auth!.requestId
          }
        };
        res.status(404).json(errorResponse);
      }
    }
  );

  // ============================================================================
  // USAGE / MEDIATION ENDPOINTS
  // ============================================================================

  // Submit single usage record
  router.post('/usage',
    authenticate,
    requirePermission('usage:write'),
    rateLimiter('usage_single'),
    validate('usageRecord'),
    async (req: Request, res: Response) => {
      const data: UsageRecord = req.body;
      const result = await usageService.submitUsageRecord(data);

      if (result.success) {
        res.status(202).json(result.data);
      } else {
        const errorResponse: ErrorResponse = {
          error: {
            code: result.error,
            message: result.message,
            requestId: req.auth!.requestId
          }
        };
        res.status(400).json(errorResponse);
      }
    }
  );

  // Submit usage batch
  router.post('/usage/batch',
    authenticate,
    requirePermission('usage:write'),
    rateLimiter('usage_batch'),
    validate('usageBatch'),
    async (req: Request, res: Response) => {
      const data: UsageBatchRequest = req.body;
      const result = await usageService.submitUsageBatch(data);
      res.status(202).json(result);
    }
  );

  // Reset billing cycle
  router.post('/usage/reset',
    authenticate,
    requirePermission('usage:write'),
    rateLimiter('usage_single'),
    validate('usageReset'),
    async (req: Request, res: Response) => {
      const data: UsageResetRequest = req.body;
      const result = await usageService.resetBillingCycle(data);

      if (result.success) {
        res.json(result.data);
      } else {
        const errorResponse: ErrorResponse = {
          error: {
            code: result.error,
            message: result.message,
            requestId: req.auth!.requestId
          }
        };
        res.status(404).json(errorResponse);
      }
    }
  );

  // ============================================================================
  // API CLIENT MANAGEMENT ENDPOINTS
  // ============================================================================

  // List all API clients
  router.get('/api-clients',
    authenticate,
    requirePermission('api-clients:read'),
    async (req: Request, res: Response) => {
      try {
        const clients = await apiClientService.listClients();
        res.json({ data: clients });
      } catch (error) {
        console.error('Error listing API clients:', error);
        const errorResponse: ErrorResponse = {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to list API clients',
            requestId: req.auth!.requestId
          }
        };
        res.status(500).json(errorResponse);
      }
    }
  );

  // Create new API client
  router.post('/api-clients',
    authenticate,
    requirePermission('api-clients:write'),
    async (req: Request, res: Response) => {
      try {
        const { name, description, permissions } = req.body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
          const errorResponse: ErrorResponse = {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Name is required',
              requestId: req.auth!.requestId
            }
          };
          res.status(400).json(errorResponse);
          return;
        }

        const result = await apiClientService.createClient({
          name: name.trim(),
          description: description?.trim(),
          permissions
        });

        res.status(201).json({
          client: result.client,
          apiKey: result.apiKey,
          message: 'API key shown only once. Save it securely!'
        });
      } catch (error) {
        console.error('Error creating API client:', error);
        const errorResponse: ErrorResponse = {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to create API client',
            requestId: req.auth!.requestId
          }
        };
        res.status(500).json(errorResponse);
      }
    }
  );

  // Toggle API client status (enable/disable)
  router.post('/api-clients/:clientId/toggle',
    authenticate,
    requirePermission('api-clients:write'),
    async (req: Request, res: Response) => {
      try {
        const client = await apiClientService.toggleClientStatus(req.params.clientId);

        if (!client) {
          const errorResponse: ErrorResponse = {
            error: {
              code: 'CLIENT_NOT_FOUND',
              message: `API client ${req.params.clientId} not found`,
              requestId: req.auth!.requestId
            }
          };
          res.status(404).json(errorResponse);
          return;
        }

        res.json({ data: client });
      } catch (error) {
        console.error('Error toggling API client:', error);
        const errorResponse: ErrorResponse = {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to toggle API client status',
            requestId: req.auth!.requestId
          }
        };
        res.status(500).json(errorResponse);
      }
    }
  );

  // Regenerate API key
  router.post('/api-clients/:clientId/regenerate',
    authenticate,
    requirePermission('api-clients:write'),
    async (req: Request, res: Response) => {
      try {
        const result = await apiClientService.regenerateKey(req.params.clientId);

        if (!result) {
          const errorResponse: ErrorResponse = {
            error: {
              code: 'CLIENT_NOT_FOUND',
              message: `API client ${req.params.clientId} not found`,
              requestId: req.auth!.requestId
            }
          };
          res.status(404).json(errorResponse);
          return;
        }

        res.json({
          apiKey: result.apiKey,
          message: 'New API key generated. Save it securely! The old key is now invalid.'
        });
      } catch (error) {
        console.error('Error regenerating API key:', error);
        const errorResponse: ErrorResponse = {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to regenerate API key',
            requestId: req.auth!.requestId
          }
        };
        res.status(500).json(errorResponse);
      }
    }
  );

  // Delete API client
  router.delete('/api-clients/:clientId',
    authenticate,
    requirePermission('api-clients:write'),
    async (req: Request, res: Response) => {
      try {
        const deleted = await apiClientService.deleteClient(req.params.clientId);

        if (!deleted) {
          const errorResponse: ErrorResponse = {
            error: {
              code: 'CLIENT_NOT_FOUND',
              message: `API client ${req.params.clientId} not found`,
              requestId: req.auth!.requestId
            }
          };
          res.status(404).json(errorResponse);
          return;
        }

        res.status(204).send();
      } catch (error) {
        console.error('Error deleting API client:', error);
        const errorResponse: ErrorResponse = {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to delete API client',
            requestId: req.auth!.requestId
          }
        };
        res.status(500).json(errorResponse);
      }
    }
  );

  return router;
}
