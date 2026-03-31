import { useEquipmentEditUpdate } from "@/components/equipment-edit/useEquipmentEditUpdate"

export function useEquipmentUpdate(...args: Parameters<typeof useEquipmentEditUpdate>) {
  return useEquipmentEditUpdate(...args)
}
