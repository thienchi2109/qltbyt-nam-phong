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

  if (draft.status !== "ready" || !metadata || typeof unitId !== "number") {
    return (
      <DeviceQuotaDraftCatalogStates
        status={draft.status === "ready" ? "loading" : draft.status}
        hasUnit={draft.donViId != null}
        errorMessage={draft.errorMessage}
        onRetry={draft.status === "error" && draft.canRetry ? () => void draft.save() : undefined}
      />
    )
  }

  return (
    <DeviceQuotaDraftCatalogEditor
      rows={draft.rows}
      metadata={{ ...metadata, unitId }}
      validationErrors={draft.validationErrors}
      isDirty={draft.isDirty}
      isIncomplete={draft.isIncomplete}
      isSaving={draft.isSaving}
      isExcluding={draft.isExcluding}
      isRestoring={draft.isRestoring}
      isReadOnly={draft.isReadOnly}
      onUpdateItem={draft.updateItem}
      onSave={draft.save}
      onExclude={draft.exclude}
      onRestore={draft.restore}
    />
  )
}
