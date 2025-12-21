export interface ConsumptionKpi {
  totalSpend: number
  totalSpendTrend: number
  dataUsageGB: number
  dataUsageTrend: number
  activeSims: number
  activeSimsTrend: number
  avgCostPerSim: number
}

export interface KpiResponse {
  success: boolean
  data: ConsumptionKpi
}

export interface ConsumptionTrend {
  period: string
  dataUsageGB: number
  cost: number
  simCount: number
}

export interface TrendResponse {
  success: boolean
  data: ConsumptionTrend[]
  granularity: string
}

export type TrendGranularity = 'hourly' | 'daily' | 'weekly' | 'monthly'

export interface CarrierBreakdown {
  id: string
  name: string
  dataUsageGB: number
  cost: number
  costPercentage: number
  dataPercentage: number
}

export interface CarrierResponse {
  success: boolean
  data: CarrierBreakdown[]
}
