import type { QueryClient } from "@tanstack/react-query"

import type {
  TechnicalConfigurationAssessmentListWireResponse,
  TechnicalConfigurationAssessmentWire,
} from "../assessment-types"
import { listTechnicalConfigurationAssessments } from "../technical-configuration-assessment-rpc"
import { technicalConfigurationAssessmentsQueryKeyPrefix } from "../technical-configuration-query-keys"
import { collectStableTechnicalConfigurationPages } from "../technical-configuration-pagination"

/** Page size used to collect authoritative complete assessment snapshots. */
export const ASSESSMENT_COLLECTION_PAGE_SIZE = 100

const ASSESSMENT_PAGINATION_SNAPSHOT_ERROR = "Assessment pagination snapshot changed during load."

export type TechnicalConfigurationCompleteAssessmentMap = Readonly<
  Record<string, TechnicalConfigurationAssessmentWire>
>

/** Preserves assessments that are newer than an incoming complete snapshot. */
export function selectNewestCompleteAssessmentSnapshot(
  current: TechnicalConfigurationCompleteAssessmentMap | undefined,
  incoming: TechnicalConfigurationCompleteAssessmentMap
): TechnicalConfigurationCompleteAssessmentMap {
  if (current === undefined) return incoming

  return Object.values(current).reduce<TechnicalConfigurationCompleteAssessmentMap>(
    (merged, assessment) => {
      const incomingAssessment = incoming[assessment.criterion_id]
      if (!incomingAssessment || assessment.revision > incomingAssessment.revision) {
        return {
          ...merged,
          [assessment.criterion_id]: assessment,
        }
      }
      return merged
    },
    incoming
  )
}

/** Collects a stable complete assessment snapshot keyed by criterion ID. */
export async function collectTechnicalConfigurationAssessments(
  comparisonSetId: string,
  signal?: AbortSignal
): Promise<TechnicalConfigurationCompleteAssessmentMap> {
  const { items } = await collectStableTechnicalConfigurationPages<
    TechnicalConfigurationAssessmentWire,
    TechnicalConfigurationAssessmentListWireResponse
  >({
    loadPage: async (page) => {
      const response = await listTechnicalConfigurationAssessments(
        {
          p_comparison_set_id: comparisonSetId,
          p_page: page,
          p_page_size: ASSESSMENT_COLLECTION_PAGE_SIZE,
        },
        signal
      )
      if (response.page !== page || response.page_size !== ASSESSMENT_COLLECTION_PAGE_SIZE) {
        throw new Error(ASSESSMENT_PAGINATION_SNAPSHOT_ERROR)
      }
      return response
    },
    snapshotError: ASSESSMENT_PAGINATION_SNAPSHOT_ERROR,
    getItemKey: (item) => item.criterion_id,
  })

  return Object.fromEntries(items.map((item) => [item.criterion_id, item]))
}

/** Updates an existing authoritative complete cache with a saved assessment. */
export function adoptCompleteAssessment(
  queryClient: QueryClient,
  comparisonSetId: string,
  assessment: TechnicalConfigurationAssessmentWire
): void {
  const completeQueryKey = [
    ...technicalConfigurationAssessmentsQueryKeyPrefix(comparisonSetId),
    "complete",
  ] as const
  queryClient.setQueryData<TechnicalConfigurationCompleteAssessmentMap>(
    completeQueryKey,
    (current) => {
      if (current === undefined) return undefined
      const cachedAssessment = current[assessment.criterion_id]
      if (cachedAssessment && cachedAssessment.revision > assessment.revision) return current

      return {
        ...current,
        [assessment.criterion_id]: assessment,
      }
    }
  )
}

/** Ensures a complete cache is available and reports whether loading succeeded. */
export async function loadKnownAbsentCompleteAssessments(
  queryClient: QueryClient,
  comparisonSetId: string
): Promise<boolean> {
  const completeQueryKey = [
    ...technicalConfigurationAssessmentsQueryKeyPrefix(comparisonSetId),
    "complete",
  ] as const
  if (queryClient.getQueryData(completeQueryKey) !== undefined) return true

  try {
    await queryClient.fetchQuery<TechnicalConfigurationCompleteAssessmentMap>({
      queryKey: completeQueryKey,
      queryFn: ({ signal }) => collectTechnicalConfigurationAssessments(comparisonSetId, signal),
      staleTime: 30_000,
      retry: false,
      structuralSharing: (current, incoming) =>
        selectNewestCompleteAssessmentSnapshot(
          current as TechnicalConfigurationCompleteAssessmentMap | undefined,
          incoming as TechnicalConfigurationCompleteAssessmentMap
        ),
    })
    return true
  } catch {
    // Persistence may continue, but a failed snapshot is never promoted to authoritative.
    return false
  }
}
