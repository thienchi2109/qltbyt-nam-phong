"use client"

import * as React from "react"

import type { CategoryListItem } from "../_types/categories"

type WorkspaceMode = "detail" | "assign"

type UseDeviceQuotaCategoryWorkspaceStateOptions = {
  categories: CategoryListItem[]
  allCategories: CategoryListItem[]
  aggregatedCounts: Map<number, number>
  leafIds: Set<number>
}

function findDefaultCategory(
  categories: CategoryListItem[],
  aggregatedCounts: Map<number, number>,
  leafIds: Set<number>
) {
  return (
    categories.find(
      (category) =>
        leafIds.has(category.id) &&
        (aggregatedCounts.get(category.id) ?? category.so_luong_hien_co) > 0
    ) ??
    categories.find((category) => leafIds.has(category.id)) ??
    categories.find((category) => category.level === 1) ??
    null
  )
}

/** Owns only selected-category and detail/assign workspace UI state. */
export function useDeviceQuotaCategoryWorkspaceState({
  categories,
  allCategories,
  aggregatedCounts,
  leafIds,
}: UseDeviceQuotaCategoryWorkspaceStateOptions) {
  const [explicitSelectedCategoryId, setExplicitSelectedCategoryId] = React.useState<number | null>(
    null
  )
  const [mode, setMode] = React.useState<WorkspaceMode>("detail")
  const [reconciledEquipmentIds, setReconciledEquipmentIds] = React.useState<Set<number>>(new Set())

  const defaultCategory = React.useMemo(
    () => findDefaultCategory(categories, aggregatedCounts, leafIds),
    [aggregatedCounts, categories, leafIds]
  )
  const explicitSelectedCategory = React.useMemo(
    () => allCategories.find((category) => category.id === explicitSelectedCategoryId) ?? null,
    [allCategories, explicitSelectedCategoryId]
  )
  const selectedCategory = explicitSelectedCategory ?? defaultCategory

  const selectCategory = React.useCallback((category: CategoryListItem) => {
    setExplicitSelectedCategoryId(category.id)
    setMode("detail")
    setReconciledEquipmentIds(new Set())
  }, [])

  const startAssignment = React.useCallback(() => {
    if (!selectedCategory) return
    setExplicitSelectedCategoryId(selectedCategory.id)
    setMode("assign")
  }, [selectedCategory])

  const cancelAssignment = React.useCallback(() => {
    setMode("detail")
  }, [])

  const completeAssignment = React.useCallback((confirmedIds: number[]) => {
    setReconciledEquipmentIds(new Set(confirmedIds))
    setMode("detail")
  }, [])

  return {
    selectedCategory,
    selectedCategoryId: selectedCategory?.id ?? null,
    mode,
    reconciledEquipmentIds,
    selectCategory,
    startAssignment,
    cancelAssignment,
    completeAssignment,
  }
}
