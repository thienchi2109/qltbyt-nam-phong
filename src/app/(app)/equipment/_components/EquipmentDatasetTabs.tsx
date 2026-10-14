"use client"

import * as React from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EQUIPMENT_DATASET_LABELS, type EquipmentDataset } from "../_hooks/equipmentDataset"

export interface EquipmentDatasetTabsProps {
  dataset: EquipmentDataset
  onDatasetChange: (dataset: EquipmentDataset) => void
  children?: React.ReactNode
}

/** Renders the controlled regular/placed dataset tabs around shared equipment content. */
export function EquipmentDatasetTabs({
  dataset,
  onDatasetChange,
  children,
}: EquipmentDatasetTabsProps) {
  return (
    <Tabs value={dataset} onValueChange={(value) => onDatasetChange(value as EquipmentDataset)}>
      <TabsList className="grid w-full grid-cols-2" aria-label="Phạm vi thiết bị">
        <TabsTrigger value="regular">{EQUIPMENT_DATASET_LABELS.regular}</TabsTrigger>
        <TabsTrigger value="placed">{EQUIPMENT_DATASET_LABELS.placed}</TabsTrigger>
      </TabsList>
      {children}
    </Tabs>
  )
}
