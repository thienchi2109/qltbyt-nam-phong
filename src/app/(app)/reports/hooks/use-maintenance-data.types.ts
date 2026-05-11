export interface DateRange {
  from: Date
  to: Date
}

export interface RepairFrequencyPoint {
  period: string
  total: number
  completed: number
}

export interface RepairCostByMonthPoint {
  period: string
  totalCost: number
  averageCost: number
  costRecordedCount: number
  costMissingCount: number
}

export interface RepairCostByFacilityPoint {
  facilityId: number | null
  facilityName: string
  totalCost: number
  averageCost: number
  costRecordedCount: number
  costMissingCount: number
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

export interface RepairUsageCostCorrelationPoint {
  equipmentId: number
  equipmentName: string
  equipmentCode: string
  totalUsageHours: number
  totalRepairCost: number
  completedRepairRequests: number
  costRecordedCount: number
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

export interface RepairCompletionTimeStats {
  totalCompleted: number
  medianMinutes: number
  averageMinutes: number
  p90Minutes: number
  onTimeCount: number
  onTimePercent: number
  thresholdDays: number
}

export interface RepairCompletionBucket {
  bucketKey: string
  label: string
  count: number
  isOverThreshold: boolean
}

export interface RepairCompletionTimeChart {
  stats: RepairCompletionTimeStats
  distribution: RepairCompletionBucket[]
}

export interface RepairCompletionTimeByMonthPoint {
  period: string
  medianMinutes: number
  p90Minutes: number
  averageMinutes: number
  completedCount: number
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
    repairCostByMonth: RepairCostByMonthPoint[]
    repairCostByFacility: RepairCostByFacilityPoint[]
    repairCompletionTime: RepairCompletionTimeChart
    repairCompletionTimeByMonth: RepairCompletionTimeByMonthPoint[]
    repairUsageCostCorrelation: RepairUsageCostCorrelation
  }
  topEquipmentRepairs: TopEquipmentRepairEntry[]
  topEquipmentRepairCosts: TopEquipmentRepairCostEntry[]
}

function createDefaultRepairUsageCostCorrelationScope(): RepairUsageCostCorrelationScope {
  return {
    points: [],
    dataQuality: {
      equipmentWithUsage: 0,
      equipmentWithRepairCost: 0,
      equipmentWithBoth: 0,
    },
  }
}

function createDefaultRepairCompletionTimeChart(): RepairCompletionTimeChart {
  return {
    stats: {
      totalCompleted: 0,
      medianMinutes: 0,
      averageMinutes: 0,
      p90Minutes: 0,
      onTimeCount: 0,
      onTimePercent: 0,
      thresholdDays: 14,
    },
    distribution: [],
  }
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
    repairCostByMonth: [],
    repairCostByFacility: [],
    repairCompletionTime: createDefaultRepairCompletionTimeChart(),
    repairCompletionTimeByMonth: [],
    repairUsageCostCorrelation: {
      period: createDefaultRepairUsageCostCorrelationScope(),
      cumulative: createDefaultRepairUsageCostCorrelationScope(),
    },
  },
  topEquipmentRepairs: [],
  topEquipmentRepairCosts: [],
}

type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [P in keyof T]?: DeepPartial<T[P]> }
    : T

export function mergeMaintenanceReportData(
  report: DeepPartial<MaintenanceReportData> | null | undefined
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
      repairCostByMonth:
        nextCharts?.repairCostByMonth ?? defaultMaintenanceReportData.charts.repairCostByMonth,
      repairCostByFacility:
        nextCharts?.repairCostByFacility ?? defaultMaintenanceReportData.charts.repairCostByFacility,
      repairCompletionTime: {
        stats: {
          ...defaultMaintenanceReportData.charts.repairCompletionTime.stats,
          ...nextCharts?.repairCompletionTime?.stats,
        },
        distribution:
          nextCharts?.repairCompletionTime?.distribution ??
          defaultMaintenanceReportData.charts.repairCompletionTime.distribution,
      },
      repairCompletionTimeByMonth:
        nextCharts?.repairCompletionTimeByMonth ??
        defaultMaintenanceReportData.charts.repairCompletionTimeByMonth,
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
  }
}
