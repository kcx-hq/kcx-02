export type BillingSourceOption = {
  id: number
  name: string
}

export type CloudCostSummary = {
  totalCost: number
  costChangePercentage: number
  anomalyCount: number
  topService: string
  topServicePercentage: number
}

export type CloudCostTrendPoint = {
  date: string
  cost: number
}

export type CloudCostBreakdownItem = {
  service: string
  cost: number
  percentage: number
}

export type CloudCostTopContributor = {
  rank: number
  name: string
  amount: number
}

export type CloudCostAnomalyItem = {
  date: string
  service: string
  actualCost: number
  expectedCost: number
  impact: number
}

export type CloudCostAnomalyReport = {
  title: string
  period: string
  generatedAt: string
  summary: CloudCostSummary
  trendData: CloudCostTrendPoint[]
  breakdownData: CloudCostBreakdownItem[]
  topContributors: CloudCostTopContributor[]
  anomalies: CloudCostAnomalyItem[]
  insights: string[]
  billingSources: BillingSourceOption[]
}

export type CloudCostReportQuery = {
  startDate: string
  endDate: string
  billingSourceId?: number
}

