export interface DateRange {
  from: Date
  to: Date
}

export interface RepairFrequencyPoint {
  period: string
  total: number
  completed: number
}

export interface TopEquipmentRepairEntry {
  equipmentId: number
  equipmentName: string
  totalRequests: number
  latestStatus: string
  latestCompletedDate?: string | null
}

export interface TopEquipmentRepairCostEntry {
  equipmentId: number
  equipmentName: string
  equipmentCode: string
  totalRepairCost: number
  averageCompletedRepairCost: number
  completedRepairRequests: number
  costRecordedCount: number
}

export interface RecentRepairHistoryEntry {
  id: number
  equipmentName: string
  issue: string
  status: string
  requestedDate: string
  completedDate?: string | null
  repairCost?: number | null
}

export interface RepairUsageCostCorrelationPoint {
  equipmentId: number
  equipmentName: string
  equipmentCode: string
  totalUsageHours: number
  totalRepairCost: number
  completedRepairRequests: number
  costRecordedCount: number
  [key: string]: unknown
}

export interface RepairUsageCostCorrelationDataQuality {
  equipmentWithUsage: number
  equipmentWithRepairCost: number
  equipmentWithBoth: number
}

export interface RepairUsageCostCorrelationScope {
  points: RepairUsageCostCorrelationPoint[]
  dataQuality: RepairUsageCostCorrelationDataQuality
}

export interface RepairUsageCostCorrelation {
  period: RepairUsageCostCorrelationScope
  cumulative: RepairUsageCostCorrelationScope
}

export interface MaintenanceReportData {
  summary: {
    totalRepairs: number
    repairCompletionRate: number
    totalMaintenancePlanned: number
    maintenanceCompletionRate: number
    totalRepairCost: number
    averageCompletedRepairCost: number
    costRecordedCount: number
    costMissingCount: number
  }
  charts: {
    repairStatusDistribution: Array<{
      name: string
      value: number
      color: string
    }>
    maintenancePlanVsActual: Array<{
      name: string
      planned: number
      actual: number
    }>
    repairFrequencyByMonth: RepairFrequencyPoint[]
    repairUsageCostCorrelation: RepairUsageCostCorrelation
  }
  topEquipmentRepairs: TopEquipmentRepairEntry[]
  topEquipmentRepairCosts: TopEquipmentRepairCostEntry[]
  recentRepairHistory: RecentRepairHistoryEntry[]
}

const defaultRepairUsageCostCorrelationScope: RepairUsageCostCorrelationScope = {
  points: [],
  dataQuality: {
    equipmentWithUsage: 0,
    equipmentWithRepairCost: 0,
    equipmentWithBoth: 0,
  },
}

export const defaultMaintenanceReportData: MaintenanceReportData = {
  summary: {
    totalRepairs: 0,
    repairCompletionRate: 0,
    totalMaintenancePlanned: 0,
    maintenanceCompletionRate: 0,
    totalRepairCost: 0,
    averageCompletedRepairCost: 0,
    costRecordedCount: 0,
    costMissingCount: 0,
  },
  charts: {
    repairStatusDistribution: [],
    maintenancePlanVsActual: [],
    repairFrequencyByMonth: [],
    repairUsageCostCorrelation: {
      period: defaultRepairUsageCostCorrelationScope,
      cumulative: defaultRepairUsageCostCorrelationScope,
    },
  },
  topEquipmentRepairs: [],
  topEquipmentRepairCosts: [],
  recentRepairHistory: [],
}

export function mergeMaintenanceReportData(
  report: Partial<MaintenanceReportData> | null | undefined
): MaintenanceReportData {
  const nextCharts = report?.charts
  const nextCorrelation = nextCharts?.repairUsageCostCorrelation

  return {
    ...defaultMaintenanceReportData,
    ...report,
    summary: {
      ...defaultMaintenanceReportData.summary,
      ...report?.summary,
    },
    charts: {
      ...defaultMaintenanceReportData.charts,
      ...nextCharts,
      repairStatusDistribution:
        nextCharts?.repairStatusDistribution ?? defaultMaintenanceReportData.charts.repairStatusDistribution,
      maintenancePlanVsActual:
        nextCharts?.maintenancePlanVsActual ?? defaultMaintenanceReportData.charts.maintenancePlanVsActual,
      repairFrequencyByMonth:
        nextCharts?.repairFrequencyByMonth ?? defaultMaintenanceReportData.charts.repairFrequencyByMonth,
      repairUsageCostCorrelation: {
        period: {
          ...defaultMaintenanceReportData.charts.repairUsageCostCorrelation.period,
          ...nextCorrelation?.period,
          points:
            nextCorrelation?.period?.points ??
            defaultMaintenanceReportData.charts.repairUsageCostCorrelation.period.points,
          dataQuality: {
            ...defaultMaintenanceReportData.charts.repairUsageCostCorrelation.period.dataQuality,
            ...nextCorrelation?.period?.dataQuality,
          },
        },
        cumulative: {
          ...defaultMaintenanceReportData.charts.repairUsageCostCorrelation.cumulative,
          ...nextCorrelation?.cumulative,
          points:
            nextCorrelation?.cumulative?.points ??
            defaultMaintenanceReportData.charts.repairUsageCostCorrelation.cumulative.points,
          dataQuality: {
            ...defaultMaintenanceReportData.charts.repairUsageCostCorrelation.cumulative.dataQuality,
            ...nextCorrelation?.cumulative?.dataQuality,
          },
        },
      },
    },
    topEquipmentRepairs: report?.topEquipmentRepairs ?? defaultMaintenanceReportData.topEquipmentRepairs,
    topEquipmentRepairCosts:
      report?.topEquipmentRepairCosts ?? defaultMaintenanceReportData.topEquipmentRepairCosts,
    recentRepairHistory: report?.recentRepairHistory ?? defaultMaintenanceReportData.recentRepairHistory,
  }
}
