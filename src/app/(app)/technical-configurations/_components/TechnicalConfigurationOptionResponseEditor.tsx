"use client"

import * as React from "react"
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Circle,
  Loader2,
  PencilLine,
  RefreshCw,
} from "lucide-react"

import { useTechnicalConfigurationOptionResponses } from "../_hooks/useTechnicalConfigurationOptionResponses"
import type { TechnicalConfigurationBaselineDraftWire } from "../baseline-types"
import {
  copyTechnicalConfigurationBaselineRequirementToResponseDraft,
  getNextTechnicalConfigurationOptionResponseCriterionId,
  getTechnicalConfigurationOptionResponseCriterionStatus,
  type TechnicalConfigurationOptionResponseCriterionStatus,
} from "../technical-configuration-option-response-state"
import type { TechnicalConfigurationOptionWire } from "../supplier-option-types"
import type { TechnicalConfigurationDossierWire } from "../types"
import { DestructiveConfirmDialog } from "@/components/shared/DestructiveConfirmDialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

import { TechnicalConfigurationOptionResponsePanels } from "./TechnicalConfigurationOptionResponsePanels"
import { TechnicalConfigurationOptionDocuments } from "./TechnicalConfigurationOptionDocuments"

type TechnicalConfigurationOptionResponseEditorProps = {
  dossier: TechnicalConfigurationDossierWire
  option: TechnicalConfigurationOptionWire
  baselineVersion: TechnicalConfigurationBaselineDraftWire
  onDirtyChange?: (dirty: boolean) => void
  onNavigationBlockedChange?: (blocked: boolean) => void
  onRevisionChange?: (revision: number) => void
  requestDiscardConfirmation: (description: React.ReactNode, action: () => void) => void
  isExternalMutationBlocked?: boolean
}

const CRITERION_STATUS_LABELS: Record<TechnicalConfigurationOptionResponseCriterionStatus, string> =
  {
    empty: "Chưa phản hồi",
    persisted: "Đã lưu",
    dirty: "Đang chỉnh sửa",
  }

/** Renders one exact-baseline criterion navigator and explicit response editor. */
export function TechnicalConfigurationOptionResponseEditor({
  dossier,
  option,
  baselineVersion,
  onDirtyChange,
  onNavigationBlockedChange,
  onRevisionChange,
  requestDiscardConfirmation,
  isExternalMutationBlocked = false,
}: Readonly<TechnicalConfigurationOptionResponseEditorProps>) {
  const [isResponseNavigationBlocked, setIsResponseNavigationBlocked] = React.useState(false)
  const [isEvidenceDirty, setIsEvidenceDirty] = React.useState(false)
  const [isEvidenceNavigationBlocked, setIsEvidenceNavigationBlocked] = React.useState(false)
  const state = useTechnicalConfigurationOptionResponses({
    dossier,
    option,
    baselineVersion,
    onRevisionChange,
    onNavigationBlockedChange: setIsResponseNavigationBlocked,
    isMutationBlocked: isExternalMutationBlocked || isEvidenceNavigationBlocked,
  })
  const [isCopyConfirmationOpen, setIsCopyConfirmationOpen] = React.useState(false)
  const isDirty = state.isDirty || isEvidenceDirty
  const isNavigationBlocked = isResponseNavigationBlocked || isEvidenceNavigationBlocked

  React.useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-prop-callback-in-effect, react-doctor/no-pass-data-to-parent, react-doctor/no-pass-live-state-to-parent -- The response hook owns the draft while the supplier workspace combines cross-surface dirty state.
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  React.useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-prop-callback-in-effect, react-doctor/no-pass-data-to-parent, react-doctor/no-pass-live-state-to-parent -- Response and evidence mutations share one exact-baseline navigation block.
    onNavigationBlockedChange?.(isNavigationBlocked)
  }, [isNavigationBlocked, onNavigationBlockedChange])

  React.useEffect(
    () => () => {
      onDirtyChange?.(false)
      onNavigationBlockedChange?.(false)
    },
    [onDirtyChange, onNavigationBlockedChange]
  )

  const handleCriterionChange = React.useCallback(
    (criterionId: string) => {
      if (isDirty) {
        requestDiscardConfirmation("Chuyển tiêu chí sẽ bỏ phản hồi chưa lưu. Tiếp tục?", () =>
          state.selectCriterion(criterionId)
        )
        return
      }
      state.selectCriterion(criterionId)
    },
    [isDirty, requestDiscardConfirmation, state.selectCriterion]
  )
  const applyRequirementCopy = React.useCallback(() => {
    if (!state.selectedCriterion) return
    state.updateDraft(
      copyTechnicalConfigurationBaselineRequirementToResponseDraft(
        state.draft,
        state.selectedCriterion.requirement_text
      )
    )
  }, [state.draft, state.selectedCriterion, state.updateDraft])
  const handleCopyRequirement = React.useCallback(() => {
    if (state.draft.responseText.trim()) {
      setIsCopyConfirmationOpen(true)
      return
    }
    applyRequirementCopy()
  }, [applyRequirementCopy, state.draft.responseText])
  const handleConfirmRequirementCopy = React.useCallback(() => {
    setIsCopyConfirmationOpen(false)
    applyRequirementCopy()
  }, [applyRequirementCopy])
  const nextCriterionId = getNextTechnicalConfigurationOptionResponseCriterionId(
    state.criteria,
    state.selectedCriterionId
  )
  const handleSaveNext = React.useCallback(async () => {
    if (!nextCriterionId) return
    const didSave = await state.save()
    if (didSave) state.selectCriterion(nextCriterionId)
  }, [nextCriterionId, state.save, state.selectCriterion])
  const hasInitialError = state.responseQuery.isError && state.responseQuery.data === undefined
  const isUnavailable = !state.hasAdoptedSnapshot || hasInitialError
  const responseStatusAvailability = state.hasAdoptedSnapshot
    ? "ready"
    : hasInitialError
      ? "unavailable"
      : "loading"

  return (
    <div className="space-y-4">
      {dossier.archived_at ? (
        <Alert>
          <Archive className="size-4" aria-hidden="true" />
          <AlertTitle>Chế độ chỉ đọc</AlertTitle>
          <AlertDescription>Hồ sơ đã lưu trữ. Phản hồi phương án chỉ được xem.</AlertDescription>
        </Alert>
      ) : null}

      {hasInitialError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertTitle>Không thể tải phản hồi phương án</AlertTitle>
          <AlertDescription>
            <Button type="button" variant="outline" size="sm" onClick={() => void state.reload()}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Thử lại
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {state.validationError || state.operationError ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertTitle>{state.isConflict ? "Dữ liệu đã thay đổi" : "Không thể lưu"}</AlertTitle>
          <AlertDescription>{state.validationError ?? state.operationError}</AlertDescription>
        </Alert>
      ) : null}

      <div
        data-testid="option-response-workspace"
        className="grid min-w-0 gap-6 lg:grid-cols-[minmax(14rem,0.32fr)_minmax(0,1fr)]"
      >
        <nav aria-label="Tiêu chí cấu hình cơ sở" className="min-w-0 border-y py-3">
          <p className="mb-2 text-sm font-medium">Tiêu chí</p>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {state.criteria.map((criterion) => {
              const status = getTechnicalConfigurationOptionResponseCriterionStatus({
                snapshot: state.snapshot,
                criterionId: criterion.id,
                selectedCriterionId: state.selectedCriterionId,
                isDirty: state.isDirty,
              })
              const StatusIcon =
                status === "dirty" ? PencilLine : status === "persisted" ? CheckCircle2 : Circle

              return (
                <Button
                  key={criterion.id}
                  type="button"
                  variant={criterion.id === state.selectedCriterionId ? "secondary" : "ghost"}
                  className="h-auto min-w-44 justify-start whitespace-normal text-left lg:min-w-0"
                  aria-current={criterion.id === state.selectedCriterionId ? "true" : undefined}
                  disabled={state.isPending || isEvidenceNavigationBlocked}
                  onClick={() => handleCriterionChange(criterion.id)}
                >
                  <span className="min-w-0">
                    <span className="block text-xs text-muted-foreground">
                      {criterion.criterion_code}
                    </span>
                    <span className="block break-words">
                      {criterion.title ?? criterion.requirement_text}
                    </span>
                    <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      {responseStatusAvailability === "loading" ? (
                        <>
                          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                          Đang tải phản hồi
                        </>
                      ) : responseStatusAvailability === "unavailable" ? (
                        <>
                          <AlertCircle className="size-3" aria-hidden="true" />
                          Chưa xác định
                        </>
                      ) : (
                        <>
                          <StatusIcon className="size-3" aria-hidden="true" />
                          {CRITERION_STATUS_LABELS[status]}
                        </>
                      )}
                    </span>
                  </span>
                </Button>
              )
            })}
          </div>
        </nav>

        <section className="min-w-0 space-y-4">
          {!state.hasAdoptedSnapshot && !hasInitialError ? (
            <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Đang tải phản hồi...
            </div>
          ) : null}

          {!isUnavailable && !state.selectedCriterion ? (
            <Alert>
              <AlertTitle>Phiên bản chưa có tiêu chí</AlertTitle>
              <AlertDescription>
                Thêm tiêu chí cấu hình cơ sở trước khi nhập phản hồi.
              </AlertDescription>
            </Alert>
          ) : null}

          {!isUnavailable && state.selectedCriterion ? (
            <TechnicalConfigurationOptionResponsePanels
              criterion={state.selectedCriterion}
              draft={state.draft}
              updatedAt={state.updatedAt}
              mode={
                state.isReadOnly || state.isMutationBlocked || isEvidenceDirty
                  ? "read-only"
                  : "editable"
              }
              draftState={state.isConflict ? "conflict" : state.isDirty ? "dirty" : "clean"}
              operation={state.isSaving ? "saving" : state.isReloading ? "reloading" : "idle"}
              saveStatus={state.saveStatus}
              hasNextCriterion={nextCriterionId !== null}
              onResponseChange={(responseText) => state.updateDraft({ responseText })}
              onSupplementaryChange={(supplementaryInformation) =>
                state.updateDraft({ supplementaryInformation })
              }
              onCopyRequirement={handleCopyRequirement}
              onReload={() => void state.reload()}
              onSave={() => void state.save()}
              onSaveNext={() => void handleSaveNext()}
            />
          ) : null}
          {!isUnavailable && state.selectedCriterion ? (
            <TechnicalConfigurationOptionDocuments
              key={`${option.id}:${baselineVersion.id}:${state.selectedCriterion.id}`}
              dossier={dossier}
              option={option}
              baselineVersion={baselineVersion}
              comparisonSet={state.snapshot}
              criterionId={state.selectedCriterion.id}
              isExternalMutationBlocked={isExternalMutationBlocked || isResponseNavigationBlocked}
              onDirtyChange={setIsEvidenceDirty}
              onNavigationBlockedChange={setIsEvidenceNavigationBlocked}
              onRevisionChange={onRevisionChange}
            />
          ) : null}
        </section>
      </div>
      <DestructiveConfirmDialog
        open={isCopyConfirmationOpen && !state.isReadOnly && !state.isMutationBlocked}
        onOpenChange={setIsCopyConfirmationOpen}
        title="Ghi đè phản hồi hiện tại?"
        description="Phản hồi hiện tại sẽ được thay bằng nội dung cấu hình cơ bản. Thông tin bổ sung được giữ nguyên."
        confirmLabel="Ghi đè phản hồi"
        isPending={state.isPending || state.isReadOnly || state.isMutationBlocked}
        onConfirm={handleConfirmRequirementCopy}
      />
    </div>
  )
}
