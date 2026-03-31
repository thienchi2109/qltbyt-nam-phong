/**
 * Types, schema, and helper functions for EquipmentDetailDialog
 * @module equipment/_components/EquipmentDetailDialog/EquipmentDetailTypes
 */

import * as React from "react"
import {
  ArrowRightLeft,
  Calendar,
  CheckCircle,
  Settings,
  Trash2,
  Wrench,
} from "lucide-react"
export {
  equipmentFormSchema,
  type EquipmentFormValues,
  type EquipmentStatus,
} from "@/components/equipment-edit/EquipmentEditTypes"

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Returns the appropriate icon for a history event type
 * Used in the history timeline display
 */
export function getHistoryIcon(eventType: string): React.ReactNode {
  switch (eventType) {
    case "Sửa chữa":
      return <Wrench className="h-4 w-4 text-muted-foreground" />
    case "Bảo trì":
    case "Bảo trì định kỳ":
    case "Bảo trì dự phòng":
      return <Settings className="h-4 w-4 text-muted-foreground" />
    case "Luân chuyển":
    case "Luân chuyển nội bộ":
    case "Luân chuyển bên ngoài":
      return <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
    case "Hiệu chuẩn":
    case "Kiểm định":
      return <CheckCircle className="h-4 w-4 text-muted-foreground" />
    case "Thanh lý":
      return <Trash2 className="h-4 w-4 text-muted-foreground" />
    default:
      return <Calendar className="h-4 w-4 text-muted-foreground" />
  }
}

// ============================================================================
// Component Props Interfaces
// ============================================================================

/**
 * User session info needed for RBAC checks
 */
export interface UserSession {
  id: string | number
  role: string
  khoa_phong: string | null
}
