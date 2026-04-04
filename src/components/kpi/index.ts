// KPI Status Bar — shared component for standardized status cards
export { KpiStatusBar } from "./KpiStatusBar"
export type { StatusConfig, StatusTone, KpiStatusBarProps } from "./types"

// Module-specific configs
export { REPAIR_STATUS_CONFIGS, type RepairStatus } from "./configs/repair-requests"
export { TRANSFER_STATUS_CONFIGS, type TransferStatus } from "./configs/transfers"
export { MAINTENANCE_STATUS_CONFIGS, type MaintenanceStatus } from "./configs/maintenance"
export { DEVICE_QUOTA_CONFIGS, type DeviceQuotaComplianceStatus } from "./configs/device-quota"
