/**
 * Provisioning and Mediation API Type Definitions
 * Based on OpenAPI Specification v1.0
 */

// ============================================================================
// ENUMS
// ============================================================================

export type SimStatus = 'PROVISIONED' | 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

export type EventType = 'SIM_ACTIVATED' | 'SIM_DEACTIVATED' | 'SIM_BLOCKED' | 'SIM_UNBLOCKED';

export type BlockReason =
  | 'USAGE_THRESHOLD_EXCEEDED'
  | 'FRAUD_SUSPECTED'
  | 'BILLING_ISSUE'
  | 'CUSTOMER_REQUEST'
  | 'POLICY_VIOLATION'
  | 'MANUAL';

export type Initiator = 'SYSTEM' | 'USER' | 'API';

export type WebhookStatus = 'ACTIVE' | 'PAUSED' | 'FAILED';

export type UsageRecordStatus = 'ACCEPTED' | 'DUPLICATE' | 'FAILED';

// ============================================================================
// PROVISIONING SCHEMAS
// ============================================================================

export interface SimProfile {
  apn: string;
  ratePlanId: string;
  dataLimit?: number;  // Data limit in bytes
  billingAccountId: string;
  customerId: string;
}

export interface CreateSimRequest {
  iccid: string;            // 19-20 digit ICCID
  imsi: string;             // 15 digit IMSI
  msisdn: string;           // E.164 format phone number
  imei?: string;            // 15 digit IMEI
  puk1?: string;            // 8 digit PUK1 code
  puk2?: string;            // 8 digit PUK2 code
  pin1?: string;            // 4-8 digit PIN1
  pin2?: string;            // 4-8 digit PIN2
  ki?: string;              // Authentication key (hex)
  opc?: string;             // Operator code (hex)
  profile: SimProfile;
  metadata?: Record<string, string>;
  activateImmediately?: boolean;  // Default: false
}

export interface UpdateSimRequest {
  imei?: string;
  profile?: Partial<SimProfile>;
  metadata?: Record<string, string>;
}

export interface SimResponse {
  simId: string;
  iccid: string;
  status: SimStatus;
  createdAt: string;
  updatedAt: string;
  links: {
    self: string;
    activate?: string;
    deactivate?: string;
    usage: string;
  };
}

export interface SimDetailResponse extends SimResponse {
  imsi: string;
  msisdn: string;
  imei?: string;
  profile: SimProfile;
  metadata?: Record<string, string>;
  usageSummary?: UsageSummary;
  blockReason?: BlockReason;
  blockNotes?: string;
  blockedAt?: string;
  activatedAt?: string;
  deactivatedAt?: string;
}

export interface ActionRequest {
  reason?: string;
  notes?: string;
  notifyProvisioning?: boolean;  // Default: true
  correlationId?: string;
}

export interface BlockRequest {
  reason: BlockReason;
  notes?: string;
  notifyProvisioning?: boolean;  // Default: true
  correlationId?: string;
}

// ============================================================================
// WEBHOOK SCHEMAS
// ============================================================================

export interface WebhookRegistration {
  url: string;                  // HTTPS callback URL
  events: EventType[];          // Event types to subscribe
  secret: string;               // Shared secret for HMAC-SHA256 (min 32 chars)
}

export interface WebhookResponse {
  webhookId: string;
  url: string;
  events: EventType[];
  createdAt: string;
  status: WebhookStatus;
  lastDeliveryAt?: string;
  lastSuccessAt?: string;
  failureCount?: number;
}

export interface WebhookEventPayload {
  eventId: string;
  eventType: EventType;
  timestamp: string;
  sim: {
    simId: string;
    iccid: string;
    imsi: string;
    msisdn: string;
  };
  previousStatus: SimStatus;
  newStatus: SimStatus;
  reason?: string;
  initiatedBy: Initiator;
  correlationId?: string;
}

export interface WebhookDeliveryHeaders {
  'Content-Type': 'application/json';
  'X-Signature': string;      // sha256={hex-encoded-signature}
  'X-Event-Type': EventType;
  'X-Event-Id': string;
  'X-Timestamp': string;
}

// ============================================================================
// USAGE SCHEMAS
// ============================================================================

export interface UsageData {
  dataUploadBytes?: number;
  dataDownloadBytes?: number;
  totalBytes: number;
  smsCount?: number;
  voiceSeconds?: number;
}

export interface UsageRecord {
  iccid: string;
  periodStart: string;        // ISO 8601 datetime
  periodEnd: string;          // ISO 8601 datetime
  usage: UsageData;
  source?: string;            // Mediation node identifier
  recordId: string;           // Unique record ID for idempotency
}

export interface UsageBatchRequest {
  batchId: string;
  source?: string;
  records: UsageRecord[];     // Max 1000 records
}

export interface UsageAcceptedResponse {
  recordId: string;
  status: UsageRecordStatus;
  processedAt: string;
}

export interface UsageBatchResponse {
  batchId: string;
  recordsReceived: number;
  recordsProcessed: number;
  recordsFailed: number;
  errors?: Array<{
    recordId: string;
    error: string;
  }>;
  processedAt: string;
}

export interface UsageResetRequest {
  iccid: string;
  billingCycleId: string;     // e.g., "2024-12"
  cycleStart: string;         // ISO 8601 datetime
  cycleEnd: string;           // ISO 8601 datetime
  finalUsage?: UsageData;
}

export interface UsageResetResponse {
  iccid: string;
  previousCycle?: {
    id: string;
    archivedUsage: UsageData;
  };
  newCycle: {
    id: string;
    start: string;
    end: string;
  };
}

export interface UsageSummary {
  currentCycle?: {
    totalBytes: number;
    totalFormatted: string;
    percentOfLimit: number;
  };
  lastUpdated?: string;
}

export interface SimUsageResponse {
  simId: string;
  iccid: string;
  billingCycle: {
    id: string;
    start: string;
    end: string;
  };
  usage: {
    dataUploadBytes: number;
    dataDownloadBytes: number;
    totalBytes: number;
    totalFormatted: string;
    percentOfLimit: number;
  };
  limit: {
    totalBytes: number;
    totalFormatted: string;
  };
  lastUpdated: string;
}

// ============================================================================
// ERROR SCHEMAS
// ============================================================================

export interface ErrorDetail {
  field: string;
  message: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: ErrorDetail[];
    requestId: string;
  };
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'DUPLICATE_ICCID'
  | 'SIM_NOT_FOUND'
  | 'INVALID_STATE_TRANSITION'
  | 'WEBHOOK_REGISTRATION_FAILED'
  | 'WEBHOOK_NOT_FOUND'
  | 'USAGE_RECORD_DUPLICATE'
  | 'BATCH_PARTIAL_FAILURE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INTERNAL_ERROR';

// ============================================================================
// PAGINATION
// ============================================================================

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

// ============================================================================
// SEARCH PARAMETERS
// ============================================================================

export interface SimSearchParams {
  iccid?: string;
  msisdn?: string;
  status?: SimStatus;
  customerId?: string;
  billingAccountId?: string;
  limit?: number;   // Default: 20, Max: 100
  offset?: number;  // Default: 0
}

// ============================================================================
// STATE MACHINE
// ============================================================================

export const STATE_TRANSITIONS: Record<SimStatus, SimStatus[]> = {
  'PROVISIONED': ['ACTIVE'],
  'ACTIVE': ['INACTIVE', 'BLOCKED'],
  'INACTIVE': ['ACTIVE', 'BLOCKED'],
  'BLOCKED': ['ACTIVE', 'INACTIVE']
};

export function canTransition(from: SimStatus, to: SimStatus): boolean {
  return STATE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getActionForTransition(from: SimStatus, to: SimStatus): string | null {
  if (from === 'PROVISIONED' && to === 'ACTIVE') return 'activate';
  if (from === 'ACTIVE' && to === 'INACTIVE') return 'deactivate';
  if (from === 'INACTIVE' && to === 'ACTIVE') return 'activate';
  if ((from === 'ACTIVE' || from === 'INACTIVE') && to === 'BLOCKED') return 'block';
  if (from === 'BLOCKED' && (to === 'ACTIVE' || to === 'INACTIVE')) return 'unblock';
  return null;
}

// ============================================================================
// RATE LIMITING
// ============================================================================

export interface RateLimitConfig {
  provisioning_write: { limit: number; windowMs: number };
  provisioning_read: { limit: number; windowMs: number };
  usage_single: { limit: number; windowMs: number };
  usage_batch: { limit: number; windowMs: number };
}

export const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  provisioning_write: { limit: 100, windowMs: 60000 },   // 100 req/min
  provisioning_read: { limit: 500, windowMs: 60000 },    // 500 req/min
  usage_single: { limit: 200, windowMs: 60000 },         // 200 req/min
  usage_batch: { limit: 20, windowMs: 60000 }            // 20 req/min
};

// ============================================================================
// VALIDATION PATTERNS
// ============================================================================

export const VALIDATION_PATTERNS = {
  iccid: /^[0-9]{19,20}$/,
  imsi: /^[0-9]{15}$/,
  msisdn: /^\+[0-9]{7,15}$/,
  imei: /^[0-9]{15}$/,
  puk: /^[0-9]{8}$/,
  pin: /^[0-9]{4,8}$/,
  webhookUrl: /^https:\/\/.+/,
  webhookSecretMinLength: 32
};

// ============================================================================
// API CLIENT / AUTH
// ============================================================================

export interface ApiClient {
  id: string;
  name: string;
  permissions: string[];
  rateLimitOverride?: Partial<RateLimitConfig>;
  isActive: boolean;
}

export interface AuthContext {
  clientId: string;
  client: ApiClient;
  requestId: string;
}

// ============================================================================
// DATABASE TYPES
// ============================================================================

export interface DbProvisionedSim {
  sim_id: string;
  iccid: string;
  imsi: string;
  msisdn: string;
  imei: string | null;
  puk1: string | null;
  puk2: string | null;
  pin1: string | null;
  pin2: string | null;
  ki: string | null;
  opc: string | null;
  apn: string;
  rate_plan_id: string;
  data_limit_bytes: number | null;
  billing_account_id: string;
  customer_id: string;
  status: SimStatus;
  previous_status: SimStatus | null;
  block_reason: BlockReason | null;
  block_notes: string | null;
  blocked_at: string | null;
  blocked_by: Initiator | null;
  metadata: Record<string, string> | null;
  created_at: string;
  updated_at: string;
  activated_at: string | null;
  deactivated_at: string | null;
}

export interface DbWebhook {
  id: string;
  url: string;
  events: EventType[];
  secret_hash: string;
  status: WebhookStatus;
  failure_count: number;
  client_id: string | null;
  created_at: string;
  updated_at: string;
  last_delivery_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
}

export interface DbUsageRecord {
  id: number;
  record_id: string;
  iccid: string;
  sim_id: string | null;
  period_start: string;
  period_end: string;
  data_upload_bytes: number;
  data_download_bytes: number;
  total_bytes: number;
  sms_count: number;
  voice_seconds: number;
  source: string | null;
  batch_id: string | null;
  status: UsageRecordStatus;
  processed_at: string;
}

export interface DbUsageCycle {
  id: number;
  sim_id: string;
  iccid: string;
  cycle_id: string;
  cycle_start: string;
  cycle_end: string;
  total_upload_bytes: number;
  total_download_bytes: number;
  total_bytes: number;
  sms_count: number;
  voice_seconds: number;
  is_current: boolean;
  archived_at: string | null;
  final_usage: UsageData | null;
  created_at: string;
  last_updated: string;
}
