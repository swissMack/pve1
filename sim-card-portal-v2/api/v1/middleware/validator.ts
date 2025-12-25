/**
 * Request Validation Middleware for Provisioning API
 * Validates request bodies against defined schemas
 */

import { Request, Response, NextFunction } from 'express';
import type {
  CreateSimRequest,
  UpdateSimRequest,
  BlockRequest,
  ActionRequest,
  WebhookRegistration,
  UsageRecord,
  UsageBatchRequest,
  UsageResetRequest,
  ErrorResponse,
  ErrorDetail,
  EventType,
  BlockReason,
  VALIDATION_PATTERNS
} from '../types/provisioning.types.js';

// Validation patterns
const PATTERNS = {
  iccid: /^[0-9]{19,20}$/,
  imsi: /^[0-9]{15}$/,
  msisdn: /^\+[0-9]{7,15}$/,
  imei: /^[0-9]{15}$/,
  puk: /^[0-9]{8}$/,
  pin: /^[0-9]{4,8}$/,
  webhookUrl: /^https:\/\/.+/,
  cycleId: /^[0-9]{4}-[0-9]{2}$/,  // YYYY-MM format
};

const VALID_EVENT_TYPES: EventType[] = ['SIM_ACTIVATED', 'SIM_DEACTIVATED', 'SIM_BLOCKED', 'SIM_UNBLOCKED'];

const VALID_BLOCK_REASONS: BlockReason[] = [
  'USAGE_THRESHOLD_EXCEEDED',
  'FRAUD_SUSPECTED',
  'BILLING_ISSUE',
  'CUSTOMER_REQUEST',
  'POLICY_VIOLATION',
  'MANUAL'
];

/**
 * Validation result
 */
interface ValidationResult {
  valid: boolean;
  errors: ErrorDetail[];
}

/**
 * Validate a value against a pattern
 */
function validatePattern(value: string, pattern: RegExp, field: string, message: string): ErrorDetail | null {
  if (!pattern.test(value)) {
    return { field, message };
  }
  return null;
}

/**
 * Check if value is a valid ISO 8601 datetime
 */
function isValidISODate(value: string): boolean {
  const date = new Date(value);
  return !isNaN(date.getTime()) && value.includes('T');
}

/**
 * Validate CreateSimRequest
 */
function validateCreateSim(body: any): ValidationResult {
  const errors: ErrorDetail[] = [];

  // Required fields
  if (!body.iccid) {
    errors.push({ field: 'iccid', message: 'ICCID is required' });
  } else {
    const err = validatePattern(body.iccid, PATTERNS.iccid, 'iccid', 'ICCID must be 19-20 digits');
    if (err) errors.push(err);
  }

  if (!body.imsi) {
    errors.push({ field: 'imsi', message: 'IMSI is required' });
  } else {
    const err = validatePattern(body.imsi, PATTERNS.imsi, 'imsi', 'IMSI must be 15 digits');
    if (err) errors.push(err);
  }

  if (!body.msisdn) {
    errors.push({ field: 'msisdn', message: 'MSISDN is required' });
  } else {
    const err = validatePattern(body.msisdn, PATTERNS.msisdn, 'msisdn', 'MSISDN must be in E.164 format (e.g., +41791234567)');
    if (err) errors.push(err);
  }

  // Optional fields with validation
  if (body.imei) {
    const err = validatePattern(body.imei, PATTERNS.imei, 'imei', 'IMEI must be 15 digits');
    if (err) errors.push(err);
  }

  if (body.puk1) {
    const err = validatePattern(body.puk1, PATTERNS.puk, 'puk1', 'PUK1 must be 8 digits');
    if (err) errors.push(err);
  }

  if (body.puk2) {
    const err = validatePattern(body.puk2, PATTERNS.puk, 'puk2', 'PUK2 must be 8 digits');
    if (err) errors.push(err);
  }

  if (body.pin1) {
    const err = validatePattern(body.pin1, PATTERNS.pin, 'pin1', 'PIN1 must be 4-8 digits');
    if (err) errors.push(err);
  }

  if (body.pin2) {
    const err = validatePattern(body.pin2, PATTERNS.pin, 'pin2', 'PIN2 must be 4-8 digits');
    if (err) errors.push(err);
  }

  // Profile validation
  if (!body.profile) {
    errors.push({ field: 'profile', message: 'Profile is required' });
  } else {
    if (!body.profile.apn) {
      errors.push({ field: 'profile.apn', message: 'APN is required' });
    }
    if (!body.profile.ratePlanId) {
      errors.push({ field: 'profile.ratePlanId', message: 'Rate plan ID is required' });
    }
    if (!body.profile.billingAccountId) {
      errors.push({ field: 'profile.billingAccountId', message: 'Billing account ID is required' });
    }
    if (!body.profile.customerId) {
      errors.push({ field: 'profile.customerId', message: 'Customer ID is required' });
    }
    if (body.profile.dataLimit !== undefined && (typeof body.profile.dataLimit !== 'number' || body.profile.dataLimit < 0)) {
      errors.push({ field: 'profile.dataLimit', message: 'Data limit must be a non-negative number (bytes)' });
    }
  }

  // Metadata validation
  if (body.metadata !== undefined && (typeof body.metadata !== 'object' || Array.isArray(body.metadata))) {
    errors.push({ field: 'metadata', message: 'Metadata must be an object' });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate UpdateSimRequest
 */
function validateUpdateSim(body: any): ValidationResult {
  const errors: ErrorDetail[] = [];

  if (body.imei) {
    const err = validatePattern(body.imei, PATTERNS.imei, 'imei', 'IMEI must be 15 digits');
    if (err) errors.push(err);
  }

  if (body.profile) {
    if (body.profile.dataLimit !== undefined && (typeof body.profile.dataLimit !== 'number' || body.profile.dataLimit < 0)) {
      errors.push({ field: 'profile.dataLimit', message: 'Data limit must be a non-negative number (bytes)' });
    }
  }

  if (body.metadata !== undefined && (typeof body.metadata !== 'object' || Array.isArray(body.metadata))) {
    errors.push({ field: 'metadata', message: 'Metadata must be an object' });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate BlockRequest
 */
function validateBlockRequest(body: any): ValidationResult {
  const errors: ErrorDetail[] = [];

  if (!body.reason) {
    errors.push({ field: 'reason', message: 'Reason is required' });
  } else if (!VALID_BLOCK_REASONS.includes(body.reason)) {
    errors.push({
      field: 'reason',
      message: `Invalid reason. Must be one of: ${VALID_BLOCK_REASONS.join(', ')}`
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate WebhookRegistration
 */
function validateWebhookRegistration(body: any): ValidationResult {
  const errors: ErrorDetail[] = [];

  if (!body.url) {
    errors.push({ field: 'url', message: 'URL is required' });
  } else if (!PATTERNS.webhookUrl.test(body.url)) {
    errors.push({ field: 'url', message: 'URL must be HTTPS' });
  }

  if (!body.events || !Array.isArray(body.events)) {
    errors.push({ field: 'events', message: 'Events array is required' });
  } else if (body.events.length === 0) {
    errors.push({ field: 'events', message: 'At least one event type is required' });
  } else {
    const invalidEvents = body.events.filter((e: string) => !VALID_EVENT_TYPES.includes(e as EventType));
    if (invalidEvents.length > 0) {
      errors.push({
        field: 'events',
        message: `Invalid event types: ${invalidEvents.join(', ')}. Valid types: ${VALID_EVENT_TYPES.join(', ')}`
      });
    }
  }

  if (!body.secret) {
    errors.push({ field: 'secret', message: 'Secret is required' });
  } else if (body.secret.length < 32) {
    errors.push({ field: 'secret', message: 'Secret must be at least 32 characters' });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate UsageRecord
 */
function validateUsageRecord(body: any, prefix = ''): ErrorDetail[] {
  const errors: ErrorDetail[] = [];
  const fieldPrefix = prefix ? `${prefix}.` : '';

  if (!body.iccid) {
    errors.push({ field: `${fieldPrefix}iccid`, message: 'ICCID is required' });
  }

  if (!body.periodStart) {
    errors.push({ field: `${fieldPrefix}periodStart`, message: 'Period start is required' });
  } else if (!isValidISODate(body.periodStart)) {
    errors.push({ field: `${fieldPrefix}periodStart`, message: 'Period start must be ISO 8601 datetime' });
  }

  if (!body.periodEnd) {
    errors.push({ field: `${fieldPrefix}periodEnd`, message: 'Period end is required' });
  } else if (!isValidISODate(body.periodEnd)) {
    errors.push({ field: `${fieldPrefix}periodEnd`, message: 'Period end must be ISO 8601 datetime' });
  }

  if (!body.recordId) {
    errors.push({ field: `${fieldPrefix}recordId`, message: 'Record ID is required for idempotency' });
  }

  if (!body.usage) {
    errors.push({ field: `${fieldPrefix}usage`, message: 'Usage data is required' });
  } else {
    if (body.usage.totalBytes === undefined) {
      errors.push({ field: `${fieldPrefix}usage.totalBytes`, message: 'Total bytes is required' });
    } else if (typeof body.usage.totalBytes !== 'number' || body.usage.totalBytes < 0) {
      errors.push({ field: `${fieldPrefix}usage.totalBytes`, message: 'Total bytes must be a non-negative number' });
    }
  }

  return errors;
}

/**
 * Validate UsageBatchRequest
 */
function validateUsageBatch(body: any): ValidationResult {
  const errors: ErrorDetail[] = [];

  if (!body.batchId) {
    errors.push({ field: 'batchId', message: 'Batch ID is required' });
  }

  if (!body.records || !Array.isArray(body.records)) {
    errors.push({ field: 'records', message: 'Records array is required' });
  } else if (body.records.length === 0) {
    errors.push({ field: 'records', message: 'At least one record is required' });
  } else if (body.records.length > 1000) {
    errors.push({ field: 'records', message: 'Maximum 1000 records per batch' });
  } else {
    // Validate each record (limit error collection to first 10)
    let recordErrors = 0;
    for (let i = 0; i < body.records.length && recordErrors < 10; i++) {
      const recordErrs = validateUsageRecord(body.records[i], `records[${i}]`);
      if (recordErrs.length > 0) {
        errors.push(...recordErrs);
        recordErrors++;
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate UsageResetRequest
 */
function validateUsageReset(body: any): ValidationResult {
  const errors: ErrorDetail[] = [];

  if (!body.iccid) {
    errors.push({ field: 'iccid', message: 'ICCID is required' });
  }

  if (!body.billingCycleId) {
    errors.push({ field: 'billingCycleId', message: 'Billing cycle ID is required' });
  } else if (!PATTERNS.cycleId.test(body.billingCycleId)) {
    errors.push({ field: 'billingCycleId', message: 'Billing cycle ID must be in YYYY-MM format' });
  }

  if (!body.cycleStart) {
    errors.push({ field: 'cycleStart', message: 'Cycle start is required' });
  } else if (!isValidISODate(body.cycleStart)) {
    errors.push({ field: 'cycleStart', message: 'Cycle start must be ISO 8601 datetime' });
  }

  if (!body.cycleEnd) {
    errors.push({ field: 'cycleEnd', message: 'Cycle end is required' });
  } else if (!isValidISODate(body.cycleEnd)) {
    errors.push({ field: 'cycleEnd', message: 'Cycle end must be ISO 8601 datetime' });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Create validation middleware for a specific schema
 */
type ValidationType = 'createSim' | 'updateSim' | 'blockRequest' | 'actionRequest' | 'webhook' | 'usageRecord' | 'usageBatch' | 'usageReset';

export function validate(type: ValidationType) {
  return function validationMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    let result: ValidationResult;

    switch (type) {
      case 'createSim':
        result = validateCreateSim(req.body);
        break;
      case 'updateSim':
        result = validateUpdateSim(req.body);
        break;
      case 'blockRequest':
        result = validateBlockRequest(req.body);
        break;
      case 'actionRequest':
        // ActionRequest has no required fields
        result = { valid: true, errors: [] };
        break;
      case 'webhook':
        result = validateWebhookRegistration(req.body);
        break;
      case 'usageRecord':
        const usageErrors = validateUsageRecord(req.body);
        result = { valid: usageErrors.length === 0, errors: usageErrors };
        break;
      case 'usageBatch':
        result = validateUsageBatch(req.body);
        break;
      case 'usageReset':
        result = validateUsageReset(req.body);
        break;
      default:
        result = { valid: true, errors: [] };
    }

    if (!result.valid) {
      const requestId = req.auth?.requestId || 'unknown';
      const errorResponse: ErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: result.errors,
          requestId
        }
      };
      res.status(400).json(errorResponse);
      return;
    }

    next();
  };
}

/**
 * Validate path parameters
 */
export function validateSimId(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { simId } = req.params;

  if (!simId || !simId.startsWith('sim_')) {
    const requestId = req.auth?.requestId || 'unknown';
    const errorResponse: ErrorResponse = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid SIM ID format',
        details: [{ field: 'simId', message: 'SIM ID must start with "sim_"' }],
        requestId
      }
    };
    res.status(400).json(errorResponse);
    return;
  }

  next();
}

/**
 * Validate webhook ID
 */
export function validateWebhookId(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { webhookId } = req.params;

  if (!webhookId || !webhookId.startsWith('wh_')) {
    const requestId = req.auth?.requestId || 'unknown';
    const errorResponse: ErrorResponse = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid webhook ID format',
        details: [{ field: 'webhookId', message: 'Webhook ID must start with "wh_"' }],
        requestId
      }
    };
    res.status(400).json(errorResponse);
    return;
  }

  next();
}
