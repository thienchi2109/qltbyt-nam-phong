import * as React from "react"

import { useTechnicalConfigurationBaselineEditor } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineEditor"
import { useTechnicalConfigurationBaselineImportWorkflows } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineImportWorkflows"
import { useTechnicalConfigurationBeforeUnloadGuard } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBeforeUnloadGuard"
import { useTechnicalConfigurationBulkEntrySessions } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBulkEntrySessions"
import { useTechnicalConfigurationDiscardConfirmation } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationDiscardConfirmation"
import { useTechnicalConfigurationInlineEditor } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationInlineEditor"
import { getTechnicalConfigurationBaselineLockBlockedReason } from "@/app/(app)/technical-configurations/TechnicalConfigurationBaselineLockReason"
import { validateTechnicalConfigurationBaselineEditorDraft } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import type { TechnicalConfigurationDossierWire } from "@/app/(app)/technical-configurations/types"

import { TechnicalConfigurationBaselineAlerts } from "./TechnicalConfigurationBaselineAlerts"
import { TechnicalConfigurationBaselineEditor } from "./TechnicalConfigurationBaselineEditor"
import { TechnicalConfigurationBaselineProductionSurfaces } from "./TechnicalConfigurationBaselineProductionSurfaces"
import { TechnicalConfigurationBaselineVersionControls } from "./TechnicalConfigurationBaselineVersionControls"
import { TechnicalConfigurationLockDialog } from "./TechnicalConfigurationLockDialog"
import {
  TechnicalConfigurationBaselineLoadingState,
  TechnicalConfigurationBaselineLockedState,
  TechnicalConfigurationBaselineMissingState,
  TechnicalConfigurationBaselineQueryError,
} from "./TechnicalConfigurationBaselineTabStates"

type TechnicalConfigurationBaselineTabProps = {
  dossier: TechnicalConfigurationDossierWire
  isFocusMode?: boolean
  onDirtyChange: (dirty: boolean) => void
  onNavigationBlockedChange?: (blocked: boolean) => void
  onToggleFocusMode?: () => void
}

/** Composes baseline data state with transient spreadsheet interaction state. */
export function TechnicalConfigurationBaselineTab({
  dossier,
  isFocusMode = false,
  onDirtyChange,
  onNavigationBlockedChange,
  onToggleFocusMode,
}: Readonly<TechnicalConfigurationBaselineTabProps>) {
  const [isLockDialogOpen, setIsLockDialogOpen] = React.useState(false)
  const [hasUnresolvedImportState, setHasUnresolvedImportState] = React.useState(false)
  const { discardConfirmationDialog, requestDiscardConfirmation } =
    useTechnicalConfigurationDiscardConfirmation()
  const bulkSessions = useTechnicalConfigurationBulkEntrySessions()
  const baseline = useTechnicalConfigurationBaselineEditor({
    dossier,
    isExternalDraftReplacementBlocked: bulkSessions.hasPendingInput || hasUnresolvedImportState,
  })
  const draft = baseline.editorDraft
  const selectedVersion = baseline.selectedVersion
  const isImportBlocked =
    baseline.isDirty ||
    baseline.isConflict ||
    baseline.isLifecycleBusy ||
    bulkSessions.hasPendingInput
  const imports = useTechnicalConfigurationBaselineImportWorkflows({
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
  const lockBlockedReason = getTechnicalConfigurationBaselineLockBlockedReason({
    draft,
    isSelectedDraft: selectedVersion?.status === "draft",
    isConflict: baseline.isConflict,
    isDirty: baseline.isDirty,
    hasPendingBulkInput: bulkSessions.hasPendingInput,
    hasUnresolvedImportState,
    validation: summaryValidation,
  })
  const inlineEditor = useTechnicalConfigurationInlineEditor({
    draft,
    validation: summaryValidation,
    saveStatus: baseline.saveStatus,
    bulkSessions,
    onEditorChange: baseline.onEditorChange,
  })
  const isUnsafeToLeave =
    baseline.isDirty || bulkSessions.hasPendingInput || hasUnresolvedImportState
  const reportWorkspaceState = React.useCallback(
    (dirty: boolean, navigationBlocked: boolean) => {
      onDirtyChange(dirty)
      onNavigationBlockedChange?.(navigationBlocked)
    },
    [onDirtyChange, onNavigationBlockedChange]
  )
  React.useEffect(() => {
    reportWorkspaceState(isUnsafeToLeave, imports.isApplying)
    return () => reportWorkspaceState(false, false)
  }, [imports.isApplying, isUnsafeToLeave, reportWorkspaceState])

  useTechnicalConfigurationBeforeUnloadGuard(isUnsafeToLeave)

  const reloadDraftFromServer = async () => {
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

  const handleReloadFromServer = () => {
    if (bulkSessions.hasPendingInput || hasUnresolvedImportState) return
    if (selectedVersion?.status === "locked") {
      void baseline.onRefreshVersions().catch(() => undefined)
      return
    }
    if (!isUnsafeToLeave) {
      void reloadDraftFromServer()
      return
    }
    requestDiscardConfirmation(
      "Tải lại từ máy chủ sẽ thay thế các thay đổi chưa lưu. Tiếp tục?",
      () => void reloadDraftFromServer()
    )
  }

  const handleSelectVersion = (versionId: string) => {
    const nextVersion = baseline.versions.find((version) => version.id === versionId)
    if (!nextVersion || nextVersion.id === selectedVersion?.id) return

    const selectVersion = () => {
      bulkSessions.clearAll()
      imports.reset()
      baseline.onSelectVersion(versionId, { force: isUnsafeToLeave })
      inlineEditor.prepareForReload(nextVersion.groups[0]?.id ?? "")
    }

    if (isUnsafeToLeave) {
      requestDiscardConfirmation(
        "Chuyển phiên bản sẽ bỏ các thay đổi chưa lưu. Tiếp tục?",
        selectVersion
      )
      return
    }

    selectVersion()
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
    <div
      data-testid="technical-configuration-baseline-tab"
      className="flex min-h-0 flex-1 flex-col gap-3"
    >
      <div className="shrink-0">
        <TechnicalConfigurationBaselineVersionControls
          dossierName={dossier.name}
          isFocusMode={isFocusMode}
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
            isDownloadingTemplate: imports.legacyImport.isDownloading,
            isImportBusy: imports.legacyImport.isPreviewing || imports.legacyImport.isApplying,
            isImportBlocked,
          }}
          onSelectVersion={handleSelectVersion}
          onLoadMoreVersions={() => void baseline.onLoadMoreVersions()}
          onRequestLock={() => setIsLockDialogOpen(true)}
          onCreateBlank={baseline.onCreate}
          onCopy={() => void handleCopy()}
          onDownloadTemplate={() => void imports.legacyImport.downloadTemplate()}
          onRequestImport={imports.openLegacyImport}
        />
      </div>

      <TechnicalConfigurationBaselineProductionSurfaces
        isFocusMode={isFocusMode}
        version={imports.decodedVersion}
        dirty={baseline.isDirty}
        conflict={baseline.isConflict}
        disabled={baseline.isLifecycleBusy || bulkSessions.hasPendingInput}
        disabledMessage={
          bulkSessions.hasPendingInput
            ? "Hoàn tất hoặc hủy nội dung nhập nhanh trước khi dùng công cụ Excel."
            : null
        }
        legacyImport={imports.legacyImport}
        hierarchyImport={imports.hierarchyImport}
        onRequestHierarchyImport={imports.openHierarchyImport}
      />

      <TechnicalConfigurationBaselineAlerts
        isConflict={baseline.isConflict}
        isReloading={baseline.isReloading}
        isReloadBlocked={bulkSessions.hasPendingInput || hasUnresolvedImportState}
        pendingInputDescriptionId={
          bulkSessions.hasPendingInput ? "technical-configuration-pending-bulk-status" : undefined
        }
        saveError={
          imports.operationError ??
          baseline.createError ??
          baseline.saveError ??
          baseline.lifecycleError
        }
        onReload={handleReloadFromServer}
      />

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
          isFocusMode={isFocusMode}
          activeValue={inlineEditor.activeValue}
          entryMode={inlineEditor.entryMode}
          getBulkSession={bulkSessions.getSession}
          focusTarget={inlineEditor.focusTarget}
          recentlyAcceptedCriterionKeys={bulkSessions.recentlyAcceptedCriterionKeys}
          onGroupModeChange={inlineEditor.setGroupMode}
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
          onSave={baseline.onSave}
          onToggleFocusMode={onToggleFocusMode}
          hierarchyAuthoring={inlineEditor.hierarchyAuthoring}
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
      {discardConfirmationDialog}
    </div>
  )
}
