import { collectStableTechnicalConfigurationPages } from "./technical-configuration-pagination"
import {
  getTechnicalConfigurationResultExportManifest,
  listTechnicalConfigurationResultExportCriterionAxis,
  listTechnicalConfigurationResultExportMatrix,
  listTechnicalConfigurationResultExportOptionAxis,
  listTechnicalConfigurationResultExportRanking,
  TechnicalConfigurationResultExportError,
} from "./technical-configuration-result-export-rpc"
import type {
  TechnicalConfigurationResultExportCriterionAxisItemWire,
  TechnicalConfigurationResultExportDataset,
  TechnicalConfigurationResultExportManifestWire,
  TechnicalConfigurationResultExportMatrixCellWire,
  TechnicalConfigurationResultExportMatrixPageWireResponse,
  TechnicalConfigurationResultExportOptionAxisItemWire,
  TechnicalConfigurationResultExportPageWireResponse,
  TechnicalConfigurationResultExportRankingItemWire,
  TechnicalConfigurationResultExportRankingPageWireResponse,
  TechnicalConfigurationResultExportRequest,
  TechnicalConfigurationResultExportScopeRpcArgs,
} from "./technical-configuration-result-export-types"

export type {
  TechnicalConfigurationResultExportDataset,
  TechnicalConfigurationResultExportCriterionAxisItemWire,
  TechnicalConfigurationResultExportCriterionAxisPageWireResponse,
  TechnicalConfigurationResultExportDocumentLinkWire,
  TechnicalConfigurationResultExportManifestWire,
  TechnicalConfigurationResultExportManifestWireResponse,
  TechnicalConfigurationResultExportMatrixCellWire,
  TechnicalConfigurationResultExportMatrixPageWireResponse,
  TechnicalConfigurationResultExportMode,
  TechnicalConfigurationResultExportOptionAxisItemWire,
  TechnicalConfigurationResultExportOptionAxisPageWireResponse,
  TechnicalConfigurationResultExportPageRpcArgs,
  TechnicalConfigurationResultExportRankingItemWire,
  TechnicalConfigurationResultExportRankingPageWireResponse,
  TechnicalConfigurationResultExportRequest,
  TechnicalConfigurationResultExportScopeRpcArgs,
} from "./technical-configuration-result-export-types"

const AXIS_PAGE_SIZE = 100
const RANKING_PAGE_SIZE = 100
const MATRIX_PAGE_SIZE = 1000

function snapshotChanged(): TechnicalConfigurationResultExportError {
  return new TechnicalConfigurationResultExportError(
    "snapshot_changed",
    "Result export snapshot changed during collection."
  )
}

function isAbortError(error: unknown): error is DOMException {
  return error instanceof DOMException && error.name === "AbortError"
}

function sameTokens(
  page: {
    snapshot_token: string
    ranking_snapshot_token: string
  },
  manifest: TechnicalConfigurationResultExportManifestWire
) {
  return (
    page.snapshot_token === manifest.snapshot_token &&
    page.ranking_snapshot_token === manifest.ranking_snapshot_token
  )
}

function sameStringSet(actual: Iterable<string>, expected: readonly string[]) {
  const actualSet = new Set(actual)
  const expectedSet = new Set(expected)
  return (
    actualSet.size === expectedSet.size && [...actualSet].every((value) => expectedSet.has(value))
  )
}

function sameStringOrder(actual: readonly string[], expected: readonly string[]) {
  return (
    actual.length === expected.length && actual.every((value, index) => value === expected[index])
  )
}

function sameManifest(
  first: TechnicalConfigurationResultExportManifestWire,
  final: TechnicalConfigurationResultExportManifestWire
) {
  return (
    first.dossier.id === final.dossier.id &&
    first.dossier.device_type_name === final.dossier.device_type_name &&
    first.dossier.name === final.dossier.name &&
    first.dossier.revision === final.dossier.revision &&
    first.dossier.archived_at === final.dossier.archived_at &&
    first.baseline_version.id === final.baseline_version.id &&
    first.baseline_version.dossier_id === final.baseline_version.dossier_id &&
    first.baseline_version.version_number === final.baseline_version.version_number &&
    first.baseline_version.status === final.baseline_version.status &&
    first.baseline_version.revision === final.baseline_version.revision &&
    first.baseline_version.locked_at === final.baseline_version.locked_at &&
    first.option_total === final.option_total &&
    first.criterion_total === final.criterion_total &&
    first.snapshot_token === final.snapshot_token &&
    first.ranking_snapshot_token === final.ranking_snapshot_token
  )
}

function freezeManifest(manifest: TechnicalConfigurationResultExportManifestWire) {
  return Object.freeze({
    ...manifest,
    dossier: Object.freeze({ ...manifest.dossier }),
    baseline_version: Object.freeze({ ...manifest.baseline_version }),
  })
}

function freezeItems<TItem extends object>(items: readonly TItem[]) {
  for (const item of items) Object.freeze(item)
  return Object.freeze(items)
}

function freezeMatrixItems(items: readonly TechnicalConfigurationResultExportMatrixCellWire[]) {
  for (const item of items) {
    for (const link of item.document_links) Object.freeze(link)
    Object.freeze(item.document_links)
    Object.freeze(item)
  }
  return Object.freeze(items)
}

async function collectAxis<TItem extends object>(
  loadPage: (page: number) => Promise<TechnicalConfigurationResultExportPageWireResponse<TItem>>,
  manifest: TechnicalConfigurationResultExportManifestWire,
  expectedTotal: number,
  expectedIds: readonly string[] | null,
  getItemKey: (item: TItem) => string,
  label: string,
  signal?: AbortSignal
) {
  try {
    const { items } = await collectStableTechnicalConfigurationPages<
      TItem,
      TechnicalConfigurationResultExportPageWireResponse<TItem>
    >({
      loadPage: async (page) => {
        const response = await loadPage(page)
        if (response.total !== expectedTotal || !sameTokens(response, manifest)) {
          throw snapshotChanged()
        }
        return response
      },
      snapshotError: `Result export ${label} snapshot changed.`,
      getItemKey,
      isSameSnapshot: (first, next) =>
        first.snapshot_token === next.snapshot_token &&
        first.ranking_snapshot_token === next.ranking_snapshot_token,
    })
    if (expectedIds !== null && !sameStringOrder(items.map(getItemKey), expectedIds)) {
      throw snapshotChanged()
    }
    return freezeItems(items)
  } catch (error) {
    if (signal?.aborted) throw signal.reason
    if (error instanceof TechnicalConfigurationResultExportError || isAbortError(error)) throw error
    throw snapshotChanged()
  }
}

async function collectRanking(
  scope: TechnicalConfigurationResultExportScopeRpcArgs,
  manifest: TechnicalConfigurationResultExportManifestWire,
  signal?: AbortSignal
) {
  try {
    const { items } = await collectStableTechnicalConfigurationPages<
      TechnicalConfigurationResultExportRankingItemWire,
      TechnicalConfigurationResultExportRankingPageWireResponse
    >({
      loadPage: async (page) => {
        const response = await listTechnicalConfigurationResultExportRanking(
          { ...scope, p_page: page, p_page_size: RANKING_PAGE_SIZE },
          signal
        )
        if (response.total !== manifest.option_total || !sameTokens(response, manifest)) {
          throw snapshotChanged()
        }
        return response
      },
      snapshotError: "Result export ranking snapshot changed.",
      getItemKey: (item) => item.option_id,
      isSameSnapshot: (first, next) =>
        first.snapshot_token === next.snapshot_token &&
        first.ranking_snapshot_token === next.ranking_snapshot_token,
    })
    if (
      scope.p_option_ids !== null &&
      !sameStringSet(
        items.map((item) => item.option_id),
        scope.p_option_ids
      )
    ) {
      throw snapshotChanged()
    }
    return freezeItems(items)
  } catch (error) {
    if (signal?.aborted) throw signal.reason
    if (error instanceof TechnicalConfigurationResultExportError || isAbortError(error)) throw error
    throw snapshotChanged()
  }
}

function validateMatrixKeys(
  items: readonly TechnicalConfigurationResultExportMatrixCellWire[],
  manifest: TechnicalConfigurationResultExportManifestWire,
  scope: TechnicalConfigurationResultExportScopeRpcArgs
) {
  if (items.length === 0 && manifest.option_total * manifest.criterion_total === 0) return
  const optionIds = items.map((item) => item.option_id)
  const criterionIds = items.map((item) => item.criterion_id)
  if (
    new Set(optionIds).size !== manifest.option_total ||
    new Set(criterionIds).size !== manifest.criterion_total ||
    (scope.p_option_ids !== null && !sameStringSet(optionIds, scope.p_option_ids)) ||
    (scope.p_criterion_ids !== null && !sameStringSet(criterionIds, scope.p_criterion_ids))
  ) {
    throw snapshotChanged()
  }
}

async function collectMatrix(
  scope: TechnicalConfigurationResultExportScopeRpcArgs,
  manifest: TechnicalConfigurationResultExportManifestWire,
  signal?: AbortSignal
) {
  const expectedTotal = manifest.option_total * manifest.criterion_total
  if (!Number.isSafeInteger(expectedTotal)) throw snapshotChanged()
  try {
    const { items } = await collectStableTechnicalConfigurationPages<
      TechnicalConfigurationResultExportMatrixCellWire,
      TechnicalConfigurationResultExportMatrixPageWireResponse
    >({
      loadPage: async (page) => {
        const response = await listTechnicalConfigurationResultExportMatrix(
          { ...scope, p_page: page, p_page_size: MATRIX_PAGE_SIZE },
          signal
        )
        if (response.total !== expectedTotal || !sameTokens(response, manifest)) {
          throw snapshotChanged()
        }
        return response
      },
      snapshotError: "Result export matrix snapshot changed.",
      getItemKey: (item) => `${item.criterion_id}:${item.option_id}`,
      isSameSnapshot: (first, next) =>
        first.snapshot_token === next.snapshot_token &&
        first.ranking_snapshot_token === next.ranking_snapshot_token,
    })
    validateMatrixKeys(items, manifest, scope)
    return freezeMatrixItems(items)
  } catch (error) {
    if (signal?.aborted) throw signal.reason
    if (error instanceof TechnicalConfigurationResultExportError || isAbortError(error)) throw error
    throw snapshotChanged()
  }
}

/** Collects one complete stable result-export dataset without mounting UI state. */
export async function collectTechnicalConfigurationResultExportDataset(
  request: TechnicalConfigurationResultExportRequest
): Promise<TechnicalConfigurationResultExportDataset> {
  const scope = {
    p_dossier_id: request.dossierId,
    p_baseline_version_id: request.baselineVersionId,
    p_option_ids: request.optionIds,
    p_criterion_ids: request.criterionIds,
  } satisfies TechnicalConfigurationResultExportScopeRpcArgs
  const firstManifest = (await getTechnicalConfigurationResultExportManifest(scope, request.signal))
    .data
  const [optionAxis, criterionAxis] = await Promise.all([
    collectAxis<TechnicalConfigurationResultExportOptionAxisItemWire>(
      (page) =>
        listTechnicalConfigurationResultExportOptionAxis(
          { ...scope, p_page: page, p_page_size: AXIS_PAGE_SIZE },
          request.signal
        ),
      firstManifest,
      firstManifest.option_total,
      scope.p_option_ids,
      (item) => item.option_id,
      "option axis",
      request.signal
    ),
    collectAxis<TechnicalConfigurationResultExportCriterionAxisItemWire>(
      (page) =>
        listTechnicalConfigurationResultExportCriterionAxis(
          { ...scope, p_page: page, p_page_size: AXIS_PAGE_SIZE },
          request.signal
        ),
      firstManifest,
      firstManifest.criterion_total,
      scope.p_criterion_ids,
      (item) => item.criterion_id,
      "criterion axis",
      request.signal
    ),
  ])
  const ranking =
    request.mode === "detailed_matrix_only"
      ? null
      : await collectRanking(scope, firstManifest, request.signal)
  const matrix =
    request.mode === "ranking_only"
      ? null
      : await collectMatrix(scope, firstManifest, request.signal)
  const finalManifest = (await getTechnicalConfigurationResultExportManifest(scope, request.signal))
    .data
  if (!sameManifest(firstManifest, finalManifest)) throw snapshotChanged()

  return Object.freeze({
    mode: request.mode,
    manifest: freezeManifest(firstManifest),
    optionAxis,
    criterionAxis,
    ranking,
    matrix,
  }) as TechnicalConfigurationResultExportDataset
}
