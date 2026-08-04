"use client"

import * as React from "react"

import type { TechnicalConfigurationEvaluationStatusFilter } from "../assessment-types"
import type { TechnicalConfigurationMatrixEvaluationTarget } from "../_components/comparison/TechnicalConfigurationMatrixRow"
import { useTechnicalConfigurationComparisonMatrix } from "./useTechnicalConfigurationComparisonMatrix"
import { useTechnicalConfigurationEvaluationDraft } from "./useTechnicalConfigurationEvaluationDraft"
import { useTechnicalConfigurationEvaluationNavigator } from "./useTechnicalConfigurationEvaluationNavigator"

type RequestNavigation = (navigate: () => void) => void

type UseTechnicalConfigurationEvaluationWorkspaceActionsInput = {
  evaluation: ReturnType<typeof useTechnicalConfigurationEvaluationDraft>
  navigator: ReturnType<typeof useTechnicalConfigurationEvaluationNavigator>
  matrix: ReturnType<typeof useTechnicalConfigurationComparisonMatrix>
  requestNavigation: RequestNavigation
  isNavigationBlocked: boolean
  evaluationReturnFocusRef: React.RefObject<HTMLElement | null>
}

/** Owns guarded matrix, panel and save transitions for the unified evaluator. */
export function useTechnicalConfigurationEvaluationWorkspaceActions({
  evaluation,
  navigator,
  matrix,
  requestNavigation,
  isNavigationBlocked,
  evaluationReturnFocusRef,
}: UseTechnicalConfigurationEvaluationWorkspaceActionsInput) {
  const handleOptionChange = React.useCallback(
    (nextOptionId: string) => {
      if (isNavigationBlocked) return
      navigator.changeOption(nextOptionId, requestNavigation, (nextCriterion) => {
        if (nextCriterion && nextCriterion.canonicalPage !== matrix.page) {
          matrix.setPage(nextCriterion.canonicalPage)
        }
      })
    },
    [isNavigationBlocked, matrix, navigator, requestNavigation]
  )
  const handleFilterChange = React.useCallback(
    (nextFilter: TechnicalConfigurationEvaluationStatusFilter) => {
      if (isNavigationBlocked) return
      navigator.changeFilter(nextFilter, requestNavigation, (nextCriterion) => {
        if (nextCriterion && nextCriterion.canonicalPage !== matrix.page) {
          matrix.setPage(nextCriterion.canonicalPage)
        }
      })
    },
    [isNavigationBlocked, matrix, navigator, requestNavigation]
  )
  const handleOpenEvaluation = React.useCallback(
    (target: TechnicalConfigurationMatrixEvaluationTarget) => {
      if (isNavigationBlocked) return
      navigator.changeTarget(target.optionId, target.criterionId, requestNavigation, () => {
        evaluationReturnFocusRef.current = target.trigger
      })
    },
    [evaluationReturnFocusRef, isNavigationBlocked, navigator, requestNavigation]
  )
  const handleMatrixPageChange = React.useCallback(
    (nextPage: number) => {
      if (nextPage === matrix.page || isNavigationBlocked) return
      navigator.changePage(nextPage, requestNavigation, () => matrix.setPage(nextPage))
    },
    [isNavigationBlocked, matrix, navigator, requestNavigation]
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
      const nextCriterion = await navigator.advanceAfterSave()
      if (nextCriterion && nextCriterion.canonicalPage !== matrix.page) {
        matrix.setPage(nextCriterion.canonicalPage)
      }
    } catch {
      // Failed saves intentionally remain on the current criterion.
    }
  }, [evaluation, matrix, navigator])
  const handleRetryEvaluationData = React.useCallback(() => {
    if (evaluation.comparisonSetQuery.isError) void evaluation.comparisonSetQuery.refetch()
    if (evaluation.assessmentQuery.isError) void evaluation.assessmentQuery.refetch()
    if (navigator.criteriaQuery.isError) void navigator.criteriaQuery.refetch()
  }, [evaluation.assessmentQuery, evaluation.comparisonSetQuery, navigator.criteriaQuery])
  const closeEvaluationPanel = React.useCallback(() => {
    if (isNavigationBlocked) return
    navigator.setIsPanelOpen(false)
  }, [isNavigationBlocked, navigator])
  const runMatrixContextChange = React.useCallback(
    (change: () => void) => {
      if (isNavigationBlocked) return
      requestNavigation(() => {
        navigator.setIsPanelOpen(false)
        change()
      })
    },
    [isNavigationBlocked, navigator, requestNavigation]
  )

  return {
    handleOptionChange,
    handleFilterChange,
    handleOpenEvaluation,
    handleMatrixPageChange,
    handleSave,
    handleSaveAndContinue,
    handleRetryEvaluationData,
    closeEvaluationPanel,
    runMatrixContextChange,
  }
}
