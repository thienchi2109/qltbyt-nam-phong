import * as React from "react"
import { CheckCircle, FileEdit, XCircle } from "lucide-react"
import type { StatusConfig } from "../types"

export type MaintenanceStatus = "Bản nháp" | "Đã duyệt" | "Không duyệt"

export const MAINTENANCE_STATUS_CONFIGS: StatusConfig<MaintenanceStatus>[] = [
  { key: "Bản nháp", label: "Bản nháp", tone: "warning", icon: <FileEdit className="h-5 w-5" /> },
  { key: "Đã duyệt", label: "Đã duyệt", tone: "success", icon: <CheckCircle className="h-5 w-5" /> },
  { key: "Không duyệt", label: "Không duyệt", tone: "danger", icon: <XCircle className="h-5 w-5" /> },
]
