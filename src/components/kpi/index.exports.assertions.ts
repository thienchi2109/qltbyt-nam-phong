import { DEVICE_QUOTA_CONFIGS, KpiStatusBar, MAINTENANCE_STATUS_CONFIGS, REPAIR_STATUS_CONFIGS, TRANSFER_STATUS_CONFIGS } from "@/components/kpi"
import type { RepairStatus } from "@/components/kpi"

void KpiStatusBar
void REPAIR_STATUS_CONFIGS
void TRANSFER_STATUS_CONFIGS
void MAINTENANCE_STATUS_CONFIGS
void DEVICE_QUOTA_CONFIGS

type RepairStatusReference = RepairStatus
void (null as unknown as RepairStatusReference)

// @ts-expect-error Batch 1 cleanup: StatusConfig should not be re-exported from the KPI barrel.
import type { StatusConfig } from "@/components/kpi"

// @ts-expect-error Batch 1 cleanup: StatusTone should not be re-exported from the KPI barrel.
import type { StatusTone } from "@/components/kpi"

// @ts-expect-error Batch 1 cleanup: KpiStatusBarProps should not be re-exported from the KPI barrel.
import type { KpiStatusBarProps } from "@/components/kpi"

// @ts-expect-error Batch 1 cleanup: TransferStatus should not be re-exported from the KPI barrel.
import type { TransferStatus } from "@/components/kpi"

// @ts-expect-error Batch 1 cleanup: MaintenanceStatus should not be re-exported from the KPI barrel.
import type { MaintenanceStatus } from "@/components/kpi"

// @ts-expect-error Batch 1 cleanup: DeviceQuotaComplianceStatus should not be re-exported from the KPI barrel.
import type { DeviceQuotaComplianceStatus } from "@/components/kpi"

void (null as unknown as StatusConfig<string>)
void (null as unknown as StatusTone)
void (null as unknown as KpiStatusBarProps<string>)
void (null as unknown as TransferStatus)
void (null as unknown as MaintenanceStatus)
void (null as unknown as DeviceQuotaComplianceStatus)
