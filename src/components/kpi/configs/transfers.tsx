import * as React from "react"
import { CheckCheck, CheckCircle, Clock, PackageCheck, Truck } from "lucide-react"
import type { StatusConfig } from "../types"

export type TransferStatus =
  | "cho_duyet"
  | "da_duyet"
  | "dang_luan_chuyen"
  | "da_ban_giao"
  | "hoan_thanh"

export const TRANSFER_STATUS_CONFIGS: StatusConfig<TransferStatus>[] = [
  { key: "cho_duyet", label: "Chờ duyệt", tone: "warning", icon: <Clock className="size-5" /> },
  { key: "da_duyet", label: "Đã duyệt", tone: "muted", icon: <CheckCheck className="size-5" /> },
  { key: "dang_luan_chuyen", label: "Đang luân chuyển", tone: "default", icon: <Truck className="size-5" /> },
  { key: "da_ban_giao", label: "Đã bàn giao", tone: "muted", icon: <PackageCheck className="size-5" /> },
  { key: "hoan_thanh", label: "Hoàn thành", tone: "success", icon: <CheckCircle className="size-5" /> },
]
