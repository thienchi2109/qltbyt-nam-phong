import { Equipment } from "@/types/database"
import { UsageHistoryTab } from "@/components/usage-history-tab"

interface EquipmentDetailUsageTabProps {
  equipment: Equipment
}

export function EquipmentDetailUsageTab({ equipment }: EquipmentDetailUsageTabProps) {
  return (
    <div className="h-full py-4">
      <UsageHistoryTab equipment={equipment} />
    </div>
  )
}
