import {
  defaultMaintenanceReportData,
  type MaintenanceReportData,
  type RepairUsageCostCorrelation,
  type RepairUsageCostCorrelationScope,
  type TopEquipmentRepairCostEntry,
} from '@/app/(app)/reports/hooks/use-maintenance-data.types'

type Assert<T extends true> = T
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false

type _defaultPayload = Assert<
  Equal<typeof defaultMaintenanceReportData, MaintenanceReportData>
>

type _topEquipmentRepairCostsEntry = Assert<
  Equal<MaintenanceReportData['topEquipmentRepairCosts'][number], TopEquipmentRepairCostEntry>
>

type _repairUsageCostCorrelation = Assert<
  Equal<MaintenanceReportData['charts']['repairUsageCostCorrelation'], RepairUsageCostCorrelation>
>

type _periodCorrelationScope = Assert<
  Equal<MaintenanceReportData['charts']['repairUsageCostCorrelation']['period'], RepairUsageCostCorrelationScope>
>
