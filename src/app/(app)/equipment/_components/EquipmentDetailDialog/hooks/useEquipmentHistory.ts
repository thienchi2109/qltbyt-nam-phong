/**
 * Custom hook for fetching equipment history timeline
 * @module equipment/_components/EquipmentDetailDialog/hooks/useEquipmentHistory
 */

import { useQuery } from "@tanstack/react-query"
import { callRpc } from "@/lib/rpc-client"
import type { HistoryItem } from "@/app/(app)/equipment/types"
import { equipmentDetailQueryKeys } from "@/app/(app)/equipment/types"

interface UseEquipmentHistoryOptions {
  equipmentId: number | undefined
  enabled?: boolean
}

interface UseEquipmentHistoryReturn {
  history: HistoryItem[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Fetches equipment history timeline from the database
 *
 * @param options.equipmentId - The equipment ID to fetch history for
 * @param options.enabled - Whether the query should be enabled (default: true when equipmentId exists)
 * @returns History items, loading state, and refetch function
 */
export function useEquipmentHistory({
  equipmentId,
  enabled = true,
}: UseEquipmentHistoryOptions): UseEquipmentHistoryReturn {
  const query = useQuery({
    queryKey: equipmentDetailQueryKeys.history(equipmentId),
    queryFn: async () => {
      const data = await callRpc<HistoryItem[]>({
        fn: "equipment_history_list",
        args: { p_thiet_bi_id: equipmentId! },
      })
      return data || []
    },
    enabled: !!equipmentId && enabled,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  })

  return {
    history: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}
