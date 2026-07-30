"use client"

import * as React from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { useTechnicalConfigurationComparisonMatrix } from "../../_hooks/useTechnicalConfigurationComparisonMatrix"
import { useTechnicalConfigurationGuardedNavigation } from "../../_hooks/useTechnicalConfigurationGuardedNavigation"
import type { TechnicalConfigurationDossierWire } from "../../types"
import { TechnicalConfigurationEvaluationWorkspace } from "../evaluation/TechnicalConfigurationEvaluationWorkspace"
import {
  TechnicalConfigurationCriterionPanel,
  type TechnicalConfigurationCriterionDetail,
} from "./TechnicalConfigurationCriterionPanel"
import { TechnicalConfigurationMatrix } from "./TechnicalConfigurationMatrix"
import { TechnicalConfigurationMatrixToolbar } from "./TechnicalConfigurationMatrixToolbar"

type TechnicalConfigurationComparisonTabProps = {
  dossier: TechnicalConfigurationDossierWire
  onDirtyChange?: (dirty: boolean) => void
  onNavigationBlockedChange?: (blocked: boolean) => void
  onRevisionChange?: (revision: number) => void
}

type TechnicalConfigurationComparisonMode = "matrix" | "evaluation"

/** Composes the P10B matrix and P12A2 evaluation as internal workspace modes. */
export function TechnicalConfigurationComparisonTab({
  dossier,
  onDirtyChange,
  onNavigationBlockedChange,
  onRevisionChange,
}: Readonly<TechnicalConfigurationComparisonTabProps>) {
  const matrix = useTechnicalConfigurationComparisonMatrix(dossier.id)
  const [activeMode, setActiveMode] = React.useState<TechnicalConfigurationComparisonMode>("matrix")
  const [isEvaluationDirty, setIsEvaluationDirty] = React.useState(false)
  const [isEvaluationNavigationBlocked, setIsEvaluationNavigationBlocked] = React.useState(false)
  const [detail, setDetail] = React.useState<TechnicalConfigurationCriterionDetail | null>(null)
  const detailReturnFocusRef = React.useRef<HTMLElement | null>(null)
  const { comparisonQuery } = matrix.comparison
  const hasRequest = matrix.baselineVersionId !== null && matrix.selectedOptionIds.length > 0
  const isDirty = activeMode === "evaluation" && isEvaluationDirty
  const isNavigationBlocked = activeMode === "evaluation" && isEvaluationNavigationBlocked
  const { requestNavigation, discardConfirmationDialog } =
    useTechnicalConfigurationGuardedNavigation({
      isDirty,
      isBlocked: isNavigationBlocked,
    })

  const openDetail = React.useCallback((nextDetail: TechnicalConfigurationCriterionDetail) => {
    detailReturnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setDetail(nextDetail)
  }, [])

  React.useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-pass-live-state-to-parent, react-doctor/no-pass-data-to-parent, react-doctor/no-prop-callback-in-effect -- WorkspaceShell owns top-level guards while this tab owns its internal mode.
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])
  React.useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-pass-live-state-to-parent, react-doctor/no-pass-data-to-parent, react-doctor/no-prop-callback-in-effect -- Evaluation save lifecycle must block mode, tab and dossier navigation.
    onNavigationBlockedChange?.(isNavigationBlocked)
  }, [isNavigationBlocked, onNavigationBlockedChange])
  React.useEffect(
    () => () => {
      onDirtyChange?.(false)
      onNavigationBlockedChange?.(false)
    },
    [onDirtyChange, onNavigationBlockedChange]
  )

  const handleModeChange = React.useCallback(
    (nextMode: string) => {
      if ((nextMode !== "matrix" && nextMode !== "evaluation") || nextMode === activeMode) {
        return
      }
      requestNavigation(() => {
        setActiveMode(nextMode)
        if (activeMode === "matrix") setDetail(null)
      })
    },
    [activeMode, requestNavigation]
  )

  return (
    <section className="min-w-0" aria-label="So sánh và đánh giá cấu hình kỹ thuật">
      <Tabs value={activeMode} onValueChange={handleModeChange}>
        <div className="flex justify-end border-b pb-3">
          <TabsList
            className="grid h-auto w-full max-w-56 grid-cols-2"
            aria-label="Chế độ so sánh và đánh giá"
          >
            <TabsTrigger value="matrix" disabled={isNavigationBlocked}>
              Ma trận
            </TabsTrigger>
            <TabsTrigger value="evaluation">Đánh giá</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="matrix" className="mt-4 space-y-4">
          <TechnicalConfigurationMatrixToolbar
            baselineVersionId={matrix.baselineVersionId}
            versions={matrix.versions}
            versionsQuery={matrix.versionsQuery}
            options={matrix.options}
            optionsQuery={matrix.optionsQuery}
            selectedOptions={matrix.selectedOptions}
            visibleOptionIds={matrix.visibleOptionIds}
            pinnedOptionIds={matrix.pinnedOptionIds}
            focusedOptionId={matrix.focusedOptionId}
            isSelectionLimitReached={matrix.isSelectionLimitReached}
            onSelectBaselineVersion={matrix.selectBaselineVersion}
            onLoadMoreVersions={() => void matrix.loadMoreVersions()}
            onRetryVersions={() => void matrix.retryVersions()}
            onRetryOptions={() => void matrix.optionsQuery.refetch()}
            onAddOption={matrix.addOption}
            onRemoveOption={matrix.removeOption}
            onToggleOptionVisibility={matrix.toggleOptionVisibility}
            onToggleOptionPin={matrix.toggleOptionPin}
            onFocusOption={matrix.focusOption}
            onExitFocus={matrix.exitFocusMode}
          />
          <TechnicalConfigurationMatrix
            hasRequest={hasRequest}
            result={comparisonQuery.data}
            visibleOptionIds={matrix.visibleOptionIds}
            pinnedOptionIds={matrix.pinnedOptionIds}
            focusedOptionId={matrix.focusedOptionId}
            isLoading={comparisonQuery.isLoading}
            isError={comparisonQuery.isError}
            error={comparisonQuery.error}
            onRetry={() => void comparisonQuery.refetch()}
            onPageChange={matrix.setPage}
            onOpenDetail={openDetail}
          />
          <TechnicalConfigurationCriterionPanel
            detail={detail}
            open={detail !== null}
            returnFocusRef={detailReturnFocusRef}
            onOpenChange={(open) => {
              if (!open) setDetail(null)
            }}
          />
        </TabsContent>

        <TabsContent value="evaluation" className="mt-4">
          <TechnicalConfigurationEvaluationWorkspace
            dossier={dossier}
            onDirtyChange={setIsEvaluationDirty}
            onNavigationBlockedChange={setIsEvaluationNavigationBlocked}
            onRevisionChange={onRevisionChange}
          />
        </TabsContent>
      </Tabs>
      {discardConfirmationDialog}
    </section>
  )
}
