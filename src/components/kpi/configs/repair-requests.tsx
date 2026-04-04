import * as React from "react"
import { CheckCheck, CheckCircle, Clock, XCircle } from "lucide-react"
import type { StatusConfig } from "../types"

export type RepairStatus = "Chờ xử lý" | "Đã duyệt" | "Hoàn thành" | "Không HT"

export const REPAIR_STATUS_CONFIGS: StatusConfig<RepairStatus>[] = [
  { key: "Chờ xử lý", label: "Chờ xử lý", tone: "warning", icon: <Clock className="h-5 w-5" /> },
  { key: "Đã duyệt", label: "Đã duyệt", tone: "muted", icon: <CheckCheck className="h-5 w-5" /> },
  { key: "Hoàn thành", label: "Hoàn thành", tone: "success", icon: <CheckCircle className="h-5 w-5" /> },
  { key: "Không HT", label: "Không HT", tone: "danger", icon: <XCircle className="h-5 w-5" /> },
]
