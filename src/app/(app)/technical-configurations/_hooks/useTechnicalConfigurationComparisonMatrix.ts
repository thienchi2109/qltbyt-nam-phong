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

type ComparisonViewState = {
  visibleOptionIds: readonly string[]
  pinnedOptionIds: readonly string[]
  focusedOptionId: string | null
}

type ComparisonMatrixState = {
  request: ComparisonRequestState
  view: ComparisonViewState
}

type ComparisonMatrixAction =
  | { type: "reconcile-options"; availableOptionIds: ReadonlySet<string> }
  | { type: "select-baseline"; baselineVersionId: string | null }
  | { type: "add-option"; optionId: string; availableOptionIds: ReadonlySet<string> }
  | { type: "remove-option"; optionId: string }
  | { type: "set-page"; page: number }
  | { type: "toggle-option-visibility"; optionId: string }
  | { type: "toggle-option-pin"; optionId: string }
  | { type: "focus-option"; optionId: string }
  | { type: "exit-focus" }

const INITIAL_MATRIX_STATE: ComparisonMatrixState = {
  request: {
    baselineVersionId: null,
    selectedOptionIds: [],
    page: 1,
  },
  view: {
    visibleOptionIds: [],
    pinnedOptionIds: [],
    focusedOptionId: null,
  },
}

function comparisonMatrixReducer(
  state: ComparisonMatrixState,
  action: ComparisonMatrixAction
): ComparisonMatrixState {
  switch (action.type) {
    case "reconcile-options": {
      const selectedOptionIds = state.request.selectedOptionIds.filter((optionId) =>
        action.availableOptionIds.has(optionId)
      )
      if (selectedOptionIds.length === state.request.selectedOptionIds.length) {
        return state
      }

      const selectedOptionIdSet = new Set(selectedOptionIds)
      const visibleOptionIds = state.view.visibleOptionIds.filter((optionId) =>
        selectedOptionIdSet.has(optionId)
      )
      const visibleOptionIdSet = new Set(visibleOptionIds)
      return {
        request: { ...state.request, selectedOptionIds, page: 1 },
        view: {
          visibleOptionIds,
          pinnedOptionIds: state.view.pinnedOptionIds.filter((optionId) =>
            visibleOptionIdSet.has(optionId)
          ),
          focusedOptionId: selectedOptionIdSet.has(state.view.focusedOptionId ?? "")
            ? state.view.focusedOptionId
            : null,
        },
      }
    }
    case "select-baseline":
      return state.request.baselineVersionId === action.baselineVersionId
        ? state
        : {
            ...state,
            request: {
              ...state.request,
              baselineVersionId: action.baselineVersionId,
              page: 1,
            },
          }
    case "add-option":
      if (
        !action.availableOptionIds.has(action.optionId) ||
        state.request.selectedOptionIds.includes(action.optionId) ||
        state.request.selectedOptionIds.length >= MAX_SELECTED_OPTIONS
      ) {
        return state
      }
      return {
        ...state,
        request: {
          ...state.request,
          selectedOptionIds: [...state.request.selectedOptionIds, action.optionId],
          page: 1,
        },
        view: {
          visibleOptionIds: [...state.view.visibleOptionIds, action.optionId],
          pinnedOptionIds: state.view.pinnedOptionIds,
          focusedOptionId: state.view.focusedOptionId,
        },
      }
    case "remove-option": {
      const selectedOptionIds = state.request.selectedOptionIds.filter(
        (optionId) => optionId !== action.optionId
      )
      return selectedOptionIds.length === state.request.selectedOptionIds.length
        ? state
        : {
            request: { ...state.request, selectedOptionIds, page: 1 },
            view: {
              visibleOptionIds: state.view.visibleOptionIds.filter(
                (optionId) => optionId !== action.optionId
              ),
              pinnedOptionIds: state.view.pinnedOptionIds.filter(
                (optionId) => optionId !== action.optionId
              ),
              focusedOptionId:
                state.view.focusedOptionId === action.optionId ? null : state.view.focusedOptionId,
            },
          }
    }
    case "set-page":
      return Number.isInteger(action.page) && action.page >= 1 && action.page !== state.request.page
        ? { ...state, request: { ...state.request, page: action.page } }
        : state
    case "toggle-option-visibility": {
      if (!state.request.selectedOptionIds.includes(action.optionId)) return state

      const visibleOptionIdSet = new Set(state.view.visibleOptionIds)
      if (visibleOptionIdSet.has(action.optionId)) {
        return {
          ...state,
          view: {
            visibleOptionIds: state.view.visibleOptionIds.filter(
              (optionId) => optionId !== action.optionId
            ),
            pinnedOptionIds: state.view.pinnedOptionIds.filter(
              (optionId) => optionId !== action.optionId
            ),
            focusedOptionId: state.view.focusedOptionId,
          },
        }
      }

      visibleOptionIdSet.add(action.optionId)
      return {
        ...state,
        view: {
          visibleOptionIds: state.request.selectedOptionIds.filter((optionId) =>
            visibleOptionIdSet.has(optionId)
          ),
          pinnedOptionIds: state.view.pinnedOptionIds,
          focusedOptionId: state.view.focusedOptionId,
        },
      }
    }
    case "toggle-option-pin": {
      if (!state.view.visibleOptionIds.includes(action.optionId)) return state

      const pinnedOptionIdSet = new Set(state.view.pinnedOptionIds)
      if (pinnedOptionIdSet.has(action.optionId)) {
        pinnedOptionIdSet.delete(action.optionId)
      } else {
        if (pinnedOptionIdSet.size >= 2) return state
        pinnedOptionIdSet.add(action.optionId)
      }

      return {
        ...state,
        view: {
          ...state.view,
          pinnedOptionIds: state.request.selectedOptionIds.filter((optionId) =>
            pinnedOptionIdSet.has(optionId)
          ),
        },
      }
    }
    case "focus-option":
      return state.request.selectedOptionIds.includes(action.optionId)
        ? { ...state, view: { ...state.view, focusedOptionId: action.optionId } }
        : state
    case "exit-focus":
      return state.view.focusedOptionId === null
        ? state
        : { ...state, view: { ...state.view, focusedOptionId: null } }
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
  const [{ request, view }, dispatch] = React.useReducer(
    comparisonMatrixReducer,
    INITIAL_MATRIX_STATE
  )
  const { baselineVersionId, selectedOptionIds, page } = request
  const { visibleOptionIds, pinnedOptionIds, focusedOptionId } = view

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

  const toggleOptionVisibility = React.useCallback((optionId: string) => {
    dispatch({ type: "toggle-option-visibility", optionId })
  }, [])

  const toggleOptionPin = React.useCallback((optionId: string) => {
    dispatch({ type: "toggle-option-pin", optionId })
  }, [])

  const focusOption = React.useCallback((optionId: string) => {
    dispatch({ type: "focus-option", optionId })
  }, [])

  const exitFocusMode = React.useCallback(() => {
    dispatch({ type: "exit-focus" })
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
    visibleOptionIds,
    pinnedOptionIds,
    focusedOptionId,
    page,
    pageSize: COMPARISON_PAGE_SIZE,
    isSelectionLimitReached: selectedOptionIds.length >= MAX_SELECTED_OPTIONS,
    comparison,
    selectBaselineVersion,
    addOption,
    removeOption,
    setPage,
    toggleOptionVisibility,
    toggleOptionPin,
    focusOption,
    exitFocusMode,
  }
}
