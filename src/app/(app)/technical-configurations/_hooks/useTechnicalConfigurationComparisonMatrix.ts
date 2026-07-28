"use client"

import * as React from "react"

import { useTechnicalConfigurationBaseline } from "./useTechnicalConfigurationBaseline"
import { useTechnicalConfigurationBaselineVersions } from "./useTechnicalConfigurationBaselineVersions"
import { useTechnicalConfigurationComparison } from "./useTechnicalConfigurationComparison"
import { useTechnicalConfigurationOptionListQuery } from "./useTechnicalConfigurationOptionListQuery"
import type { TechnicalConfigurationOptionWire } from "../supplier-option-types"

const COMPARISON_PAGE_SIZE = 50
const MAX_SELECTED_OPTIONS = 8
const EMPTY_OPTIONS: TechnicalConfigurationOptionWire[] = []

type ComparisonRequestState = {
  baselineVersionId: string | null
  selectedOptionIds: readonly string[]
  page: number
}

type ComparisonRequestAction =
  | { type: "reconcile-options"; availableOptionIds: ReadonlySet<string> }
  | { type: "select-baseline"; baselineVersionId: string | null }
  | { type: "add-option"; optionId: string; availableOptionIds: ReadonlySet<string> }
  | { type: "remove-option"; optionId: string }
  | { type: "set-page"; page: number }

const INITIAL_REQUEST_STATE: ComparisonRequestState = {
  baselineVersionId: null,
  selectedOptionIds: [],
  page: 1,
}

function comparisonRequestReducer(
  state: ComparisonRequestState,
  action: ComparisonRequestAction
): ComparisonRequestState {
  switch (action.type) {
    case "reconcile-options": {
      const selectedOptionIds = state.selectedOptionIds.filter((optionId) =>
        action.availableOptionIds.has(optionId)
      )
      return selectedOptionIds.length === state.selectedOptionIds.length
        ? state
        : { ...state, selectedOptionIds, page: 1 }
    }
    case "select-baseline":
      return state.baselineVersionId === action.baselineVersionId
        ? state
        : { ...state, baselineVersionId: action.baselineVersionId, page: 1 }
    case "add-option":
      if (
        !action.availableOptionIds.has(action.optionId) ||
        state.selectedOptionIds.includes(action.optionId) ||
        state.selectedOptionIds.length >= MAX_SELECTED_OPTIONS
      ) {
        return state
      }
      return {
        ...state,
        selectedOptionIds: [...state.selectedOptionIds, action.optionId],
        page: 1,
      }
    case "remove-option": {
      const selectedOptionIds = state.selectedOptionIds.filter(
        (optionId) => optionId !== action.optionId
      )
      return selectedOptionIds.length === state.selectedOptionIds.length
        ? state
        : { ...state, selectedOptionIds, page: 1 }
    }
    case "set-page":
      return Number.isInteger(action.page) && action.page >= 1 && action.page !== state.page
        ? { ...state, page: action.page }
        : state
  }
}

/** Owns the ordered, bounded request state for the read-only comparison matrix. */
export function useTechnicalConfigurationComparisonMatrix(dossierId: string) {
  const baselineRpc = useTechnicalConfigurationBaseline()
  const { versionsQuery, versions, retryVersions, loadMoreVersions, hasHistoryRecoveryError } =
    useTechnicalConfigurationBaselineVersions({
      dossierId,
      listVersions: baselineRpc.listVersions,
    })
  const { optionsQuery } = useTechnicalConfigurationOptionListQuery(dossierId)
  const options = optionsQuery.data?.options ?? EMPTY_OPTIONS
  const [{ baselineVersionId, selectedOptionIds, page }, dispatch] = React.useReducer(
    comparisonRequestReducer,
    INITIAL_REQUEST_STATE
  )

  const availableOptionIds = React.useMemo(
    () => new Set(options.map((option) => option.id)),
    [options]
  )

  React.useEffect(() => {
    dispatch({ type: "reconcile-options", availableOptionIds })
  }, [availableOptionIds])

  const selectBaselineVersion = React.useCallback((nextBaselineVersionId: string | null) => {
    dispatch({ type: "select-baseline", baselineVersionId: nextBaselineVersionId })
  }, [])

  const addOption = React.useCallback(
    (optionId: string) => {
      dispatch({ type: "add-option", optionId, availableOptionIds })
    },
    [availableOptionIds]
  )

  const removeOption = React.useCallback((optionId: string) => {
    dispatch({ type: "remove-option", optionId })
  }, [])

  const setPage = React.useCallback((nextPage: number) => {
    dispatch({ type: "set-page", page: nextPage })
  }, [])

  const selectedOptions = React.useMemo(() => {
    const optionById = new Map(options.map((option) => [option.id, option]))
    return selectedOptionIds.flatMap((optionId) => {
      const option = optionById.get(optionId)
      return option ? [option] : []
    })
  }, [options, selectedOptionIds])

  const comparison = useTechnicalConfigurationComparison({
    baselineVersionId,
    optionIds: selectedOptionIds,
    page,
    pageSize: COMPARISON_PAGE_SIZE,
  })

  return {
    versionsQuery,
    versions,
    retryVersions,
    loadMoreVersions,
    hasHistoryRecoveryError,
    optionsQuery,
    options,
    baselineVersionId,
    selectedOptionIds,
    selectedOptions,
    page,
    pageSize: COMPARISON_PAGE_SIZE,
    isSelectionLimitReached: selectedOptionIds.length >= MAX_SELECTED_OPTIONS,
    comparison,
    selectBaselineVersion,
    addOption,
    removeOption,
    setPage,
  }
}
