"use client"

import * as React from "react"

import {
  useHierarchicalEditorStructure,
  type HierarchicalEditorStructureLayout,
} from "@/components/hierarchical-editor/useHierarchicalEditorStructure"

const STRUCTURE_PREFERENCE_KEY = "technical-configuration-baseline-structure"

export type TechnicalConfigurationBaselineStructureLayout = HierarchicalEditorStructureLayout

/** Resolves the responsive Structure rail while preserving a manual session preference. */
export function useTechnicalConfigurationBaselineStructure(
  containerRef: React.RefObject<HTMLDivElement | null>
): Readonly<{
  expanded: boolean
  layout: TechnicalConfigurationBaselineStructureLayout
  toggle: () => void
}> {
  return useHierarchicalEditorStructure({
    containerRef,
    preferenceKey: STRUCTURE_PREFERENCE_KEY,
  })
}
