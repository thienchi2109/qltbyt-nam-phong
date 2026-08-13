"use client"

import * as React from "react"

import { useTechnicalConfigurationComparison } from "../../_hooks/useTechnicalConfigurationComparison"
import { useTechnicalConfigurationComparisonMatrix } from "../../_hooks/useTechnicalConfigurationComparisonMatrix"
import { useTechnicalConfigurationEvaluationDraft } from "../../_hooks/useTechnicalConfigurationEvaluationDraft"
import { useTechnicalConfigurationEvaluationNavigator } from "../../_hooks/useTechnicalConfigurationEvaluationNavigator"
import { useTechnicalConfigurationEvaluationWorkspaceActions } from "../../_hooks/useTechnicalConfigurationEvaluationWorkspaceActions"
import { useTechnicalConfigurationGuardedNavigation } from "../../_hooks/useTechnicalConfigurationGuardedNavigation"
import type { TechnicalConfigurationBaselineGroupWire } from "../../baseline-types"
import { TECHNICAL_CONFIGURATION_CRITERION_PAGE_SIZE } from "../../comparison-matrix-constants"
import type { TechnicalConfigurationComparisonOption } from "../../comparison-types"
import type { TechnicalConfigurationOptionWire } from "../../supplier-option-types"
import { toTechnicalConfigurationComparisonOption } from "../../technical-configuration-comparison-mappers"
import type { TechnicalConfigurationDossierWire } from "../../types"
import {
  TechnicalConfigurationCriterionPanel,
  type TechnicalConfigurationCriterionDetail,
} from "../comparison/TechnicalConfigurationCriterionPanel"
import { TechnicalConfigurationMatrix } from "../comparison/TechnicalConfigurationMatrix"
import { createTechnicalConfigurationOptionCriterionDetail } from "../comparison/technical-configuration-criterion-detail"
import { buildTechnicalConfigurationEvaluationMatrixPresentation } from "./technical-configuration-evaluation-matrix-presentation"
import { TechnicalConfigurationEvaluationFeedback } from "./TechnicalConfigurationEvaluationFeedback"
import { TechnicalConfigurationEvaluationMatrixControls } from "./TechnicalConfigurationEvaluationMatrixControls"
import { TechnicalConfigurationEvaluationMatrixToolbar } from "./TechnicalConfigurationEvaluationMatrixToolbar"
import { TechnicalConfigurationEvaluationNavigatorPane } from "./TechnicalConfigurationEvaluationNavigatorPane"
import { TechnicalConfigurationEvaluationPanel } from "./TechnicalConfigurationEvaluationPanel"
import { TechnicalConfigurationProgressSummary } from "./TechnicalConfigurationProgressSummary"
import { TechnicalConfigurationResultExportControl } from "./TechnicalConfigurationResultExportControl"
import { TechnicalConfigurationEvaluationSaveActions } from "./TechnicalConfigurationEvaluationSaveActions"
import { toTechnicalConfigurationSaveErrorMessage } from "./TechnicalConfigurationEvaluationWorkspaceUtils"

type TechnicalConfigurationEvaluationActiveWorkspaceProps = {
  dossier: TechnicalConfigurationDossierWire
  baselineVersionId: string
  baselineRevision: number
  baselineGroups: TechnicalConfigurationBaselineGroupWire[]
  options: TechnicalConfigurationOptionWire[]
  matrix: ReturnType<typeof useTechnicalConfigurationComparisonMatrix>
  onDirtyChange: (dirty: boolean) => void
  onNavigationBlockedChange: (blocked: boolean) => void
  onRevisionChange?: (revision: number) => void
}

/** Owns matrix-based criterion selection and one supplier-local assessment draft. */
export function TechnicalConfigurationEvaluationActiveWorkspace({
  dossier,
  baselineVersionId,
  baselineRevision,
  baselineGroups,
  options,
  matrix,
  onDirtyChange,
  onNavigationBlockedChange,
  onRevisionChange,
}: Readonly<TechnicalConfigurationEvaluationActiveWorkspaceProps>) {
  const evaluationReturnFocusRef = React.useRef<HTMLElement | null>(null)
  const readOnlyReturnFocusRef = React.useRef<HTMLElement | null>(null)
  const [readOnlyDetail, setReadOnlyDetail] =
    React.useState<TechnicalConfigurationCriterionDetail | null>(null)
  const navigator = useTechnicalConfigurationEvaluationNavigator({
    options,
    baselineGroups,
    baselineVersionId,
    pageSize: TECHNICAL_CONFIGURATION_CRITERION_PAGE_SIZE,
  })
  const { comparisonQuery } = matrix.comparison
  const matrixResult = comparisonQuery.data
  const panelPage = navigator.currentCriterion?.canonicalPage ?? matrix.page
  const canReuseMatrixResult =
    panelPage === matrix.page &&
    Boolean(
      navigator.activeSelectedOptionId &&
      matrixResult?.data.options.some((option) => option.id === navigator.activeSelectedOptionId)
    )
  const panelComparison = useTechnicalConfigurationComparison({
    baselineVersionId,
    optionIds:
      !canReuseMatrixResult && navigator.activeSelectedOptionId
        ? [navigator.activeSelectedOptionId]
        : [],
    page: panelPage,
    pageSize: TECHNICAL_CONFIGURATION_CRITERION_PAGE_SIZE,
  })
  const panelResult = panelComparison.comparisonQuery.data
  const criterionResult = canReuseMatrixResult ? matrixResult : panelResult
  const currentRow =
    criterionResult?.data.criteria.find((row) => row.criterion.id === navigator.criterionId) ?? null
  const evaluation = useTechnicalConfigurationEvaluationDraft({
    optionId: navigator.activeSelectedOptionId,
    baselineVersionId,
    criterionId: navigator.criterionId,
    expectedDossierRevision: dossier.revision,
    onDossierRevisionChange: onRevisionChange,
  })
  const { assessmentQuery, comparisonSetQuery } = evaluation
  const isDirty = evaluation.draft?.isDirty ?? false
  const isNavigationBlocked = evaluation.isSaving || navigator.isTransitionPending
  const { requestNavigation, discardConfirmationDialog } =
    useTechnicalConfigurationGuardedNavigation({
      isDirty,
      isBlocked: evaluation.isSaving,
      onDiscard: evaluation.discard,
    })
  const hasEvaluationReadError = comparisonSetQuery.isError || assessmentQuery.isError
  const isEvaluationReadLoading = comparisonSetQuery.isLoading || assessmentQuery.isLoading
  const evaluationReadError = comparisonSetQuery.isError
    ? comparisonSetQuery.error
    : assessmentQuery.error
  const matrixPresentation = React.useMemo(
    () =>
      buildTechnicalConfigurationEvaluationMatrixPresentation({
        groups: baselineGroups,
        assessmentsByCriterionId: evaluation.assessmentsByCriterionId,
        projection: navigator.projection,
        statusFilter: navigator.statusFilter,
      }),
    [
      baselineGroups,
      evaluation.assessmentsByCriterionId,
      navigator.projection,
      navigator.statusFilter,
    ]
  )

  React.useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-pass-live-state-to-parent, react-doctor/no-pass-data-to-parent, react-doctor/no-prop-callback-in-effect -- WorkspaceShell owns top-level navigation guards.
    onDirtyChange(isDirty)
  }, [isDirty, onDirtyChange])
  React.useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-pass-live-state-to-parent, react-doctor/no-pass-data-to-parent, react-doctor/no-prop-callback-in-effect -- Save and filtered transition state must block enclosing navigation.
    onNavigationBlockedChange(isNavigationBlocked)
  }, [isNavigationBlocked, onNavigationBlockedChange])
  React.useEffect(
    () => () => {
      onDirtyChange(false)
      onNavigationBlockedChange(false)
    },
    [onDirtyChange, onNavigationBlockedChange]
  )

  const handleOpenReadOnlyDetail = React.useCallback(
    (detail: TechnicalConfigurationCriterionDetail) => {
      readOnlyReturnFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      setReadOnlyDetail(detail)
    },
    []
  )
  const {
    handleOptionChange,
    handleFilterChange,
    handleOpenEvaluation,
    handleMatrixPageChange,
    handleSave,
    handleSaveAndContinue,
    handleRetryEvaluationData,
    closeEvaluationPanel,
    runMatrixContextChange,
  } = useTechnicalConfigurationEvaluationWorkspaceActions({
    evaluation,
    navigator,
    matrix,
    requestNavigation,
    isNavigationBlocked,
    evaluationReturnFocusRef,
  })

  const comparisonOption: TechnicalConfigurationComparisonOption | null = navigator.selectedOption
    ? (panelResult?.data.options.find((option) => option.id === navigator.activeSelectedOptionId) ??
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
  const hasMatrixRequest = matrix.baselineVersionId !== null && matrix.selectedOptionIds.length > 0

  return (
    <section className="min-w-0 space-y-4" aria-label="Không gian đánh giá cấu hình kỹ thuật">
      <TechnicalConfigurationEvaluationMatrixToolbar
        matrix={matrix}
        activeOptionId={navigator.activeSelectedOptionId}
        navigationBlocked={isNavigationBlocked}
        runContextChange={runMatrixContextChange}
      />

      <div className="flex justify-end">
        <TechnicalConfigurationResultExportControl
          key={`${dossier.id}:${baselineVersionId}`}
          dossierId={dossier.id}
          baselineVersionId={baselineVersionId}
          baselineRevision={baselineRevision}
          options={matrix.selectedOptions}
          baselineGroups={baselineGroups}
          activeOptionId={navigator.activeSelectedOptionId}
          currentCriteria={matrixResult?.data.criteria ?? []}
        />
      </div>

      <TechnicalConfigurationEvaluationMatrixControls
        options={options}
        activeOptionId={navigator.activeSelectedOptionId}
        onOptionChange={handleOptionChange}
        statusFilter={navigator.statusFilter}
        onStatusFilterChange={handleFilterChange}
        disabled={isNavigationBlocked}
        isLoading={navigator.criteriaQuery.isLoading || navigator.isTransitionPending}
        isError={navigator.criteriaQuery.isError}
        error={navigator.criteriaQuery.error}
        onRetry={() => void navigator.criteriaQuery.refetch()}
        totalMatches={navigator.projection.length}
        isCurrentCriterionFilteredOut={navigator.isCurrentCriterionFilteredOut}
        hasNoMoreMatches={navigator.hasNoMoreMatches}
      />

      <TechnicalConfigurationProgressSummary
        progress={matrixPresentation.progress}
        isLoading={isEvaluationReadLoading}
        isError={hasEvaluationReadError}
      />

      <TechnicalConfigurationEvaluationNavigatorPane
        statusFilter={navigator.statusFilter}
        onStatusFilterChange={handleFilterChange}
        criteria={navigator.hierarchyRows}
        progress={matrixPresentation.progress}
        assessmentsByCriterionId={evaluation.assessmentsByCriterionId}
        currentCriterionId={navigator.criterionId}
        onSelectCriterion={(criterionId) => {
          navigator.changeCriterion(criterionId, requestNavigation, () => {
            evaluationReturnFocusRef.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null
          })
        }}
        listOnly
        page={matrix.page}
        pageSize={TECHNICAL_CONFIGURATION_CRITERION_PAGE_SIZE}
        total={navigator.projection.length}
        onPageChange={handleMatrixPageChange}
        disabled={isNavigationBlocked}
        isLoading={
          navigator.criteriaQuery.isLoading ||
          navigator.isTransitionPending ||
          isEvaluationReadLoading
        }
        isError={navigator.criteriaQuery.isError || hasEvaluationReadError}
        error={hasEvaluationReadError ? evaluationReadError : navigator.criteriaQuery.error}
        onRetry={handleRetryEvaluationData}
        isCurrentCriterionFilteredOut={navigator.isCurrentCriterionFilteredOut}
        hasNoMoreMatches={navigator.hasNoMoreMatches}
        expandedRowIds={navigator.expandedRowIds}
        onExpandedRowIdsChange={navigator.onExpandedRowIdsChange}
      />

      <TechnicalConfigurationMatrix
        hasRequest={hasMatrixRequest}
        result={matrixResult}
        baselineGroups={baselineGroups}
        visibleOptionIds={matrix.visibleOptionIds}
        pinnedOptionIds={matrix.pinnedOptionIds}
        focusedOptionId={matrix.focusedOptionId}
        isLoading={comparisonQuery.isLoading}
        isError={comparisonQuery.isError}
        error={comparisonQuery.error}
        onRetry={() => void comparisonQuery.refetch()}
        onPageChange={handleMatrixPageChange}
        onOpenDetail={handleOpenReadOnlyDetail}
        activeEvaluationOptionId={navigator.activeSelectedOptionId}
        activeEvaluationCriterionId={navigator.criterionId}
        assessmentStatusByCriterionId={matrixPresentation.assessmentStatusByCriterionId}
        matchingEvaluationCriterionIds={matrixPresentation.matchingEvaluationCriterionIds}
        evaluationDisabled={isNavigationBlocked}
        onOpenEvaluation={handleOpenEvaluation}
      />

      <TechnicalConfigurationEvaluationFeedback
        isPanelOpen={navigator.isPanelOpen}
        isPanelLoading={panelComparison.comparisonQuery.isLoading}
        isPanelError={panelComparison.comparisonQuery.isError}
        panelError={panelComparison.comparisonQuery.error}
        onRetryPanel={() => void panelComparison.comparisonQuery.refetch()}
        hasEvaluationReadError={hasEvaluationReadError}
        evaluationReadError={evaluationReadError}
        onRetryEvaluation={handleRetryEvaluationData}
      />

      <TechnicalConfigurationCriterionPanel
        detail={readOnlyDetail}
        open={readOnlyDetail !== null}
        returnFocusRef={readOnlyReturnFocusRef}
        onOpenChange={(open) => {
          if (!open) setReadOnlyDetail(null)
        }}
      />
      <TechnicalConfigurationEvaluationPanel
        detail={detail}
        open={navigator.isPanelOpen && detail !== null}
        onOpenChange={(open) => {
          if (!open) closeEvaluationPanel()
        }}
        returnFocusRef={evaluationReturnFocusRef}
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
          <TechnicalConfigurationEvaluationSaveActions
            disabled={saveDisabled}
            saving={evaluation.isSaving}
            onSave={() => void handleSave()}
            onSaveAndContinue={() => void handleSaveAndContinue()}
          />
        }
      />
      {discardConfirmationDialog}
    </section>
  )
}
