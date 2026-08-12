"use client"

import * as React from "react"

import type {
  TechnicalConfigurationEvaluationCriterionWire,
  TechnicalConfigurationEvaluationStatusFilter,
} from "../assessment-types"
import {
  buildTechnicalConfigurationEvaluationProjection,
  findNextTechnicalConfigurationEvaluationCriterion,
} from "../_components/evaluation/technical-configuration-evaluation-navigation"
import { useTechnicalConfigurationEvaluationCriteria } from "./useTechnicalConfigurationEvaluationCriteria"
import {
  resolveTechnicalConfigurationEvaluationContextCriterion,
  resolveTechnicalConfigurationEvaluationTargetCriterion,
  type TechnicalConfigurationEvaluationCriterionCommit,
  type TechnicalConfigurationEvaluationRequestNavigation,
  type UseTechnicalConfigurationEvaluationNavigatorInput,
  useTechnicalConfigurationEvaluationHierarchyPresentation,
} from "./useTechnicalConfigurationEvaluationHierarchyPresentation"
import { useTechnicalConfigurationEvaluationTransition } from "./useTechnicalConfigurationEvaluationTransition"

/** Coordinates filtered leaf selection, canonical paging, and guarded evaluation navigation. */
export function useTechnicalConfigurationEvaluationNavigator({
  options,
  baselineGroups,
  baselineVersionId,
  pageSize,
}: UseTechnicalConfigurationEvaluationNavigatorInput) {
  const [selectedOptionId, setSelectedOptionId] = React.useState(options[0]?.id ?? "")
  const [statusFilter, setStatusFilter] =
    React.useState<TechnicalConfigurationEvaluationStatusFilter>("all")
  const [canonicalPage, setCanonicalPage] = React.useState(1)
  const [requestedCriterionId, setRequestedCriterionId] = React.useState<string | null>(null)
  const [isPanelOpen, setIsPanelOpen] = React.useState(false)
  const [hasNoMoreMatches, setHasNoMoreMatches] = React.useState(false)
  const { isTransitionPending, transitionPendingRef, startTransition } =
    useTechnicalConfigurationEvaluationTransition()
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
  const { hierarchyRows, expandedRowIds, onExpandedRowIdsChange, expandCriterionAncestors } =
    useTechnicalConfigurationEvaluationHierarchyPresentation(projection, canonicalPage)
  const criterionId =
    requestedCriterionId ??
    projection.find((item) => item.canonicalPage === canonicalPage)?.criterion.id ??
    null
  const currentCriterion = resolveTechnicalConfigurationEvaluationTargetCriterion(
    projection,
    baselineGroups,
    criterionId,
    pageSize
  )
  const isCurrentCriterionFilteredOut =
    criterionId !== null &&
    !criteriaQuery.isLoading &&
    !criteriaQuery.isError &&
    !projection.some((item) => item.criterion.id === criterionId)

  const changeFilter = React.useCallback(
    (
      nextFilter: TechnicalConfigurationEvaluationStatusFilter,
      requestNavigation: TechnicalConfigurationEvaluationRequestNavigation,
      onCriterionCommit?: TechnicalConfigurationEvaluationCriterionCommit
    ) => {
      if (nextFilter === statusFilter || !activeSelectedOptionId || transitionPendingRef.current) {
        return
      }

      void startTransition(async () => {
        const entries = await loadCriteria({
          optionId: activeSelectedOptionId,
          baselineVersionId,
          statusFilter: nextFilter,
        })
        const nextProjection = buildTechnicalConfigurationEvaluationProjection({
          groups: baselineGroups,
          entries,
        })
        const currentRemainsVisible =
          criterionId !== null && nextProjection.some((item) => item.criterion.id === criterionId)
        const nextCriterion = resolveTechnicalConfigurationEvaluationContextCriterion(
          nextProjection,
          criterionId,
          canonicalPage
        )
        const nextCriterionId = nextCriterion?.criterion.id ?? null
        const commit = () => {
          expandCriterionAncestors(nextCriterion)
          setStatusFilter(nextFilter)
          if (nextCriterion) setCanonicalPage(nextCriterion.canonicalPage)
          setRequestedCriterionId(nextCriterionId)
          setHasNoMoreMatches(false)
          if (!nextCriterionId) setIsPanelOpen(false)
          onCriterionCommit?.(nextCriterion)
        }

        if (criterionId === null || currentRemainsVisible) {
          commit()
          return
        }
        requestNavigation(commit)
      })
    },
    [
      activeSelectedOptionId,
      baselineGroups,
      baselineVersionId,
      canonicalPage,
      criterionId,
      loadCriteria,
      expandCriterionAncestors,
      startTransition,
      statusFilter,
      transitionPendingRef,
    ]
  )

  const changeOption = React.useCallback(
    (
      nextOptionId: string,
      requestNavigation: TechnicalConfigurationEvaluationRequestNavigation,
      onCriterionCommit?: TechnicalConfigurationEvaluationCriterionCommit
    ) => {
      if (nextOptionId === activeSelectedOptionId || transitionPendingRef.current) return

      requestNavigation(() => {
        void startTransition(async () => {
          const entries = await loadCriteria({
            optionId: nextOptionId,
            baselineVersionId,
            statusFilter,
          })
          const nextProjection = buildTechnicalConfigurationEvaluationProjection({
            groups: baselineGroups,
            entries,
          })
          const nextCriterion = resolveTechnicalConfigurationEvaluationContextCriterion(
            nextProjection,
            criterionId,
            canonicalPage
          )
          const nextCriterionId = nextCriterion?.criterion.id ?? null

          expandCriterionAncestors(nextCriterion)
          setSelectedOptionId(nextOptionId)
          if (nextCriterion) setCanonicalPage(nextCriterion.canonicalPage)
          setRequestedCriterionId(nextCriterionId)
          setIsPanelOpen(false)
          setHasNoMoreMatches(false)
          onCriterionCommit?.(nextCriterion)
        })
      })
    },
    [
      activeSelectedOptionId,
      baselineGroups,
      baselineVersionId,
      canonicalPage,
      criterionId,
      loadCriteria,
      expandCriterionAncestors,
      startTransition,
      statusFilter,
      transitionPendingRef,
    ]
  )

  const changePage = React.useCallback(
    (
      nextPage: number,
      requestNavigation: TechnicalConfigurationEvaluationRequestNavigation,
      onCommit?: () => void
    ) => {
      requestNavigation(() => {
        setCanonicalPage(nextPage)
        setRequestedCriterionId(null)
        setIsPanelOpen(false)
        setHasNoMoreMatches(false)
        onCommit?.()
      })
    },
    []
  )

  const changeCriterion = React.useCallback(
    (
      nextCriterionId: string,
      requestNavigation: TechnicalConfigurationEvaluationRequestNavigation,
      beforeOpen?: () => void
    ) => {
      const navigate = () => {
        expandCriterionAncestors(
          resolveTechnicalConfigurationEvaluationTargetCriterion(
            projection,
            baselineGroups,
            nextCriterionId,
            pageSize
          )
        )
        beforeOpen?.()
        setRequestedCriterionId(nextCriterionId)
        setIsPanelOpen(true)
        setHasNoMoreMatches(false)
      }
      if (nextCriterionId === criterionId) {
        navigate()
        return
      }
      requestNavigation(navigate)
    },
    [baselineGroups, criterionId, expandCriterionAncestors, pageSize, projection]
  )

  const changeTarget = React.useCallback(
    (
      nextOptionId: string,
      nextCriterionId: string,
      requestNavigation: TechnicalConfigurationEvaluationRequestNavigation,
      beforeOpen?: () => void
    ) => {
      if (transitionPendingRef.current) return
      if (nextOptionId === activeSelectedOptionId) {
        changeCriterion(nextCriterionId, requestNavigation, beforeOpen)
        return
      }

      requestNavigation(() => {
        void startTransition(async () => {
          await loadCriteria({
            optionId: nextOptionId,
            baselineVersionId,
            statusFilter,
          })

          expandCriterionAncestors(
            resolveTechnicalConfigurationEvaluationTargetCriterion(
              projection,
              baselineGroups,
              nextCriterionId,
              pageSize
            )
          )
          beforeOpen?.()
          setSelectedOptionId(nextOptionId)
          setRequestedCriterionId(nextCriterionId)
          setIsPanelOpen(true)
          setHasNoMoreMatches(false)
        })
      })
    },
    [
      activeSelectedOptionId,
      baselineVersionId,
      changeCriterion,
      baselineGroups,
      expandCriterionAncestors,
      loadCriteria,
      pageSize,
      projection,
      startTransition,
      statusFilter,
      transitionPendingRef,
    ]
  )

  const advanceAfterSave = React.useCallback(async () => {
    if (!currentCriterion || !activeSelectedOptionId) return null
    const transitionResult: {
      nextCriterion: (typeof projection)[number] | null
    } = { nextCriterion: null }
    await startTransition(async () => {
      const entries = await loadCriteria({
        optionId: activeSelectedOptionId,
        baselineVersionId,
        statusFilter,
      })
      const nextProjection = buildTechnicalConfigurationEvaluationProjection({
        groups: baselineGroups,
        entries,
      })
      transitionResult.nextCriterion = findNextTechnicalConfigurationEvaluationCriterion({
        projection: nextProjection,
        currentCanonicalIndex: currentCriterion.canonicalIndex,
      })

      if (!transitionResult.nextCriterion) {
        setHasNoMoreMatches(true)
        return
      }

      expandCriterionAncestors(transitionResult.nextCriterion)
      setCanonicalPage(transitionResult.nextCriterion.canonicalPage)
      setRequestedCriterionId(transitionResult.nextCriterion.criterion.id)
      setIsPanelOpen(true)
      setHasNoMoreMatches(false)
    })
    return transitionResult.nextCriterion
  }, [
    activeSelectedOptionId,
    baselineGroups,
    baselineVersionId,
    currentCriterion,
    expandCriterionAncestors,
    loadCriteria,
    startTransition,
    statusFilter,
  ])

  return {
    selectedOption,
    activeSelectedOptionId,
    statusFilter,
    projection,
    hierarchyRows,
    expandedRowIds,
    onExpandedRowIdsChange,
    criterionId,
    currentCriterion,
    isPanelOpen,
    setIsPanelOpen,
    hasNoMoreMatches,
    isTransitionPending,
    isCurrentCriterionFilteredOut,
    criteriaQuery,
    changeFilter,
    changeOption,
    changePage,
    changeCriterion,
    changeTarget,
    advanceAfterSave,
  }
}
