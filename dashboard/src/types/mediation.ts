export type MediationStatus = 'ACCEPTED' | 'DUPLICATE'

export interface UsageMetrics {
  dataUploadBytes?: number
  dataDownloadBytes?: number
  totalBytes: number
  smsCount?: number
  voiceSeconds?: number
}

export interface MediationEvent {
  recordId: string
  iccid: string
  periodStart: string
  periodEnd: string
  usage: UsageMetrics
  source: string
  status: MediationStatus
  processedAt: string
  batchId?: string
}

export interface UsageRecord {
  iccid: string
  periodStart: string
  periodEnd: string
  usage: UsageMetrics
  source: string
  recordId: string
}

export interface UsageResponse {
  recordId: string
  status: MediationStatus
  processedAt: string
}
