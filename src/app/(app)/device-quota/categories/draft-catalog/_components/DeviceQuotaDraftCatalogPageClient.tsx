"use client"

import { useDeviceQuotaDraftCatalog } from "../../_hooks/useDeviceQuotaDraftCatalog"
import { DeviceQuotaDraftCatalogEditor } from "./DeviceQuotaDraftCatalogEditor"
import { DeviceQuotaDraftCatalogStates } from "./DeviceQuotaDraftCatalogStates"

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
          isReadOnly: draft.isReadOnly,
        }}
        onUpdateItem={draft.updateItem}
        onSave={draft.save}
        onExclude={draft.exclude}
        onRestore={draft.restore}
      />
    </>
  )
}
