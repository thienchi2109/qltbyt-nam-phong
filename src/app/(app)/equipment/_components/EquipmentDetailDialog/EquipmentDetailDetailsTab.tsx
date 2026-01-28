/**
 * Details tab for equipment detail dialog
 * Displays equipment fields in view mode or edit form
 * @module equipment/_components/EquipmentDetailDialog/EquipmentDetailDetailsTab
 */

"use client"

import * as React from "react"
import { AlertTriangle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  columnLabels,
  getStatusVariant,
  getClassificationVariant,
} from "@/components/equipment/equipment-table-columns"
import {
  isSuspiciousDate,
  SUSPICIOUS_DATE_WARNING,
  TEXT_DATE_FIELDS,
} from "@/lib/date-utils"
import type { Equipment } from "@/types/database"

export interface EquipmentDetailDetailsTabProps {
  /** Equipment data to display (merged with savedValues for optimistic updates) */
  displayEquipment: Equipment
  /** Whether the tab is in editing mode */
  isEditing: boolean
  /** Children to render when in edit mode (the edit form) */
  children?: React.ReactNode
}

/**
 * Renders a single field value with appropriate formatting
 */
function FieldValue({
  fieldKey,
  value,
}: {
  fieldKey: keyof Equipment
  value: Equipment[keyof Equipment]
}): React.ReactNode {
  // Status badge
  if (fieldKey === "tinh_trang_hien_tai") {
    const statusValue = value as Equipment["tinh_trang_hien_tai"]
    return statusValue ? (
      <Badge variant={getStatusVariant(statusValue)}>{statusValue}</Badge>
    ) : (
      <div className="italic text-muted-foreground">Chưa có dữ liệu</div>
    )
  }

  // Classification badge
  if (fieldKey === "phan_loai_theo_nd98") {
    const classification = value as Equipment["phan_loai_theo_nd98"]
    return classification ? (
      <Badge variant={getClassificationVariant(classification)}>
        {classification.trim()}
      </Badge>
    ) : (
      <div className="italic text-muted-foreground">Chưa có dữ liệu</div>
    )
  }

  // Price formatting
  if (fieldKey === "gia_goc") {
    return value ? (
      <>{`${Number(value).toLocaleString()} đ`}</>
    ) : (
      <div className="italic text-muted-foreground">Chưa có dữ liệu</div>
    )
  }

  // Text date fields with suspicious date warning
  if (TEXT_DATE_FIELDS.has(fieldKey)) {
    if (value === null || value === undefined || value === "") {
      return <div className="italic text-muted-foreground">Chưa có dữ liệu</div>
    }
    const dateStr = String(value)
    if (isSuspiciousDate(dateStr)) {
      return (
        <div className="flex items-center gap-2">
          <span>{dateStr}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center">
                  <AlertTriangle
                    className="h-4 w-4 text-amber-500 cursor-help"
                    aria-hidden="true"
                  />
                  <span className="sr-only">{SUSPICIOUS_DATE_WARNING}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>{SUSPICIOUS_DATE_WARNING}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )
    }
    return <>{dateStr}</>
  }

  // Default: empty or string value
  if (value === null || value === undefined || value === "") {
    return <div className="italic text-muted-foreground">Chưa có dữ liệu</div>
  }
  return <>{String(value)}</>
}

export function EquipmentDetailDetailsTab({
  displayEquipment,
  isEditing,
  children,
}: EquipmentDetailDetailsTabProps): React.ReactNode {
  if (isEditing) {
    // Render edit form passed as children
    return <>{children}</>
  }

  // View mode: display all fields
  return (
    <ScrollArea className="h-full pr-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 py-4">
        {(Object.keys(columnLabels) as Array<keyof Equipment>).map((key) => {
          if (key === "id") return null

          return (
            <div key={key} className="border-b pb-2">
              <p className="text-xs font-medium text-muted-foreground">
                {columnLabels[key]}
              </p>
              <div className="font-semibold break-words">
                <FieldValue fieldKey={key} value={displayEquipment[key]} />
              </div>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}
