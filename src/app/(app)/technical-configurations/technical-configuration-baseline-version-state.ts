import type { InfiniteData } from "@tanstack/react-query"

import type {
  TechnicalConfigurationBaselineDraftCreateWireResponse,
  TechnicalConfigurationBaselineDraftWire,
  TechnicalConfigurationBaselineVersionsListWireResponse,
} from "./baseline-types"

/** Maximum number of baseline versions requested per history page. */
export const BASELINE_VERSION_PAGE_SIZE = 100
/** Stable empty value used when version history has not loaded. */
export const EMPTY_BASELINE_VERSIONS: TechnicalConfigurationBaselineDraftWire[] = []

export type TechnicalConfigurationBaselineVersionPages = InfiniteData<
  TechnicalConfigurationBaselineVersionsListWireResponse,
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
): TechnicalConfigurationBaselineVersionsListWireResponse {
  const pageStartOffset = (response.page - 1) * response.page_size
  const loadedVersionIds = new Set(
    [...precedingPages, response].flatMap((page) => page.data.map((version) => version.id))
  )
  const reachedReportedEnd = response.page * response.page_size >= response.total
  if (
    (response.data.length === 0 && pageStartOffset < response.total) ||
    (reachedReportedEnd && loadedVersionIds.size < response.total)
  ) {
    throw new Error(BASELINE_VERSION_HISTORY_INCOMPLETE)
  }
  return response
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
): { version: TechnicalConfigurationBaselineDraftWire; dossierRevision: number } {
  const { dossier_revision: dossierRevision, ...version } = data
  return { version, dossierRevision }
}

/** Flattens paginated history into unique versions ordered newest first. */
export function flattenTechnicalConfigurationBaselineVersionPages(
  data: TechnicalConfigurationBaselineVersionPages | undefined
): TechnicalConfigurationBaselineDraftWire[] {
  if (!data) return EMPTY_BASELINE_VERSIONS
  const versions = new Map<string, TechnicalConfigurationBaselineDraftWire>()
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
  return { pages: [response], pageParams: [response.page] }
}

/** Reconciles a refreshed first page with already loaded offset-based history. */
export function replaceTechnicalConfigurationBaselineFirstPageInPages(
  current: TechnicalConfigurationBaselineVersionPages | undefined,
  response: TechnicalConfigurationBaselineVersionsListWireResponse
): TechnicalConfigurationBaselineVersionPages {
  if (!current || current.pages.length === 0) {
    return toTechnicalConfigurationBaselineVersionPages(response)
  }

  const versions = new Map<string, TechnicalConfigurationBaselineDraftWire>()
  for (const version of response.data) versions.set(version.id, version)
  for (const page of current.pages) {
    for (const version of page.data) {
      if (!versions.has(version.id)) versions.set(version.id, version)
    }
  }

  const loadedCapacity = current.pages.length * response.page_size
  const reconciledVersions = [...versions.values()]
    .toSorted((left, right) => right.version_number - left.version_number)
    .slice(0, Math.min(response.total, loadedCapacity))

  if (reconciledVersions.length === 0) {
    return toTechnicalConfigurationBaselineVersionPages(response)
  }

  const pages = Array.from(
    { length: Math.ceil(reconciledVersions.length / response.page_size) },
    (_, pageIndex) => ({
      data: reconciledVersions.slice(
        pageIndex * response.page_size,
        (pageIndex + 1) * response.page_size
      ),
      total: response.total,
      page: pageIndex + 1,
      page_size: response.page_size,
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
  if (!current || current.pages.length === 0) {
    return toTechnicalConfigurationBaselineVersionPages({
      data: [version],
      total: 1,
      page: 1,
      page_size: BASELINE_VERSION_PAGE_SIZE,
    })
  }
  const exists = current.pages.some((page) => page.data.some((item) => item.id === version.id))
  const pages = current.pages.map((page, pageIndex) => {
    const data = page.data.map((item) => (item.id === version.id ? version : item))
    return {
      ...page,
      data: !exists && pageIndex === 0 ? [version, ...data] : data,
      total: exists ? page.total : page.total + 1,
    }
  })

  return {
    ...current,
    pages,
  }
}
