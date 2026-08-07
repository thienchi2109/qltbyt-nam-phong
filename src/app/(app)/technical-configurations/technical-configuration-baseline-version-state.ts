import type { InfiniteData } from "@tanstack/react-query"

import {
  decodeTechnicalConfigurationBaselineDraftCreateWireResponse,
  decodeTechnicalConfigurationBaselineDraftWire,
  decodeTechnicalConfigurationBaselineVersionsListWireResponse,
} from "./technical-configuration-baseline-decoders"
import type {
  TechnicalConfigurationBaselineDecodedDraft,
  TechnicalConfigurationBaselineDecodedVersionsListWireResponse,
  TechnicalConfigurationBaselineDraftCreateWireResponse,
  TechnicalConfigurationBaselineDraftWire,
  TechnicalConfigurationBaselineVersionsListWireResponse,
} from "./baseline-types"

/** Maximum number of baseline versions requested per history page. */
export const BASELINE_VERSION_PAGE_SIZE = 100
/** Stable empty value used when version history has not loaded. */
export const EMPTY_BASELINE_VERSIONS: TechnicalConfigurationBaselineDecodedDraft[] = []

export type TechnicalConfigurationBaselineVersionPages = InfiniteData<
  TechnicalConfigurationBaselineDecodedVersionsListWireResponse,
  number
>

const BASELINE_VERSION_HISTORY_INCOMPLETE = "baseline_version_history_incomplete"

/** Returns whether an RPC error represents a recoverable baseline lifecycle conflict. */
export function isTechnicalConfigurationBaselineConflict(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const metadata = error as Error & { code?: unknown; status?: unknown }
  return (
    (metadata.status === 409 || metadata.code === "PT409") &&
    (error.message === "stale_revision" ||
      error.message === "locked_version" ||
      error.message === "draft_already_exists")
  )
}

/** Extracts an RPC error message while preserving a caller-provided fallback. */
export function getTechnicalConfigurationBaselineErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (!(error instanceof Error) || !error.message) return fallback
  return error.message === BASELINE_VERSION_HISTORY_INCOMPLETE ? fallback : error.message
}

/** Returns a localized blocking error only when no cached history remains usable. */
export function getTechnicalConfigurationBaselineQueryError(
  isError: boolean,
  error: unknown,
  hasVersions: boolean
): string | null {
  if (!isError || hasVersions) return null
  return getTechnicalConfigurationBaselineErrorMessage(error, "Không thể tải cấu hình cơ sở.")
}

/** Rejects a history response whose reported total cannot contain the returned page. */
export function validateTechnicalConfigurationBaselineVersionPage(
  response: TechnicalConfigurationBaselineVersionsListWireResponse,
  precedingPages: TechnicalConfigurationBaselineVersionsListWireResponse[] = []
): TechnicalConfigurationBaselineDecodedVersionsListWireResponse {
  const decodedResponse = decodeTechnicalConfigurationBaselineVersionsListWireResponse(response)
  const decodedPrecedingPages = precedingPages.map((page) =>
    decodeTechnicalConfigurationBaselineVersionsListWireResponse(page)
  )
  const pageStartOffset = (decodedResponse.page - 1) * decodedResponse.page_size
  const loadedVersionIds = new Set(
    [...decodedPrecedingPages, decodedResponse].flatMap((page) =>
      page.data.map((version) => version.id)
    )
  )
  const reachedReportedEnd =
    decodedResponse.page * decodedResponse.page_size >= decodedResponse.total
  if (
    (decodedResponse.data.length === 0 && pageStartOffset < decodedResponse.total) ||
    (reachedReportedEnd && loadedVersionIds.size < decodedResponse.total)
  ) {
    throw new Error(BASELINE_VERSION_HISTORY_INCOMPLETE)
  }
  return decodedResponse
}

/** Returns the first-draft creation error visible to the empty state. */
export function getTechnicalConfigurationBaselineCreateError(
  isError: boolean,
  isConflict: boolean,
  lifecycleError: string | null
): string | null {
  if (!isError) return null
  if (lifecycleError) return lifecycleError
  return isConflict
    ? "Dữ liệu hồ sơ đã thay đổi. Trạng thái mới đã được tải; vui lòng thử lại."
    : "Không thể khởi tạo bản nháp."
}

/** Separates a newly created version snapshot from its dossier revision metadata. */
export function splitTechnicalConfigurationBaselineCreatedVersion(
  data: TechnicalConfigurationBaselineDraftCreateWireResponse["data"]
): { version: TechnicalConfigurationBaselineDecodedDraft; dossierRevision: number } {
  const decoded = decodeTechnicalConfigurationBaselineDraftCreateWireResponse({ data })
  const { dossier_revision: dossierRevision, ...version } = decoded.data
  return { version, dossierRevision }
}

/** Flattens paginated history into unique versions ordered newest first. */
export function flattenTechnicalConfigurationBaselineVersionPages(
  data: TechnicalConfigurationBaselineVersionPages | undefined
): TechnicalConfigurationBaselineDecodedDraft[] {
  if (!data) return EMPTY_BASELINE_VERSIONS
  const versions = new Map<string, TechnicalConfigurationBaselineDecodedDraft>()
  for (const page of data.pages) {
    for (const version of page.data) {
      if (!versions.has(version.id)) versions.set(version.id, version)
    }
  }
  return [...versions.values()].toSorted(
    (left, right) => right.version_number - left.version_number
  )
}

/** Selects the next visible version while preserving an older page selection during refresh. */
export function selectTechnicalConfigurationBaselineVersion(
  versions: TechnicalConfigurationBaselineDraftWire[],
  selectedVersionId: string | null,
  currentVersion: TechnicalConfigurationBaselineDraftWire | null,
  hasNextPage: boolean
): TechnicalConfigurationBaselineDraftWire | null {
  const selectedVersion = versions.find((version) => version.id === selectedVersionId)
  if (
    !selectedVersion &&
    selectedVersionId &&
    currentVersion?.id === selectedVersionId &&
    hasNextPage
  ) {
    return currentVersion
  }

  return (
    selectedVersion ?? versions.find((version) => version.status === "draft") ?? versions[0] ?? null
  )
}

/** Computes the next history page when the server reports remaining versions. */
export function getTechnicalConfigurationBaselineNextPage(
  lastPage: TechnicalConfigurationBaselineVersionsListWireResponse,
  allPages: TechnicalConfigurationBaselineVersionsListWireResponse[] = [lastPage]
): number | undefined {
  const loadedVersionIds = new Set(
    allPages.flatMap((page) => page.data.map((version) => version.id))
  )
  if (loadedVersionIds.size >= lastPage.total) return undefined
  return lastPage.page * lastPage.page_size < lastPage.total ? lastPage.page + 1 : undefined
}

/** Wraps one history response in TanStack Query infinite-data shape. */
export function toTechnicalConfigurationBaselineVersionPages(
  response: TechnicalConfigurationBaselineVersionsListWireResponse
): TechnicalConfigurationBaselineVersionPages {
  const decodedResponse = decodeTechnicalConfigurationBaselineVersionsListWireResponse(response)
  return { pages: [decodedResponse], pageParams: [decodedResponse.page] }
}

/** Reconciles a refreshed first page with already loaded offset-based history. */
export function replaceTechnicalConfigurationBaselineFirstPageInPages(
  current: TechnicalConfigurationBaselineVersionPages | undefined,
  response: TechnicalConfigurationBaselineVersionsListWireResponse
): TechnicalConfigurationBaselineVersionPages {
  const decodedResponse = decodeTechnicalConfigurationBaselineVersionsListWireResponse(response)
  if (!current || current.pages.length === 0) {
    return toTechnicalConfigurationBaselineVersionPages(decodedResponse)
  }

  const versions = new Map<string, TechnicalConfigurationBaselineDecodedDraft>()
  for (const version of decodedResponse.data) versions.set(version.id, version)
  for (const page of current.pages) {
    for (const version of page.data) {
      if (!versions.has(version.id)) versions.set(version.id, version)
    }
  }

  const loadedCapacity = current.pages.length * decodedResponse.page_size
  const reconciledVersions = [...versions.values()]
    .toSorted((left, right) => right.version_number - left.version_number)
    .slice(0, Math.min(decodedResponse.total, loadedCapacity))

  if (reconciledVersions.length === 0) {
    return toTechnicalConfigurationBaselineVersionPages(decodedResponse)
  }

  const pages = Array.from(
    { length: Math.ceil(reconciledVersions.length / decodedResponse.page_size) },
    (_, pageIndex) => ({
      data: reconciledVersions.slice(
        pageIndex * decodedResponse.page_size,
        (pageIndex + 1) * decodedResponse.page_size
      ),
      total: decodedResponse.total,
      page: pageIndex + 1,
      page_size: decodedResponse.page_size,
    })
  )

  return {
    ...current,
    pages,
    pageParams: pages.map((page) => page.page),
  }
}

/** Replaces or prepends a version snapshot without discarding loaded history pages. */
export function replaceTechnicalConfigurationBaselineVersionInPages(
  current: TechnicalConfigurationBaselineVersionPages | undefined,
  version: TechnicalConfigurationBaselineDraftWire
): TechnicalConfigurationBaselineVersionPages {
  const decodedVersion = decodeTechnicalConfigurationBaselineDraftWire(version)
  if (!current || current.pages.length === 0) {
    return toTechnicalConfigurationBaselineVersionPages({
      data: [decodedVersion],
      total: 1,
      page: 1,
      page_size: BASELINE_VERSION_PAGE_SIZE,
    })
  }
  const exists = current.pages.some((page) =>
    page.data.some((item) => item.id === decodedVersion.id)
  )
  const pages = current.pages.map((page, pageIndex) => {
    const data = page.data.map((item) => (item.id === decodedVersion.id ? decodedVersion : item))
    return {
      ...page,
      data: !exists && pageIndex === 0 ? [decodedVersion, ...data] : data,
      total: exists ? page.total : page.total + 1,
    }
  })

  return {
    ...current,
    pages,
  }
}
