"use client"

import { useQuery } from "@tanstack/react-query"
import {
  equipmentStatusCatalogSchema,
  getActiveEquipmentStatusValues,
} from "@/lib/equipment-status"
import { callRpc } from "@/lib/rpc-client"

/** Stable React Query key for the tenant-independent status catalog. */
export const equipmentStatusCatalogKey = ["equipment-status-catalog"] as const

/** Loads active equipment status metadata for catalog-aware consumers. */
export function useEquipmentStatusCatalog() {
  const query = useQuery({
    queryKey: equipmentStatusCatalogKey,
    queryFn: async () =>
      equipmentStatusCatalogSchema.parse(
        await callRpc<unknown>({ fn: "equipment_status_catalog_list", args: {} })
      ),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 2,
  })
  const activeValues = getActiveEquipmentStatusValues(query.data ?? [])

  return {
    ...query,
    activeValues,
    // Catalog readiness only; consumers must still enforce existing write RBAC.
    canWrite: query.isSuccess && query.fetchStatus === "idle" && activeValues.length > 0,
  }
}
