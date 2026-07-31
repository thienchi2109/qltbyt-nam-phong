"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"

import type {
  TechnicalConfigurationReferenceRankingItemWire,
  TechnicalConfigurationReferenceRankingPageWireResponse,
  TechnicalConfigurationReferenceRankingSnapshot,
} from "../reference-ranking-types"
import { technicalConfigurationReferenceRankingQueryKey } from "../technical-configuration-query-keys"
import { collectStableTechnicalConfigurationPages } from "../technical-configuration-pagination"
import { listTechnicalConfigurationReferenceRanking } from "../technical-configuration-reference-ranking-rpc"

const REFERENCE_RANKING_PAGE_SIZE = 100
const REFERENCE_RANKING_SNAPSHOT_ERROR =
  "Reference ranking pagination snapshot changed during load."
const RANKING_PAGE_KEYS = [
  "data",
  "dossier_id",
  "baseline_version_id",
  "snapshot_token",
  "total",
  "page",
  "page_size",
] as const
const RANKING_ITEM_KEYS = [
  "option_id",
  "supplier_id",
  "supplier_name",
  "display_label",
  "eligibility",
  "incomplete_criterion_count",
  "failed_count",
  "insufficient_evidence_count",
  "exceeds_count",
  "rank",
] as const

export type TechnicalConfigurationReferenceRankingInput = {
  dossierId: string
  baselineVersionId: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0
}

function isValidRankingItem(
  value: unknown
): value is TechnicalConfigurationReferenceRankingItemWire {
  if (!isRecord(value) || !hasExactKeys(value, RANKING_ITEM_KEYS)) return false
  if (
    !isNonEmptyString(value.option_id) ||
    !isNonEmptyString(value.supplier_id) ||
    !isNonEmptyString(value.supplier_name) ||
    !isNonEmptyString(value.display_label) ||
    !isNonNegativeInteger(value.incomplete_criterion_count) ||
    !isNonNegativeInteger(value.failed_count) ||
    !isNonNegativeInteger(value.insufficient_evidence_count) ||
    !isNonNegativeInteger(value.exceeds_count)
  ) {
    return false
  }

  if (value.eligibility === "eligible") {
    return value.incomplete_criterion_count === 0 && isPositiveInteger(value.rank)
  }

  return (
    value.eligibility === "incomplete" &&
    value.incomplete_criterion_count > 0 &&
    value.rank === null
  )
}

function assertValidRankingPage(
  value: unknown,
  input: TechnicalConfigurationReferenceRankingInput,
  expectedPage: number
): asserts value is TechnicalConfigurationReferenceRankingPageWireResponse {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, RANKING_PAGE_KEYS) ||
    !Array.isArray(value.data) ||
    !value.data.every(isValidRankingItem) ||
    value.data.length > REFERENCE_RANKING_PAGE_SIZE ||
    value.dossier_id !== input.dossierId ||
    value.baseline_version_id !== input.baselineVersionId ||
    !isNonEmptyString(value.snapshot_token) ||
    !isNonNegativeInteger(value.total) ||
    value.page !== expectedPage ||
    value.page_size !== REFERENCE_RANKING_PAGE_SIZE
  ) {
    throw new Error(REFERENCE_RANKING_SNAPSHOT_ERROR)
  }
}

async function collectTechnicalConfigurationReferenceRanking(
  input: TechnicalConfigurationReferenceRankingInput,
  signal?: AbortSignal
): Promise<TechnicalConfigurationReferenceRankingSnapshot> {
  const { items, firstPage } = await collectStableTechnicalConfigurationPages<
    TechnicalConfigurationReferenceRankingItemWire,
    TechnicalConfigurationReferenceRankingPageWireResponse
  >({
    loadPage: async (page) => {
      const response: unknown = await listTechnicalConfigurationReferenceRanking(
        {
          p_dossier_id: input.dossierId,
          p_baseline_version_id: input.baselineVersionId,
          p_page: page,
          p_page_size: REFERENCE_RANKING_PAGE_SIZE,
        },
        signal
      )
      assertValidRankingPage(response, input, page)
      return response
    },
    snapshotError: REFERENCE_RANKING_SNAPSHOT_ERROR,
    getItemKey: (item) => item.option_id,
    isSameSnapshot: (first, next) =>
      first.dossier_id === next.dossier_id &&
      first.baseline_version_id === next.baseline_version_id &&
      first.snapshot_token === next.snapshot_token &&
      first.page_size === next.page_size,
  })

  return {
    data: items,
    dossier_id: firstPage.dossier_id,
    baseline_version_id: firstPage.baseline_version_id,
    snapshot_token: firstPage.snapshot_token,
    total: firstPage.total,
  }
}

/** Exposes explicit, cache-backed loading without automatically requesting ranking. */
export function useTechnicalConfigurationReferenceRanking() {
  const queryClient = useQueryClient()
  const loadRanking = React.useCallback(
    (input: TechnicalConfigurationReferenceRankingInput) =>
      queryClient.fetchQuery({
        queryKey: technicalConfigurationReferenceRankingQueryKey(input),
        queryFn: ({ signal }) => collectTechnicalConfigurationReferenceRanking(input, signal),
        staleTime: 0,
        retry: false,
      }),
    [queryClient]
  )

  return { loadRanking }
}
