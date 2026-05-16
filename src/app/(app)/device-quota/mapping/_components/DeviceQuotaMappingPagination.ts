"use client"

type CountedEquipmentRow = {
  total_count: number
}

export function getNextPaginationTotalCount({
  donViId,
  equipmentRawData,
  page,
}: {
  donViId: number | null
  equipmentRawData: CountedEquipmentRow[] | undefined
  page: number
}): number | null {
  if (!donViId) return 0
  if (!equipmentRawData) return null
  if (equipmentRawData.length > 0) return equipmentRawData[0]?.total_count ?? 0
  if (page === 1) return 0
  return null
}
