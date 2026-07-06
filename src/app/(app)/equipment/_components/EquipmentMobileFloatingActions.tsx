"use client"

import * as React from "react"
import { FileUp, PlusCircle } from "lucide-react"

import { usePageFloatingAction } from "@/components/shared/floating-actions"

interface EquipmentMobileFloatingActionsProps {
  canCreateEquipment: boolean
  isMobile: boolean
  onAddEquipment: () => void
  onImportEquipment: () => void
}

/** Registers Equipments mobile actions for the shared app-shell floating menu. */
export function EquipmentMobileFloatingActions({
  canCreateEquipment,
  isMobile,
  onAddEquipment,
  onImportEquipment,
}: EquipmentMobileFloatingActionsProps) {
  const actions = React.useMemo(
    () =>
      canCreateEquipment && isMobile
        ? [
            {
              id: "create-equipment-manual",
              label: "Thêm thủ công",
              icon: <PlusCircle aria-hidden="true" />,
              onSelect: onAddEquipment,
            },
            {
              id: "import-equipment-excel",
              label: "Thêm bằng Excel",
              icon: <FileUp aria-hidden="true" />,
              onSelect: onImportEquipment,
            },
          ]
        : null,
    [canCreateEquipment, isMobile, onAddEquipment, onImportEquipment]
  )

  usePageFloatingAction(actions)

  return null
}
