"use client"

import { useQuery } from "@tanstack/react-query"

import { getUnknownErrorMessage } from "@/lib/error-utils"
import { isGlobalRole, isRegionalLeaderRole } from "@/lib/rbac"
import { callRpc } from "@/lib/rpc-client"

import type {
  EquipmentAggregateSearchData,
  EquipmentAggregateSearchGroupBy,
  EquipmentAggregateSearchRequest,
  EquipmentAggregateSearchRpcArgs,
} from "./use-equipment-aggregate-search.types"

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100
const EMPTY_EQUIPMENT_AGGREGATE_SEARCH: EquipmentAggregateSearchData = {
  rows: [],
  summary: {
    totalEquipmentCount: 0,
    regionCount: 0,
    facilityCount: 0,
    query: "",
    scopeLabel: "",
  },
}

export interface UseEquipmentAggregateSearchParams extends EquipmentAggregateSearchRequest {
  role: string | null | undefined
}

/** Returns true when the current role can use the aggregate equipment search UI/data layer. */
export function canUseEquipmentAggregateSearch(role: string | null | undefined): boolean {
  return isGlobalRole(role) || isRegionalLeaderRole(role)
}

/** Converts aggregate-search query errors into a stable Vietnamese UI message. */
export function normalizeEquipmentAggregateSearchError(error: unknown): string {
  return getUnknownErrorMessage(error, "Không thể tải kết quả tìm kiếm thiết bị")
}

/** Builds the stable TanStack Query key for Reports equipment aggregate search. */
export function buildEquipmentAggregateSearchQueryKey(params: UseEquipmentAggregateSearchParams) {
  const limit = normalizeEquipmentAggregateSearchLimit(params.limit)

  return [
    "reports",
    "equipment-aggregate-search",
    {
      query: params.query.trim(),
      groupBy: params.groupBy,
      role: params.role ?? null,
      regionId: params.regionId ?? null,
      limit,
    },
  ] as const
}

function normalizeEquipmentAggregateSearchLimit(limit: number | null | undefined): number {
  if (limit === null || limit === undefined) {
    return DEFAULT_LIMIT
  }

  if (!Number.isFinite(limit)) {
    return DEFAULT_LIMIT
  }

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT)
}

function buildEquipmentAggregateSearchRpcArgs(
  params: UseEquipmentAggregateSearchParams
): EquipmentAggregateSearchRpcArgs {
  return {
    p_query: params.query.trim(),
    p_group_by: params.groupBy,
    p_region_id: params.regionId ?? null,
    p_limit: normalizeEquipmentAggregateSearchLimit(params.limit),
  }
}

/** Fetches grouped equipment aggregate search data for the Reports equipment-search tab. */
export function useEquipmentAggregateSearch(params: UseEquipmentAggregateSearchParams) {
  const trimmedQuery = params.query.trim()
  const enabled = trimmedQuery.length > 0 && canUseEquipmentAggregateSearch(params.role)

  return useQuery({
    queryKey: buildEquipmentAggregateSearchQueryKey(params),
    queryFn: async ({ signal }) => {
      return callRpc<EquipmentAggregateSearchData, EquipmentAggregateSearchRpcArgs>({
        fn: "equipment_aggregate_search",
        args: buildEquipmentAggregateSearchRpcArgs(params),
        signal,
      })
    },
    enabled,
    placeholderData: (previousData) =>
      enabled
        ? (previousData ?? EMPTY_EQUIPMENT_AGGREGATE_SEARCH)
        : EMPTY_EQUIPMENT_AGGREGATE_SEARCH,
    staleTime: 60_000,
  })
}

export type { EquipmentAggregateSearchGroupBy }
