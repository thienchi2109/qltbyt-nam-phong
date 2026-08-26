"use client"

import type { TechnicalConfigurationEvaluationRequestNavigation } from "../../_hooks/useTechnicalConfigurationEvaluationHierarchyPresentation"
import type { useTechnicalConfigurationEvaluationNavigator } from "../../_hooks/useTechnicalConfigurationEvaluationNavigator"
import type {
  TechnicalConfigurationAssessmentWire,
  TechnicalConfigurationEvaluationStatusFilter,
} from "../../assessment-types"
import { TECHNICAL_CONFIGURATION_CRITERION_PAGE_SIZE } from "../../comparison-matrix-constants"
import type { TechnicalConfigurationEvaluationProgress } from "./technical-configuration-evaluation-progress"
import {
  TechnicalConfigurationEvaluationNavigatorDrawer,
  type TechnicalConfigurationEvaluationNavigatorDrawerNavigation,
} from "./TechnicalConfigurationEvaluationNavigatorDrawer"

type Navigator = ReturnType<typeof useTechnicalConfigurationEvaluationNavigator>

type TechnicalConfigurationEvaluationWorkspaceNavigatorDrawerProps = {
  navigator: Navigator
  progress: TechnicalConfigurationEvaluationProgress
  assessmentsByCriterionId: Readonly<Record<string, TechnicalConfigurationAssessmentWire>>
  page: number
  disabled: boolean
  isProgressLoading: boolean
  hasProgressError: boolean
  progressError: unknown
  onStatusFilterChange: (filter: TechnicalConfigurationEvaluationStatusFilter) => void
  onPageChange: (page: number) => void
  onRetry: () => void
  requestNavigation: TechnicalConfigurationEvaluationRequestNavigation
  onReturnFocusTarget: (target: HTMLElement | null) => void
}

/** Adapts workspace hooks to the on-demand hierarchy drawer. */
export function TechnicalConfigurationEvaluationWorkspaceNavigatorDrawer({
  navigator,
  progress,
  assessmentsByCriterionId,
  page,
  disabled,
  isProgressLoading,
  hasProgressError,
  progressError,
  onStatusFilterChange,
  onPageChange,
  onRetry,
  requestNavigation,
  onReturnFocusTarget,
}: Readonly<TechnicalConfigurationEvaluationWorkspaceNavigatorDrawerProps>) {
  const handleSelectCriterion = (
    criterionId: string,
    navigation: TechnicalConfigurationEvaluationNavigatorDrawerNavigation
  ) => {
    navigator.changeCriterion(criterionId, requestNavigation, () => {
      onReturnFocusTarget(navigation.returnFocusTarget)
      navigation.closeDrawer()
    })
  }

  return (
    <TechnicalConfigurationEvaluationNavigatorDrawer
      disabled={disabled}
      navigatorProps={{
        statusFilter: navigator.statusFilter,
        onStatusFilterChange,
        criteria: navigator.hierarchyRows,
        progress,
        assessmentsByCriterionId,
        currentCriterionId: navigator.criterionId,
        page,
        pageSize: TECHNICAL_CONFIGURATION_CRITERION_PAGE_SIZE,
        total: navigator.projection.length,
        onPageChange,
        disabled,
        isLoading:
          navigator.criteriaQuery.isLoading || navigator.isTransitionPending || isProgressLoading,
        isError: navigator.criteriaQuery.isError || hasProgressError,
        error: hasProgressError ? progressError : navigator.criteriaQuery.error,
        onRetry,
        isCurrentCriterionFilteredOut: navigator.isCurrentCriterionFilteredOut,
        hasNoMoreMatches: navigator.hasNoMoreMatches,
        expandedRowIds: navigator.expandedRowIds,
        onExpandedRowIdsChange: navigator.onExpandedRowIdsChange,
      }}
      onSelectCriterion={handleSelectCriterion}
    />
  )
}
