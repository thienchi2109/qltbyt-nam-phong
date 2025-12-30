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
