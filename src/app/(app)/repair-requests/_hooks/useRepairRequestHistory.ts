import { useQuery } from "@tanstack/react-query"

import { callRpc } from "@/lib/rpc-client"

import type { RepairRequestChangeHistory } from "../types"

type ScopeValue = string | number | null | undefined

interface RepairRequestHistoryKeyOptions {
  requestId: number
  tenant: ScopeValue
  role: string | undefined
  diaBan: ScopeValue
}

interface UseRepairRequestHistoryOptions {
  requestId: number | null
  effectiveTenantKey: ScopeValue
  userRole: string | undefined
  userDiaBanId: ScopeValue
  hasUser: boolean
}

export const repairRequestHistoryQueryKeys = {
  root: ["repair_request_change_history"] as const,
  detail: ({ requestId, tenant, role, diaBan }: RepairRequestHistoryKeyOptions) =>
    [
      "repair_request_change_history",
      {
        id: requestId,
        tenant: tenant ?? null,
        role: role ?? null,
        diaBan: diaBan ?? null,
      },
    ] as const,
}

export function useRepairRequestHistory({
  requestId,
  effectiveTenantKey,
  userRole,
  userDiaBanId,
  hasUser,
}: UseRepairRequestHistoryOptions) {
  const enabled = hasUser && requestId !== null

  return useQuery<RepairRequestChangeHistory[]>({
    queryKey:
      requestId === null
        ? repairRequestHistoryQueryKeys.root
        : repairRequestHistoryQueryKeys.detail({
            requestId,
            tenant: effectiveTenantKey,
            role: userRole,
            diaBan: userDiaBanId,
          }),
    queryFn: async ({ signal }) => {
      if (requestId === null) {
        return []
      }

      const data = await callRpc<RepairRequestChangeHistory[] | null>({
        fn: "repair_request_change_history_list",
        args: { p_repair_request_id: requestId },
        signal,
      })

      return Array.isArray(data) ? data : []
    },
    enabled,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
