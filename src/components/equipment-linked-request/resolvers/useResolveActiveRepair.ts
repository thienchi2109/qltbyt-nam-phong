import { useQuery } from '@tanstack/react-query'
import { callRpc } from '@/lib/rpc-client'
import { buildActiveRepairRequestQueryKey } from '@/lib/repair-request-deep-link'
import type { ActiveRepairResult } from '../types'

export type UseResolveActiveRepairOptions = {
  equipmentId: number | null
  enabled: boolean
}

/**
 * Phase 1 resolver — fetches the active repair request for one equipment via
 * the dedicated RPC. Caller is responsible for status-gating; this hook only
 * checks the trivial `equipmentId != null` precondition.
 *
 * Mutations elsewhere (create/update/assign/complete/delete) all invalidate
 * `repairKeys.all`, which subsumes this query's key.
 */
export function useResolveActiveRepair(opts: UseResolveActiveRepairOptions) {
  return useQuery<ActiveRepairResult>({
    queryKey: buildActiveRepairRequestQueryKey(opts.equipmentId),
    queryFn: ({ signal }) =>
      callRpc<ActiveRepairResult>({
        fn: 'repair_request_active_for_equipment',
        args: { p_thiet_bi_id: opts.equipmentId! },
        signal,
      }),
    enabled: opts.enabled && opts.equipmentId !== null,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}
