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
 * Cache invalidation contract: the query key is built by
 * `buildActiveRepairRequestQueryKey`, which returns `["repair", "active", id]`.
 * That tuple is prefix-matched by `repairKeys.all = ["repair"]`, so the five
 * existing repair mutations (create, update, assign, complete, delete) which
 * call `invalidateQueries({ queryKey: repairKeys.all })` automatically
 * invalidate this hook's cache without any per-key wiring. The contract is
 * pinned by the prefix tests in
 * `src/lib/__tests__/repair-request-deep-link.test.ts` and the mutation
 * invalidation suite in
 * `src/hooks/__tests__/use-cached-repair.invalidation.test.ts`.
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
