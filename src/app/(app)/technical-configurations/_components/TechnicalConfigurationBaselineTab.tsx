import * as React from "react"

import { useTechnicalConfigurationBaselineEditor } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineEditor"
import { useTechnicalConfigurationBulkEntrySessions } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBulkEntrySessions"
import { useTechnicalConfigurationInlineEditor } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationInlineEditor"
import { validateTechnicalConfigurationBaselineEditorDraft } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import type { TechnicalConfigurationDossierWire } from "@/app/(app)/technical-configurations/types"

import { TechnicalConfigurationBaselineAlerts } from "./TechnicalConfigurationBaselineAlerts"
import { TechnicalConfigurationBaselineEditor } from "./TechnicalConfigurationBaselineEditor"
import {
  TechnicalConfigurationBaselineLoadingState,
  TechnicalConfigurationBaselineLockedState,
  TechnicalConfigurationBaselineMissingState,
  TechnicalConfigurationBaselineQueryError,
} from "./TechnicalConfigurationBaselineTabStates"

type TechnicalConfigurationBaselineTabProps = {
  dossier: TechnicalConfigurationDossierWire
  onDirtyChange: (dirty: boolean) => void
}

/** Composes baseline data state with transient spreadsheet interaction state. */
export function TechnicalConfigurationBaselineTab({
  dossier,
  onDirtyChange,
}: Readonly<TechnicalConfigurationBaselineTabProps>) {
  const bulkSessions = useTechnicalConfigurationBulkEntrySessions()
  const baseline = useTechnicalConfigurationBaselineEditor({
    dossier,
    isExternalDraftReplacementBlocked: bulkSessions.hasPendingInput,
  })
  const draft = baseline.editorDraft
  const summaryValidation = React.useMemo(
    () => (draft ? validateTechnicalConfigurationBaselineEditorDraft(draft) : baseline.validation),
    [baseline.validation, draft]
  )
  const inlineEditor = useTechnicalConfigurationInlineEditor({
    draft,
    validation: summaryValidation,
    saveStatus: baseline.saveStatus,
    bulkSessions,
    onEditorChange: baseline.onEditorChange,
  })
  const isUnsafeToLeave = baseline.isDirty || bulkSessions.hasPendingInput

  React.useEffect(() => {
    onDirtyChange(isUnsafeToLeave)
    return () => onDirtyChange(false)
  }, [isUnsafeToLeave, onDirtyChange])

  React.useEffect(() => {
    if (!isUnsafeToLeave) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [isUnsafeToLeave])

  const handleReloadFromServer = async () => {
    if (bulkSessions.hasPendingInput) return
    const confirmed = window.confirm(
      "Tải lại từ máy chủ sẽ thay thế các thay đổi chưa lưu. Tiếp tục?"
    )
    if (!confirmed) return
    bulkSessions.clearAll()
    try {
      const reloadedDraft = await baseline.onReloadFromServer()
      if (reloadedDraft) {
        inlineEditor.prepareForReload(reloadedDraft.groups[0]?.key ?? "")
      }
    } catch {
      return
    }
  }
  if (baseline.isLoading) {
    return <TechnicalConfigurationBaselineLoadingState />
  }
  if (baseline.queryError) {
    return (
      <TechnicalConfigurationBaselineQueryError
        message={baseline.queryError}
        onRetry={baseline.onRetryQuery}
      />
    )
  }
  if (baseline.isMissing) {
    return (
      <TechnicalConfigurationBaselineMissingState
        error={baseline.createError}
        isCreating={baseline.isCreating}
        onCreate={baseline.onCreate}
      />
    )
  }
  if (draft?.status === "locked") {
    return <TechnicalConfigurationBaselineLockedState />
  }

  if (!draft) return null

  return (
    <div className="space-y-4">
      <TechnicalConfigurationBaselineAlerts
        isConflict={baseline.isConflict}
        isReloading={baseline.isReloading}
        hasPendingBulkInput={bulkSessions.hasPendingInput}
        saveError={baseline.saveError}
        onReload={handleReloadFromServer}
      />

      <TechnicalConfigurationBaselineEditor
        draft={draft}
        validation={baseline.validation}
        summaryValidation={summaryValidation}
        status={{
          dirty: baseline.isDirty,
          saving: baseline.isSaving,
          editingDisabled: baseline.isSaving || baseline.isReloading,
          conflict: baseline.isConflict,
          saveStatus: baseline.saveStatus,
          hasPendingBulkInput: bulkSessions.hasPendingInput,
        }}
        activeValue={inlineEditor.activeValue}
        entryMode={inlineEditor.entryMode}
        bulkSession={inlineEditor.bulkSession}
        focusTarget={inlineEditor.focusTarget}
        recentlyAcceptedCriterionKeys={bulkSessions.recentlyAcceptedCriterionKeys}
        onNavigate={inlineEditor.navigate}
        onModeChange={inlineEditor.changeMode}
        onAddGroup={inlineEditor.addGroup}
        onGroupNameChange={inlineEditor.setGroupName}
        onMoveGroup={inlineEditor.moveGroup}
        onDeleteGroup={inlineEditor.deleteGroup}
        onCriterionTextChange={inlineEditor.setCriterionText}
        onMoveCriterion={inlineEditor.moveCriterion}
        onDeleteCriterion={inlineEditor.deleteCriterion}
        onAddCriterion={inlineEditor.addCriterion}
        onBulkInputChange={inlineEditor.setBulkInput}
        onBulkPreview={inlineEditor.previewBulk}
        onBulkCancel={inlineEditor.cancelBulk}
        onBulkAccept={inlineEditor.acceptBulk}
        onOverviewCriterionActivate={inlineEditor.activateOverviewCriterion}
        onSave={baseline.onSave}
      />
    </div>
  )
}
