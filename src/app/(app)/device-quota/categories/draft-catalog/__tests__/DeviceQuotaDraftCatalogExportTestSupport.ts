import { vi } from "vitest"

import { useDeviceQuotaDraftCatalog } from "../../_hooks/useDeviceQuotaDraftCatalog"
import type { DeviceQuotaDraftCatalogExportContext } from "../device-quota-draft-catalog-excel-export"
import { makeRows, metadata } from "./DeviceQuotaDraftCatalogTestSupport"

export type DeviceQuotaDraftCatalogExportTestHookResult = ReturnType<
  typeof useDeviceQuotaDraftCatalog
> & {
  exportSnapshot: DeviceQuotaDraftCatalogExportContext | null
}

/** Creates a stable saved export context for the user-event matrix. */
export function makeSnapshot(
  overrides: Partial<DeviceQuotaDraftCatalogExportContext> = {}
): DeviceQuotaDraftCatalogExportContext {
  return {
    unitId: 23,
    userId: "user-1",
    draftStatus: "draft",
    revision: 4,
    lastSavedAt: "2026-09-01T08:30:00.000Z",
    documentNumber: "10/2026/TT-BYT",
    documentVersion: "2026-06-19",
    appendixTitle: "Phụ lục danh mục thiết bị",
    sourcePdfMarker: "sha256:source",
    sourcePdfSha256: "sha256:source",
    catalogVersionId: "catalog-1",
    rows: makeRows(),
    footnotes: ["Chú thích 1", "Chú thích 2", "Chú thích 3"],
    ...overrides,
  }
}

/** Creates the hook state used by the page-level export interaction tests. */
export function makeHookResult(
  overrides: Partial<DeviceQuotaDraftCatalogExportTestHookResult> = {}
): DeviceQuotaDraftCatalogExportTestHookResult {
  return {
    status: "ready",
    rows: makeRows(),
    lastSavedRows: makeRows(),
    validationErrors: {},
    errorMessage: null,
    canRetry: false,
    canAccess: true,
    isReadOnly: false,
    donViId: 23,
    revision: 99,
    draftId: "draft-1",
    catalogVersionId: "catalog-1",
    metadata,
    exportSnapshot: makeSnapshot(),
    isSaving: false,
    isExcluding: false,
    isRestoring: false,
    isRecovering: false,
    updateItem: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
    exclude: vi.fn().mockResolvedValue(undefined),
    restore: vi.fn().mockResolvedValue(undefined),
    retry: vi.fn().mockResolvedValue(undefined),
    getDeviceQuotaDraftCompleteness: vi.fn(),
    isDirty: false,
    isIncomplete: true,
    ...overrides,
  } as DeviceQuotaDraftCatalogExportTestHookResult
}
