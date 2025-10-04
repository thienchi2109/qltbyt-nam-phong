import { Equipment } from "@/types/database";

export interface FacilityOption {
  id: number;
  name: string;
  count: number;
  code?: string; // Optional facility code for display
}

/**
 * Extracts unique facilities from equipment data with item counts
 * Used for client-side tenant filtering dropdown
 */
export function extractFacilitiesFromEquipment(
  equipment: Equipment[]
): FacilityOption[] {
  const facilityMap = new Map<number, { name: string; count: number }>();

  equipment.forEach((item) => {
    if (!item.don_vi) return;

    // Extract facility name from the don_vi_name field
    // The equipment data includes don_vi_name via LEFT JOIN with don_vi table in equipment_list_enhanced RPC
    const facilityName = (item as any).don_vi_name || `Cơ sở ${item.don_vi}`;
    
    const existing = facilityMap.get(item.don_vi);
    if (existing) {
      existing.count++;
    } else {
      facilityMap.set(item.don_vi, {
        name: facilityName,
        count: 1,
      });
    }
  });

  return Array.from(facilityMap.entries())
    .map(([id, data]) => ({
      id,
      name: data.name,
      count: data.count,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

/**
 * Filters equipment by facility ID
 * Returns all equipment if facilityId is null
 */
export function filterEquipmentByFacility(
  equipment: Equipment[],
  facilityId: number | null
): Equipment[] {
  if (facilityId === null) return equipment;
  return equipment.filter((item) => item.don_vi === facilityId);
}