"use client"

import { useTenantBranding } from "@/hooks/use-tenant-branding"

import { useDeviceQuotaDraftCatalog } from "../../_hooks/useDeviceQuotaDraftCatalog"
import type {
  DeviceQuotaDraftCatalogExportContext,
  DeviceQuotaDraftCatalogExportSnapshot,
} from "../device-quota-draft-catalog-excel-export"
import { DeviceQuotaDraftCatalogEditor } from "./DeviceQuotaDraftCatalogEditor"
import { DeviceQuotaDraftCatalogStates } from "./DeviceQuotaDraftCatalogStates"

type DraftCatalogHookResult = ReturnType<typeof useDeviceQuotaDraftCatalog>
type DraftCatalogMetadata = NonNullable<DraftCatalogHookResult["metadata"]>

function DeviceQuotaDraftCatalogEditorWithBranding({
  draft,
  metadata,
  snapshot,
}: {
  draft: DraftCatalogHookResult
  metadata: DraftCatalogMetadata
  snapshot: DeviceQuotaDraftCatalogExportContext
}): React.JSX.Element {
  const brandingQuery = useTenantBranding({
    formTenantId: snapshot.unitId,
    useFormContext: true,
  })
  const branding = brandingQuery.data
  const unitName = typeof branding?.name === "string" ? branding.name.trim() : ""
  const hasMatchingBranding = branding?.id === snapshot.unitId && unitName !== ""
  const exportSnapshot: DeviceQuotaDraftCatalogExportSnapshot | null = hasMatchingBranding
    ? { ...snapshot, unitName }
    : null
  const exportStatus = brandingQuery.isPending
    ? "loading"
    : brandingQuery.isError || !hasMatchingBranding
      ? "error"
      : "ready"
  const exportStatusMessage = brandingQuery.isError
    ? "Không thể tải thông tin đơn vị để xuất Excel."
    : "Thiếu hoặc không khớp thông tin đơn vị để xuất Excel."

  return (
    <DeviceQuotaDraftCatalogEditor
      rows={draft.rows}
      metadata={{ ...metadata, unitId: snapshot.unitId }}
      validationErrors={draft.validationErrors}
      state={{
        isDirty: draft.isDirty,
        isIncomplete: draft.isIncomplete,
        isSaving: draft.isSaving,
        isExcluding: draft.isExcluding,
        isRestoring: draft.isRestoring,
        isRecovering: draft.isRecovering,
        isReadOnly: draft.isReadOnly,
      }}
      onUpdateItem={draft.updateItem}
      onSave={draft.save}
      onExclude={draft.exclude}
      onRestore={draft.restore}
      exportSnapshot={exportSnapshot}
      exportStatus={exportStatus}
      exportStatusMessage={exportStatusMessage}
      onRetryExport={() => void brandingQuery.refetch()}
    />
  )
}

/** Connects the session-scoped draft hook to the desktop editor and fail-closed states. */
export function DeviceQuotaDraftCatalogPageClient({
  mode = "editable",
}: {
  mode?: "editable" | "readonly"
}): React.JSX.Element {
  const draft = useDeviceQuotaDraftCatalog({ mode })
  const metadata = draft.metadata
  const unitId = metadata?.unitId
  const hasLoadedEditor = metadata && typeof unitId === "number"
  const exportContext = draft.exportSnapshot

  if (!hasLoadedEditor) {
    return (
      <DeviceQuotaDraftCatalogStates
        status={draft.status === "ready" ? "loading" : draft.status}
        hasUnit={draft.donViId != null}
        errorMessage={draft.errorMessage}
        onRetry={draft.canRetry ? () => void draft.retry() : undefined}
      />
    )
  }

  if (exportContext) {
    return (
      <>
        {draft.status !== "ready" ? (
          <DeviceQuotaDraftCatalogStates
            status={draft.status}
            hasUnit={draft.donViId != null}
            errorMessage={draft.errorMessage}
            onRetry={draft.canRetry ? () => void draft.retry() : undefined}
          />
        ) : null}
        <DeviceQuotaDraftCatalogEditorWithBranding
          draft={draft}
          metadata={{ ...metadata, unitId }}
          snapshot={exportContext}
        />
      </>
    )
  }

  return (
    <>
      {draft.status !== "ready" ? (
        <DeviceQuotaDraftCatalogStates
          status={draft.status}
          hasUnit={draft.donViId != null}
          errorMessage={draft.errorMessage}
          onRetry={draft.canRetry ? () => void draft.retry() : undefined}
        />
      ) : null}
      <DeviceQuotaDraftCatalogEditor
        rows={draft.rows}
        metadata={{ ...metadata, unitId }}
        validationErrors={draft.validationErrors}
        state={{
          isDirty: draft.isDirty,
          isIncomplete: draft.isIncomplete,
          isSaving: draft.isSaving,
          isExcluding: draft.isExcluding,
          isRestoring: draft.isRestoring,
          isRecovering: draft.isRecovering,
          isReadOnly: draft.isReadOnly,
        }}
        onUpdateItem={draft.updateItem}
        onSave={draft.save}
        onExclude={draft.exclude}
        onRestore={draft.restore}
        exportSnapshot={null}
        exportStatus="missing"
      />
    </>
  )
}
