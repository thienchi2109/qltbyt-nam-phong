/**
 * @deprecated This hook is deprecated in favor of useTenantSelection() from
 * @/contexts/TenantSelectionContext which provides centralized facility list
 * via the get_accessible_facilities RPC function.
 *
 * Migration: Use useTenantSelection().facilities instead.
 * @see src/contexts/TenantSelectionContext.tsx
 */

import { useQuery } from "@tanstack/react-query"

import { callRpc } from "@/lib/rpc-client"

export interface TransferFacility {
  id: number
  name: string
}

export const transferFacilityKeys = {
  all: ["transfer_facilities"] as const,
  list: () => [...transferFacilityKeys.all, "list"] as const,
}

const fetchTransferFacilities = async (): Promise<TransferFacility[]> => {
  const result = await callRpc<TransferFacility[]>({
    fn: "get_transfer_request_facilities",
    args: {},
  })
  return result || []
}

export const useTransferFacilities = () => {
  return useQuery<TransferFacility[]>({
    queryKey: transferFacilityKeys.list(),
    queryFn: fetchTransferFacilities,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  })
}
