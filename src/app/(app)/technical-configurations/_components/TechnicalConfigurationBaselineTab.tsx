import * as React from "react"

import { useTechnicalConfigurationBaselineEditor } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineEditor"
import { useTechnicalConfigurationBaselineImport } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineImport"
import { useTechnicalConfigurationBulkEntrySessions } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBulkEntrySessions"
import { useTechnicalConfigurationInlineEditor } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationInlineEditor"
import { validateTechnicalConfigurationBaselineEditorDraft } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import type { TechnicalConfigurationDossierWire } from "@/app/(app)/technical-configurations/types"

import { TechnicalConfigurationBaselineAlerts } from "./TechnicalConfigurationBaselineAlerts"
import { TechnicalConfigurationBaselineEditor } from "./TechnicalConfigurationBaselineEditor"
import { TechnicalConfigurationBaselineImportDialog } from "./TechnicalConfigurationBaselineImportDialog"
import { TechnicalConfigurationLockDialog } from "./TechnicalConfigurationLockDialog"
import {
  TechnicalConfigurationBaselineLoadingState,
  TechnicalConfigurationBaselineLockedState,
  TechnicalConfigurationBaselineMissingState,
  TechnicalConfigurationBaselineQueryError,
} from "./TechnicalConfigurationBaselineTabStates"
import { TechnicalConfigurationVersionBar } from "./TechnicalConfigurationVersionBar"

type TechnicalConfigurationBaselineTabProps = {
  dossier: TechnicalConfigurationDossierWire
  onDirtyChange: (dirty: boolean) => void
  onNavigationBlockedChange?: (blocked: boolean) => void
}

/** Composes baseline data state with transient spreadsheet interaction state. */
export function TechnicalConfigurationBaselineTab({
  dossier,
  onDirtyChange,
  onNavigationBlockedChange,
}: Readonly<TechnicalConfigurationBaselineTabProps>) {
  const [isLockDialogOpen, setIsLockDialogOpen] = React.useState(false)
  const [hasUnresolvedImportState, setHasUnresolvedImportState] = React.useState(false)
  const bulkSessions = useTechnicalConfigurationBulkEntrySessions()
  const baseline = useTechnicalConfigurationBaselineEditor({
    dossier,
    isExternalDraftReplacementBlocked: bulkSessions.hasPendingInput || hasUnresolvedImportState,
  })
  const draft = baseline.editorDraft
  const selectedVersion = baseline.selectedVersion
  const isImportBlocked = baseline.isDirty || bulkSessions.hasPendingInput
  const baselineImport = useTechnicalConfigurationBaselineImport({
    dossierId: dossier.id,
    selectedVersion,
    isBlocked: isImportBlocked,
    onApplied: baseline.onAdoptImportSnapshot,
    onConflict: baseline.onRefreshImportConflict,
    onUnresolvedStateChange: setHasUnresolvedImportState,
  })
  const summaryValidation = React.useMemo(
    () => (draft ? validateTechnicalConfigurationBaselineEditorDraft(draft) : baseline.validation),
    [baseline.validation, draft]
  )
  const lockBlockedReason = React.useMemo(() => {
    if (!draft || selectedVersion?.status !== "draft") return null
    if (baseline.isConflict) return "Tải lại dữ liệu từ máy chủ trước khi khóa phiên bản."
    if (baseline.isDirty) return "Lưu thay đổi trước khi khóa phiên bản."
    if (bulkSessions.hasPendingInput) return "Hoàn tất hoặc hủy nội dung nhập nhanh trước khi khóa."
    if (baselineImport.hasUnresolvedState) {
      return "Hoàn tất hoặc hủy nhập Excel trước khi khóa phiên bản."
    }
    if (
      Object.keys(summaryValidation.groupErrors).length > 0 ||
      Object.keys(summaryValidation.criterionErrors).length > 0
    ) {
      return "Sửa các lỗi nội dung trước khi khóa phiên bản."
    }
    if (draft.groups.length < 1) return "Cần ít nhất một nhóm trước khi khóa phiên bản."
    if (!draft.groups.some((group) => group.criteria.length > 0)) {
      return "Cần ít nhất một tiêu chí có nội dung trước khi khóa phiên bản."
    }
    return null
  }, [
    baseline.isConflict,
    baseline.isDirty,
    baselineImport.hasUnresolvedState,
    bulkSessions.hasPendingInput,
    draft,
    selectedVersion?.status,
    summaryValidation,
  ])
  const inlineEditor = useTechnicalConfigurationInlineEditor({
    draft,
    validation: summaryValidation,
    saveStatus: baseline.saveStatus,
    bulkSessions,
    onEditorChange: baseline.onEditorChange,
  })
  const isUnsafeToLeave =
    baseline.isDirty || bulkSessions.hasPendingInput || baselineImport.hasUnresolvedState
  const reportWorkspaceState = React.useCallback(
    (dirty: boolean, navigationBlocked: boolean) => {
      onDirtyChange(dirty)
      onNavigationBlockedChange?.(navigationBlocked)
    },
    [onDirtyChange, onNavigationBlockedChange]
  )
  React.useEffect(() => {
    reportWorkspaceState(isUnsafeToLeave, baselineImport.isApplying)
    return () => reportWorkspaceState(false, false)
  }, [baselineImport.isApplying, isUnsafeToLeave, reportWorkspaceState])

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
    if (bulkSessions.hasPendingInput || baselineImport.hasUnresolvedState) return
    if (selectedVersion?.status === "locked") {
      try {
        await baseline.onRefreshVersions()
      } catch {
        return
      }
      return
    }
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

  const handleSelectVersion = (versionId: string) => {
    const nextVersion = baseline.versions.find((version) => version.id === versionId)
    if (!nextVersion || nextVersion.id === selectedVersion?.id) return
    if (
      isUnsafeToLeave &&
      !window.confirm("Chuyển phiên bản sẽ bỏ các thay đổi chưa lưu. Tiếp tục?")
    ) {
      return
    }

    bulkSessions.clearAll()
    baselineImport.reset()
    baseline.onSelectVersion(versionId, { force: isUnsafeToLeave })
    inlineEditor.prepareForReload(nextVersion.groups[0]?.id ?? "")
  }

  const handleConfirmLock = async () => {
    try {
      await baseline.onLock()
    } catch {
      return
    } finally {
      setIsLockDialogOpen(false)
    }
  }

  const handleCopy = async () => {
    try {
      await baseline.onCopy()
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
  if (!selectedVersion) return null

  return (
    <div className="space-y-4">
      <TechnicalConfigurationVersionBar
        versions={baseline.versions}
        selectedVersion={selectedVersion}
        lockBlockedReason={lockBlockedReason}
        status={{
          hasDraft: baseline.hasDraft,
          isCreating: baseline.isCreating,
          isLocking: baseline.isLocking,
          isCopying: baseline.isCopying,
          isLoadingMoreVersions: baseline.isLoadingMoreVersions,
          hasLoadMoreError: baseline.hasLoadMoreError,
          isNavigationDisabled: baseline.isLifecycleBusy,
          hasMoreVersions: baseline.hasMoreVersions,
          isDownloadingTemplate: baselineImport.isDownloading,
          isImportBusy: baselineImport.isPreviewing || baselineImport.isApplying,
          isImportBlocked,
        }}
        onSelectVersion={handleSelectVersion}
        onLoadMoreVersions={() => void baseline.onLoadMoreVersions()}
        onRequestLock={() => setIsLockDialogOpen(true)}
        onCreateBlank={baseline.onCreate}
        onCopy={() => void handleCopy()}
        onDownloadTemplate={() => void baselineImport.downloadTemplate()}
        onRequestImport={baselineImport.openDialog}
      />

      <TechnicalConfigurationBaselineAlerts
        isConflict={baseline.isConflict}
        isReloading={baseline.isReloading}
        isReloadBlocked={bulkSessions.hasPendingInput || baselineImport.hasUnresolvedState}
        pendingInputDescriptionId={
          bulkSessions.hasPendingInput ? "technical-configuration-pending-bulk-status" : undefined
        }
        saveError={
          baselineImport.operationError ??
          baseline.createError ??
          baseline.saveError ??
          baseline.lifecycleError
        }
        onReload={handleReloadFromServer}
      />

      <TechnicalConfigurationBaselineImportDialog workflow={baselineImport} />

      {selectedVersion.status === "locked" ? (
        <TechnicalConfigurationBaselineLockedState version={selectedVersion} />
      ) : draft ? (
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
      ) : null}

      {selectedVersion.status === "draft" ? (
        <TechnicalConfigurationLockDialog
          version={selectedVersion}
          open={isLockDialogOpen}
          isPending={baseline.isLocking}
          onOpenChange={setIsLockDialogOpen}
          onConfirm={() => void handleConfirmLock()}
        />
      ) : null}
    </div>
  )
}
