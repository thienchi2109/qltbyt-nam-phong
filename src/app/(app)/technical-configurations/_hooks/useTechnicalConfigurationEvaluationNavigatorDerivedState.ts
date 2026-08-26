"use client"

import * as React from "react"

import type { TechnicalConfigurationEvaluationStatusFilter } from "../assessment-types"
import { buildTechnicalConfigurationEvaluationProjection } from "../_components/evaluation/technical-configuration-evaluation-navigation"
import { useTechnicalConfigurationEvaluationCriteria } from "./useTechnicalConfigurationEvaluationCriteria"
import {
  resolveTechnicalConfigurationEvaluationTargetCriterion,
  type UseTechnicalConfigurationEvaluationNavigatorInput,
  useTechnicalConfigurationEvaluationHierarchyPresentation,
} from "./useTechnicalConfigurationEvaluationHierarchyPresentation"

type UseTechnicalConfigurationEvaluationNavigatorDerivedStateInput =
  UseTechnicalConfigurationEvaluationNavigatorInput & {
    selectedOptionId: string
    setSelectedOptionId: React.Dispatch<React.SetStateAction<string>>
    statusFilter: TechnicalConfigurationEvaluationStatusFilter
    canonicalPage: number
    requestedCriterionId: string | null
  }

/** Resolves query-backed selection and hierarchy state for the evaluation navigator. */
export function useTechnicalConfigurationEvaluationNavigatorDerivedState({
  options,
  baselineGroups,
  baselineVersionId,
  pageSize,
  selectedOptionId,
  setSelectedOptionId,
  statusFilter,
  canonicalPage,
  requestedCriterionId,
}: UseTechnicalConfigurationEvaluationNavigatorDerivedStateInput) {
  const selectedOption = options.find((option) => option.id === selectedOptionId) ?? options[0]
  const activeSelectedOptionId = selectedOption?.id ?? ""
  if (selectedOptionId !== activeSelectedOptionId) setSelectedOptionId(activeSelectedOptionId)

  const { criteriaQuery, loadCriteria } = useTechnicalConfigurationEvaluationCriteria({
    optionId: activeSelectedOptionId,
    baselineVersionId,
    statusFilter,
  })
  const projection = React.useMemo(
    () =>
      buildTechnicalConfigurationEvaluationProjection({
        groups: baselineGroups,
        entries: criteriaQuery.data ?? [],
      }),
    [baselineGroups, criteriaQuery.data]
  )
  const criterionId =
    requestedCriterionId ??
    projection.find((item) => item.canonicalPage === canonicalPage)?.criterion.id ??
    null
  const { hierarchyRows, expandedRowIds, onExpandedRowIdsChange, expandCriterionAncestors } =
    useTechnicalConfigurationEvaluationHierarchyPresentation(
      projection,
      canonicalPage,
      criterionId,
      `${activeSelectedOptionId}:${statusFilter}`
    )
  const currentCriterion = React.useMemo(
    () =>
      resolveTechnicalConfigurationEvaluationTargetCriterion(
        projection,
        baselineGroups,
        criterionId,
        pageSize
      ),
    [baselineGroups, criterionId, pageSize, projection]
  )
  const isCurrentCriterionFilteredOut =
    criterionId !== null &&
    !criteriaQuery.isLoading &&
    !criteriaQuery.isError &&
    !projection.some((item) => item.criterion.id === criterionId)

  return {
    selectedOption,
    activeSelectedOptionId,
    criteriaQuery,
    loadCriteria,
    projection,
    criterionId,
    hierarchyRows,
    expandedRowIds,
    onExpandedRowIdsChange,
    expandCriterionAncestors,
    currentCriterion,
    isCurrentCriterionFilteredOut,
  }
}
