"use client"

import * as React from "react"

import {
  buildTechnicalConfigurationEvaluationHierarchyRows,
  type TechnicalConfigurationEvaluationHierarchyLeaf,
} from "../_components/evaluation/technical-configuration-evaluation-hierarchy"
import {
  findTechnicalConfigurationEvaluationCriterion,
  type TechnicalConfigurationEvaluationCriterionListItem,
} from "../_components/evaluation/technical-configuration-evaluation-navigation"
import type { TechnicalConfigurationBaselineGroupWire } from "../baseline-types"
import type { TechnicalConfigurationOptionWire } from "../supplier-option-types"

type PageLeaf = TechnicalConfigurationEvaluationHierarchyLeaf & {
  canonicalPage: number
}

export type TechnicalConfigurationEvaluationRequestNavigation = (navigate: () => void) => void

export type TechnicalConfigurationEvaluationCriterionCommit = (
  criterion: TechnicalConfigurationEvaluationCriterionListItem | null
) => void

export type UseTechnicalConfigurationEvaluationNavigatorInput = {
  options: readonly TechnicalConfigurationOptionWire[]
  baselineGroups: readonly TechnicalConfigurationBaselineGroupWire[]
  baselineVersionId: string
  pageSize: number
}

/** Resolves the selected leaf within the active projection and canonical page context. */
export function resolveTechnicalConfigurationEvaluationContextCriterion<TLeaf extends PageLeaf>(
  projection: readonly TLeaf[],
  criterionId: string | null,
  canonicalPage: number
): TLeaf | null {
  return (
    (criterionId ? projection.find((item) => item.criterion.id === criterionId) : undefined) ??
    projection.find((item) => item.canonicalPage === canonicalPage) ??
    (criterionId ? projection[0] : undefined) ??
    null
  )
}

/** Resolves a selected leaf from the projection or its canonical baseline fallback. */
export function resolveTechnicalConfigurationEvaluationTargetCriterion(
  projection: readonly TechnicalConfigurationEvaluationCriterionListItem[],
  groups: readonly TechnicalConfigurationBaselineGroupWire[],
  criterionId: string | null,
  pageSize: number
) {
  return (
    projection.find((item) => item.criterion.id === criterionId) ??
    findTechnicalConfigurationEvaluationCriterion({ groups, criterionId, pageSize })
  )
}

function getStructuralRowIds(
  rows: ReturnType<typeof buildTechnicalConfigurationEvaluationHierarchyRows>
) {
  return rows.flatMap((row) => (row.kind === "criterion" ? [] : [row.id]))
}

function getAncestorRowIds(leaf: TechnicalConfigurationEvaluationHierarchyLeaf) {
  return leaf.subgroup ? [leaf.group.id, leaf.subgroup.id] : [leaf.group.id]
}

/** Owns page-local hierarchy rows and controlled structural expansion state. */
export function useTechnicalConfigurationEvaluationHierarchyPresentation<TLeaf extends PageLeaf>(
  projection: readonly TLeaf[],
  canonicalPage: number,
  criterionId: string | null,
  contextKey: string
) {
  const hierarchyRows = React.useMemo(
    () =>
      buildTechnicalConfigurationEvaluationHierarchyRows(
        projection.filter((leaf) => leaf.canonicalPage === canonicalPage)
      ),
    [canonicalPage, projection]
  )
  const structuralRowIds = React.useMemo(() => getStructuralRowIds(hierarchyRows), [hierarchyRows])
  const defaultExpandedRowIds = React.useMemo(() => {
    const currentLeaf =
      projection.find(
        (leaf) => leaf.canonicalPage === canonicalPage && leaf.criterion.id === criterionId
      ) ?? projection.find((leaf) => leaf.canonicalPage === canonicalPage)
    return new Set(currentLeaf ? getAncestorRowIds(currentLeaf) : [])
  }, [canonicalPage, criterionId, projection])
  const pageKey = `${contextKey}:${canonicalPage}:${structuralRowIds.join(":")}`
  const [expansion, setExpansion] = React.useState(() => ({
    pageKey,
    rowIds: defaultExpandedRowIds as ReadonlySet<string>,
  }))
  const expandedRowIds = expansion.pageKey === pageKey ? expansion.rowIds : defaultExpandedRowIds
  const onExpandedRowIdsChange = React.useCallback(
    (rowIds: ReadonlySet<string>) => {
      const allowedRowIds = new Set(structuralRowIds)
      setExpansion({
        pageKey,
        rowIds: new Set([...rowIds].filter((rowId) => allowedRowIds.has(rowId))),
      })
    },
    [pageKey, structuralRowIds]
  )
  const expandCriterionAncestors = React.useCallback(
    (leaf: TechnicalConfigurationEvaluationHierarchyLeaf | null) => {
      if (!leaf) return

      const ancestorRowIds = getAncestorRowIds(leaf)
      setExpansion((current) => {
        const currentRowIds = current.pageKey === pageKey ? current.rowIds : defaultExpandedRowIds
        if (ancestorRowIds.every((rowId) => currentRowIds.has(rowId))) return current

        return {
          pageKey,
          rowIds: new Set([...currentRowIds, ...ancestorRowIds]),
        }
      })
    },
    [defaultExpandedRowIds, pageKey]
  )

  return {
    hierarchyRows,
    expandedRowIds,
    onExpandedRowIdsChange,
    expandCriterionAncestors,
  }
}
