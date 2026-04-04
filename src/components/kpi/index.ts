// KPI Status Bar — shared component for standardized status cards
export { KpiStatusBar } from "./KpiStatusBar"
export type { StatusConfig, StatusTone, KpiStatusBarProps } from "./types"

// Module-specific configs
export { REPAIR_STATUS_CONFIGS, type RepairStatus } from "@/components/kpi/configs/repair-requests"
export { TRANSFER_STATUS_CONFIGS, type TransferStatus } from "@/components/kpi/configs/transfers"
export { MAINTENANCE_STATUS_CONFIGS, type MaintenanceStatus } from "@/components/kpi/configs/maintenance"
export { DEVICE_QUOTA_CONFIGS, type DeviceQuotaComplianceStatus } from "@/components/kpi/configs/device-quota"
