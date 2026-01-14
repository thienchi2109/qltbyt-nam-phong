"use client"

import * as React from "react"
import { EquipmentDialogContext } from "../_components/EquipmentDialogContext"

export function useEquipmentContext() {
  const context = React.useContext(EquipmentDialogContext)
  if (!context) {
    throw new Error("useEquipmentContext must be used within EquipmentDialogProvider")
  }
  return context
}
