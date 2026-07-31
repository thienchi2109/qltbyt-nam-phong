"use client"

import * as React from "react"
import { Loader2, Save, StepForward } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { useTechnicalConfigurationComparison } from "../../_hooks/useTechnicalConfigurationComparison"
import { useTechnicalConfigurationEvaluationDraft } from "../../_hooks/useTechnicalConfigurationEvaluationDraft"
import { useTechnicalConfigurationEvaluationNavigator } from "../../_hooks/useTechnicalConfigurationEvaluationNavigator"
import { useTechnicalConfigurationGuardedNavigation } from "../../_hooks/useTechnicalConfigurationGuardedNavigation"
import type { TechnicalConfigurationBaselineGroupWire } from "@/app/(app)/technical-configurations/baseline-types"
import { TECHNICAL_CONFIGURATION_CRITERION_PAGE_SIZE } from "../../comparison-matrix-constants"
import type { TechnicalConfigurationComparisonOption } from "../../comparison-types"
import type { TechnicalConfigurationOptionWire } from "../../supplier-option-types"
import { toTechnicalConfigurationComparisonOption } from "../../technical-configuration-comparison-mappers"
import type { TechnicalConfigurationDossierWire } from "../../types"
import { createTechnicalConfigurationOptionCriterionDetail } from "../comparison/technical-configuration-criterion-detail"
import { buildTechnicalConfigurationEvaluationProgress } from "./technical-configuration-evaluation-progress"
import { TechnicalConfigurationEvaluationLoadError } from "./TechnicalConfigurationEvaluationLoadError"
import { TechnicalConfigurationEvaluationNavigatorPane } from "./TechnicalConfigurationEvaluationNavigatorPane"
import { TechnicalConfigurationEvaluationPanel } from "./TechnicalConfigurationEvaluationPanel"
import { TechnicalConfigurationProgressSummary } from "./TechnicalConfigurationProgressSummary"
import { toTechnicalConfigurationSaveErrorMessage } from "./TechnicalConfigurationEvaluationWorkspaceUtils"

type TechnicalConfigurationEvaluationActiveWorkspaceProps = {
  dossier: TechnicalConfigurationDossierWire
  baselineVersionId: string
  baselineGroups: TechnicalConfigurationBaselineGroupWire[]
  options: TechnicalConfigurationOptionWire[]
  onDirtyChange: (dirty: boolean) => void
  onNavigationBlockedChange: (blocked: boolean) => void
  onRevisionChange?: (revision: number) => void
}

/** Owns the selected option, page, criterion and P12A1 draft for evaluation mode. */
export function TechnicalConfigurationEvaluationActiveWorkspace({
  dossier,
  baselineVersionId,
  baselineGroups,
  options,
  onDirtyChange,
  onNavigationBlockedChange,
  onRevisionChange,
}: Readonly<TechnicalConfigurationEvaluationActiveWorkspaceProps>) {
  const detailReturnFocusRef = React.useRef<HTMLElement | null>(null)
  const navigator = useTechnicalConfigurationEvaluationNavigator({
    options,
    baselineGroups,
    baselineVersionId,
    pageSize: TECHNICAL_CONFIGURATION_CRITERION_PAGE_SIZE,
  })
  const comparison = useTechnicalConfigurationComparison({
    baselineVersionId,
    optionIds: navigator.activeSelectedOptionId ? [navigator.activeSelectedOptionId] : [],
    page: navigator.currentCriterion?.canonicalPage ?? 1,
    pageSize: TECHNICAL_CONFIGURATION_CRITERION_PAGE_SIZE,
  })
  const result = comparison.comparisonQuery.data
  const currentRow =
    result?.data.criteria.find((row) => row.criterion.id === navigator.criterionId) ?? null
  const evaluation = useTechnicalConfigurationEvaluationDraft({
    optionId: navigator.activeSelectedOptionId,
    baselineVersionId,
    criterionId: navigator.criterionId,
    expectedDossierRevision: dossier.revision,
    onDossierRevisionChange: onRevisionChange,
  })
  const { assessmentQuery, comparisonSetQuery } = evaluation
  const {
    error: assessmentQueryError,
    isError: isAssessmentQueryError,
    refetch: refetchAssessments,
  } = assessmentQuery
  const {
    error: comparisonSetQueryError,
    isError: isComparisonSetQueryError,
    refetch: refetchComparisonSet,
  } = comparisonSetQuery
  const isDirty = evaluation.draft?.isDirty ?? false
  const isNavigationBlocked = evaluation.isSaving || navigator.isTransitionPending
  const { requestNavigation, discardConfirmationDialog } =
    useTechnicalConfigurationGuardedNavigation({
      isDirty,
      isBlocked: evaluation.isSaving,
      onDiscard: evaluation.discard,
    })
  const hasEvaluationReadError = isComparisonSetQueryError || isAssessmentQueryError
  const evaluationReadError = isComparisonSetQueryError
    ? comparisonSetQueryError
    : assessmentQueryError
  const progress = React.useMemo(
    () =>
      buildTechnicalConfigurationEvaluationProgress({
        groups: baselineGroups,
        assessments: Object.values(evaluation.assessmentsByCriterionId),
      }),
    [baselineGroups, evaluation.assessmentsByCriterionId]
  )

  React.useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-pass-live-state-to-parent, react-doctor/no-pass-data-to-parent, react-doctor/no-prop-callback-in-effect -- P12A2 exposes one criterion-local draft to every enclosing navigation boundary.
    onDirtyChange(isDirty)
  }, [isDirty, onDirtyChange])
  React.useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-pass-live-state-to-parent, react-doctor/no-pass-data-to-parent, react-doctor/no-prop-callback-in-effect -- Pending assessment saves hard-block option, page, mode, tab and dossier navigation.
    onNavigationBlockedChange(isNavigationBlocked)
  }, [isNavigationBlocked, onNavigationBlockedChange])
  React.useEffect(
    () => () => {
      onDirtyChange(false)
      onNavigationBlockedChange(false)
    },
    [onDirtyChange, onNavigationBlockedChange]
  )

  const handleOptionChange = React.useCallback(
    (nextOptionId: string) => {
      if (isNavigationBlocked) return
      navigator.changeOption(nextOptionId, requestNavigation)
    },
    [isNavigationBlocked, navigator, requestNavigation]
  )
  const handleFilterChange = React.useCallback(
    (nextFilter: Parameters<typeof navigator.changeFilter>[0]) => {
      if (isNavigationBlocked) return
      navigator.changeFilter(nextFilter, requestNavigation)
    },
    [isNavigationBlocked, navigator, requestNavigation]
  )
  const handlePageChange = React.useCallback(
    (nextPage: number) => {
      navigator.changePage(nextPage, requestNavigation)
    },
    [navigator, requestNavigation]
  )
  const handleCriterionChange = React.useCallback(
    (nextCriterionId: string) => {
      navigator.changeCriterion(nextCriterionId, requestNavigation, () => {
        detailReturnFocusRef.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null
      })
    },
    [navigator, requestNavigation]
  )
  const handleSave = React.useCallback(async () => {
    try {
      await evaluation.save()
    } catch {
      // The draft hook preserves input and exposes the actionable error.
    }
  }, [evaluation])
  const handleSaveAndContinue = React.useCallback(async () => {
    try {
      await evaluation.save()
      await navigator.advanceAfterSave()
    } catch {
      // Failed saves intentionally remain on the current criterion.
    }
  }, [evaluation, navigator])
  const handleRetryEvaluationData = React.useCallback(() => {
    if (isComparisonSetQueryError) {
      void refetchComparisonSet()
    }
    if (isAssessmentQueryError) {
      void refetchAssessments()
    }
    if (navigator.criteriaQuery.isError) {
      void navigator.criteriaQuery.refetch()
    }
  }, [
    isAssessmentQueryError,
    isComparisonSetQueryError,
    navigator.criteriaQuery,
    refetchAssessments,
    refetchComparisonSet,
  ])

  const comparisonOption: TechnicalConfigurationComparisonOption | null = navigator.selectedOption
    ? (result?.data.options.find((option) => option.id === navigator.activeSelectedOptionId) ??
      toTechnicalConfigurationComparisonOption(navigator.selectedOption))
    : null
  const currentOptionValue =
    currentRow && comparisonOption
      ? currentRow.optionValues.find((value) => value.optionId === comparisonOption.id)
      : undefined
  const detail =
    currentRow && comparisonOption
      ? createTechnicalConfigurationOptionCriterionDetail({
          row: currentRow,
          option: comparisonOption,
          value: currentOptionValue,
          baselineVersionId,
        })
      : null
  const draft = evaluation.draft
  const saveDisabled =
    Boolean(dossier.archived_at) || !evaluation.isReady || !isDirty || isNavigationBlocked

  return (
    <section className="min-w-0 space-y-4" aria-label="Không gian đánh giá cấu hình kỹ thuật">
      <div className="flex flex-col gap-2 border-y py-3 sm:flex-row sm:items-center sm:justify-between">
        <Label htmlFor="technical-configuration-evaluation-option">Phương án đánh giá</Label>
        <Select
          value={navigator.activeSelectedOptionId}
          onValueChange={handleOptionChange}
          disabled={isNavigationBlocked}
        >
          <SelectTrigger
            id="technical-configuration-evaluation-option"
            aria-label="Phương án đánh giá"
            className="w-full sm:max-w-md"
          >
            <SelectValue placeholder="Chọn phương án" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.display_label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <TechnicalConfigurationProgressSummary
        progress={progress}
        isLoading={comparisonSetQuery.isLoading || assessmentQuery.isLoading}
        isError={hasEvaluationReadError}
      />

      <TechnicalConfigurationEvaluationNavigatorPane
        statusFilter={navigator.statusFilter}
        onStatusFilterChange={handleFilterChange}
        criteria={navigator.pageCriteria}
        assessmentsByCriterionId={evaluation.assessmentsByCriterionId}
        currentCriterionId={navigator.criterionId}
        onSelectCriterion={handleCriterionChange}
        page={navigator.filteredPage}
        pageSize={TECHNICAL_CONFIGURATION_CRITERION_PAGE_SIZE}
        total={navigator.projection.length}
        onPageChange={handlePageChange}
        disabled={isNavigationBlocked}
        isLoading={navigator.criteriaQuery.isLoading || navigator.isTransitionPending}
        isError={navigator.criteriaQuery.isError}
        error={navigator.criteriaQuery.error}
        onRetry={() => void navigator.criteriaQuery.refetch()}
        isCurrentCriterionFilteredOut={navigator.isCurrentCriterionFilteredOut}
        hasNoMoreMatches={navigator.hasNoMoreMatches}
      />

      {comparison.comparisonQuery.isLoading ? (
        <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Đang tải tiêu chí...
        </div>
      ) : null}
      {comparison.comparisonQuery.isError ? (
        <TechnicalConfigurationEvaluationLoadError
          title="Không thể tải tiêu chí đánh giá"
          error={comparison.comparisonQuery.error}
          fallback="Không thể tải dữ liệu so sánh."
          onRetry={() => void comparison.comparisonQuery.refetch()}
        />
      ) : null}
      {hasEvaluationReadError ? (
        <TechnicalConfigurationEvaluationLoadError
          title="Không thể tải dữ liệu đánh giá"
          error={evaluationReadError}
          fallback="Không thể tải comparison set hoặc đánh giá đã lưu."
          onRetry={handleRetryEvaluationData}
        />
      ) : null}

      <TechnicalConfigurationEvaluationPanel
        detail={detail}
        open={navigator.isPanelOpen && detail !== null}
        onOpenChange={navigator.setIsPanelOpen}
        returnFocusRef={detailReturnFocusRef}
        technicalAxis={draft?.technicalAxis ?? null}
        evidenceAxis={draft?.evidenceAxis ?? null}
        notes={draft?.notes ?? ""}
        onTechnicalAxisChange={evaluation.setTechnicalAxis}
        onEvidenceAxisChange={evaluation.setEvidenceAxis}
        onNotesChange={evaluation.setNotes}
        disabled={Boolean(dossier.archived_at) || navigator.isTransitionPending}
        loading={!evaluation.isReady}
        errorMessage={
          evaluation.error ? toTechnicalConfigurationSaveErrorMessage(evaluation.error) : null
        }
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={saveDisabled}
              onClick={() => void handleSave()}
            >
              {isNavigationBlocked ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              Lưu
            </Button>
            <Button
              type="button"
              disabled={saveDisabled}
              onClick={() => void handleSaveAndContinue()}
            >
              <StepForward className="size-4" aria-hidden="true" />
              Lưu &amp; tiếp tục
            </Button>
          </>
        }
      />
      {discardConfirmationDialog}
    </section>
  )
}
