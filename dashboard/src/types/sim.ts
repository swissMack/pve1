export type SimStatus = 'PROVISIONED' | 'ACTIVE' | 'INACTIVE' | 'BLOCKED'

export type BlockReason =
  | 'USAGE_THRESHOLD_EXCEEDED'
  | 'FRAUD_SUSPECTED'
  | 'BILLING_ISSUE'
  | 'CUSTOMER_REQUEST'
  | 'POLICY_VIOLATION'
  | 'MANUAL'

export interface SimProfile {
  apn?: string
  ratePlanId?: string
  dataLimit?: number
  billingAccountId?: string
  customerId?: string
}

export interface Sim {
  simId: string
  iccid: string
  imsi: string
  msisdn: string
  imei?: string
  status: SimStatus
  profile?: SimProfile
  metadata?: Record<string, string>
  createdAt: string
  updatedAt: string
  blockReason?: BlockReason
  blockNotes?: string
  blockedAt?: string
  blockedBy?: string
}

export interface SimListResponse {
  data: Sim[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

export interface BlockRequest {
  reason: BlockReason
  notes?: string
  correlationId?: string
}

export interface UnblockRequest {
  reason?: string
  notes?: string
  correlationId?: string
}
