"use client"

import * as React from "react"

import type {
  TechnicalConfigurationEvaluationCriterionWire,
  TechnicalConfigurationEvaluationStatusFilter,
} from "../assessment-types"
import type { TechnicalConfigurationBaselineGroupWire } from "../baseline-types"
import type { TechnicalConfigurationOptionWire } from "../supplier-option-types"
import {
  buildTechnicalConfigurationEvaluationProjection,
  findNextTechnicalConfigurationEvaluationCriterion,
  findTechnicalConfigurationEvaluationCriterion,
  getTechnicalConfigurationEvaluationPage,
} from "../_components/evaluation/technical-configuration-evaluation-navigation"
import { useTechnicalConfigurationEvaluationCriteria } from "./useTechnicalConfigurationEvaluationCriteria"

type RequestNavigation = (navigate: () => void) => void

type UseTechnicalConfigurationEvaluationNavigatorInput = {
  options: readonly TechnicalConfigurationOptionWire[]
  baselineGroups: readonly TechnicalConfigurationBaselineGroupWire[]
  baselineVersionId: string
  pageSize: number
}

function getProjectionPage(
  projection: ReturnType<typeof buildTechnicalConfigurationEvaluationProjection>,
  criterionId: string,
  pageSize: number
) {
  const index = projection.findIndex((item) => item.criterion.id === criterionId)
  return index >= 0 ? Math.floor(index / pageSize) + 1 : 1
}

/** Owns P12B2 option, filter, filtered page, selection and no-more-match state. */
export function useTechnicalConfigurationEvaluationNavigator({
  options,
  baselineGroups,
  baselineVersionId,
  pageSize,
}: UseTechnicalConfigurationEvaluationNavigatorInput) {
  const [selectedOptionId, setSelectedOptionId] = React.useState(options[0]?.id ?? "")
  const [statusFilter, setStatusFilter] =
    React.useState<TechnicalConfigurationEvaluationStatusFilter>("all")
  const [page, setPage] = React.useState(1)
  const [requestedCriterionId, setRequestedCriterionId] = React.useState<string | null>(null)
  const [isPanelOpen, setIsPanelOpen] = React.useState(false)
  const [hasNoMoreMatches, setHasNoMoreMatches] = React.useState(false)
  const [isTransitionPending, setIsTransitionPending] = React.useState(false)
  const transitionPendingRef = React.useRef(false)
  const selectedOption = options.find((option) => option.id === selectedOptionId) ?? options[0]
  const activeSelectedOptionId = selectedOption?.id ?? ""
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
  const totalPages = Math.max(1, Math.ceil(projection.length / pageSize))
  const filteredPage = Math.min(page, totalPages)
  const pageCriteria = getTechnicalConfigurationEvaluationPage({
    projection,
    page: filteredPage,
    pageSize,
  })
  const criterionId = requestedCriterionId ?? pageCriteria[0]?.criterion.id ?? null
  const currentCriterion =
    projection.find((item) => item.criterion.id === criterionId) ??
    findTechnicalConfigurationEvaluationCriterion({
      groups: baselineGroups,
      criterionId,
      pageSize,
    })
  const isCurrentCriterionFilteredOut =
    criterionId !== null &&
    !criteriaQuery.isLoading &&
    !criteriaQuery.isError &&
    !projection.some((item) => item.criterion.id === criterionId)

  const startTransition = React.useCallback((transition: () => Promise<void>) => {
    if (transitionPendingRef.current) return

    transitionPendingRef.current = true
    setIsTransitionPending(true)
    void transition()
      .catch(() => {
        // Candidate load failures preserve the current navigation state.
      })
      .finally(() => {
        transitionPendingRef.current = false
        setIsTransitionPending(false)
      })
  }, [])

  const changeFilter = React.useCallback(
    (
      nextFilter: TechnicalConfigurationEvaluationStatusFilter,
      requestNavigation: RequestNavigation
    ) => {
      if (nextFilter === statusFilter || !activeSelectedOptionId || transitionPendingRef.current) {
        return
      }

      startTransition(async () => {
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
        const nextCriterionId = currentRemainsVisible
          ? criterionId
          : (nextProjection[0]?.criterion.id ?? null)
        const commit = () => {
          setStatusFilter(nextFilter)
          setPage(
            nextCriterionId ? getProjectionPage(nextProjection, nextCriterionId, pageSize) : 1
          )
          setRequestedCriterionId(nextCriterionId)
          setHasNoMoreMatches(false)
          if (!nextCriterionId) setIsPanelOpen(false)
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
      criterionId,
      loadCriteria,
      pageSize,
      startTransition,
      statusFilter,
    ]
  )

  const changeOption = React.useCallback(
    (nextOptionId: string, requestNavigation: RequestNavigation) => {
      if (nextOptionId === activeSelectedOptionId || transitionPendingRef.current) return

      requestNavigation(() => {
        startTransition(async () => {
          const entries = await loadCriteria({
            optionId: nextOptionId,
            baselineVersionId,
            statusFilter,
          })
          const nextProjection = buildTechnicalConfigurationEvaluationProjection({
            groups: baselineGroups,
            entries,
          })
          const nextCriterionId =
            (criterionId &&
              nextProjection.find((item) => item.criterion.id === criterionId)?.criterion.id) ||
            nextProjection[0]?.criterion.id ||
            null

          setSelectedOptionId(nextOptionId)
          setPage(
            nextCriterionId ? getProjectionPage(nextProjection, nextCriterionId, pageSize) : 1
          )
          setRequestedCriterionId(nextCriterionId)
          setIsPanelOpen(false)
          setHasNoMoreMatches(false)
        })
      })
    },
    [
      activeSelectedOptionId,
      baselineGroups,
      baselineVersionId,
      criterionId,
      loadCriteria,
      pageSize,
      startTransition,
      statusFilter,
    ]
  )

  const changePage = React.useCallback(
    (nextPage: number, requestNavigation: RequestNavigation) => {
      if (nextPage === filteredPage) return
      requestNavigation(() => {
        setPage(nextPage)
        setRequestedCriterionId(null)
        setHasNoMoreMatches(false)
      })
    },
    [filteredPage]
  )

  const changeCriterion = React.useCallback(
    (nextCriterionId: string, requestNavigation: RequestNavigation, beforeOpen?: () => void) => {
      const navigate = () => {
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
    [criterionId]
  )

  const advanceAfterSave = React.useCallback(async () => {
    if (!currentCriterion || !activeSelectedOptionId) return
    const entries = await loadCriteria({
      optionId: activeSelectedOptionId,
      baselineVersionId,
      statusFilter,
    })
    const nextProjection = buildTechnicalConfigurationEvaluationProjection({
      groups: baselineGroups,
      entries,
    })
    const nextCriterion = findNextTechnicalConfigurationEvaluationCriterion({
      projection: nextProjection,
      currentCanonicalIndex: currentCriterion.canonicalIndex,
    })

    if (!nextCriterion) {
      setHasNoMoreMatches(true)
      return
    }

    setPage(getProjectionPage(nextProjection, nextCriterion.criterion.id, pageSize))
    setRequestedCriterionId(nextCriterion.criterion.id)
    setIsPanelOpen(true)
    setHasNoMoreMatches(false)
  }, [
    activeSelectedOptionId,
    baselineGroups,
    baselineVersionId,
    currentCriterion,
    loadCriteria,
    pageSize,
    statusFilter,
  ])

  return {
    selectedOption,
    activeSelectedOptionId,
    statusFilter,
    filteredPage,
    pageCriteria,
    projection,
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
    advanceAfterSave,
  }
}
