import * as React from "react"
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import type { StatusConfig } from "../types"

export type DeviceQuotaComplianceStatus = "dat" | "thieu" | "vuot"

export const DEVICE_QUOTA_CONFIGS: StatusConfig<DeviceQuotaComplianceStatus>[] = [
  { key: "dat", label: "Đạt định mức", tone: "success", icon: <CheckCircle2 className="h-5 w-5" /> },
  { key: "thieu", label: "Thiếu định mức", tone: "danger", icon: <XCircle className="h-5 w-5" /> },
  { key: "vuot", label: "Vượt định mức", tone: "warning", icon: <AlertTriangle className="h-5 w-5" /> },
]
