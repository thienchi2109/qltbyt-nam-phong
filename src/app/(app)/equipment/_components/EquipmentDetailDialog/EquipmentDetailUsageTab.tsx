import { Equipment } from "@/types/database"
import { UsageHistoryTab } from "@/components/usage-history-tab"
import type { EquipmentDataset } from "../../_hooks/equipmentDataset"

interface EquipmentDetailUsageTabProps {
  equipment: Equipment
  equipmentDataset: EquipmentDataset
}

/** Renders usage history for the active equipment dataset. */
export function EquipmentDetailUsageTab({
  equipment,
  equipmentDataset,
}: EquipmentDetailUsageTabProps) {
  return (
    <div className="h-full py-4">
      <UsageHistoryTab equipment={equipment} equipmentDataset={equipmentDataset} />
    </div>
  )
}
