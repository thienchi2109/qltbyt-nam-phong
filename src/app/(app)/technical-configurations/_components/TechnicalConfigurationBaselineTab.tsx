import * as React from "react"

import { useTechnicalConfigurationBaselineEditor } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineEditor"
import { useTechnicalConfigurationBaselineHierarchyImport } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineHierarchyImport"
import { useTechnicalConfigurationBeforeUnloadGuard } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBeforeUnloadGuard"
import { useTechnicalConfigurationBulkEntrySessions } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBulkEntrySessions"
import { useTechnicalConfigurationDiscardConfirmation } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationDiscardConfirmation"
import { useTechnicalConfigurationInlineEditor } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationInlineEditor"
import { getTechnicalConfigurationBaselineLockBlockedReason } from "@/app/(app)/technical-configurations/TechnicalConfigurationBaselineLockReason"
import { decodeTechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/technical-configuration-baseline-decoders"
import { validateTechnicalConfigurationBaselineEditorDraft } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import type { TechnicalConfigurationDossierWire } from "@/app/(app)/technical-configurations/types"

import { TechnicalConfigurationBaselineAlerts } from "./TechnicalConfigurationBaselineAlerts"
import { TechnicalConfigurationBaselineEditor } from "./TechnicalConfigurationBaselineEditor"
import { TechnicalConfigurationBaselineHierarchyImportDialog } from "./TechnicalConfigurationBaselineHierarchyImportDialog"
import { TechnicalConfigurationBaselineProductionActions } from "./TechnicalConfigurationBaselineProductionActions"
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
  const decodedVersion = React.useMemo(
    () =>
      selectedVersion
        ? decodeTechnicalConfigurationBaselineDraftWire(selectedVersion, "selectedVersion")
        : null,
    [selectedVersion]
  )
  const isImportBlocked =
    baseline.isDirty ||
    baseline.isConflict ||
    baseline.isLifecycleBusy ||
    bulkSessions.hasPendingInput
  const hierarchyImport = useTechnicalConfigurationBaselineHierarchyImport({
    selectedVersion: decodedVersion,
    isBlocked: isImportBlocked,
    onApplied: baseline.onAdoptImportSnapshot,
    onConflict: baseline.onRefreshImportConflict,
    onUnresolvedStateChange: setHasUnresolvedImportState,
  })
  const isHierarchyImportBusy =
    hierarchyImport.isParsing || hierarchyImport.isPreviewing || hierarchyImport.isApplying
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
    reportWorkspaceState(isUnsafeToLeave, hierarchyImport.isApplying)
    return () => reportWorkspaceState(false, false)
  }, [hierarchyImport.isApplying, isUnsafeToLeave, reportWorkspaceState])

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
      hierarchyImport.reset()
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
            isImportBusy: isHierarchyImportBusy,
          }}
          onSelectVersion={handleSelectVersion}
          onLoadMoreVersions={() => void baseline.onLoadMoreVersions()}
          onRequestLock={() => setIsLockDialogOpen(true)}
          onCreateBlank={baseline.onCreate}
          onCopy={() => void handleCopy()}
          spreadsheetActions={
            decodedVersion ? (
              <TechnicalConfigurationBaselineProductionActions
                version={decodedVersion}
                dirty={baseline.isDirty}
                conflict={baseline.isConflict}
                disabled={
                  baseline.isLifecycleBusy || bulkSessions.hasPendingInput || isHierarchyImportBusy
                }
                disabledMessage={
                  bulkSessions.hasPendingInput
                    ? "Hoàn tất hoặc hủy nội dung nhập nhanh trước khi dùng công cụ Excel."
                    : null
                }
                onRequestHierarchyImport={hierarchyImport.openDialog}
              />
            ) : null
          }
        />
      </div>

      <TechnicalConfigurationBaselineHierarchyImportDialog workflow={hierarchyImport} />

      <TechnicalConfigurationBaselineAlerts
        isConflict={baseline.isConflict}
        isReloading={baseline.isReloading}
        isReloadBlocked={bulkSessions.hasPendingInput || hasUnresolvedImportState}
        pendingInputDescriptionId={
          bulkSessions.hasPendingInput ? "technical-configuration-pending-bulk-status" : undefined
        }
        saveError={
          hierarchyImport.operationError ??
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
