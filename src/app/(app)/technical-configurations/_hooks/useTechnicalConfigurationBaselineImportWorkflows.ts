import * as React from "react"

import type {
  TechnicalConfigurationBaselineDecodedDraft,
  TechnicalConfigurationBaselineDraftWire,
} from "../baseline-types"
import { decodeTechnicalConfigurationBaselineDraftWire } from "../technical-configuration-baseline-decoders"
import {
  useTechnicalConfigurationBaselineHierarchyImport,
  type UseTechnicalConfigurationBaselineHierarchyImportResult,
} from "./useTechnicalConfigurationBaselineHierarchyImport"
import {
  useTechnicalConfigurationBaselineImport,
  type UseTechnicalConfigurationBaselineImportResult,
} from "./useTechnicalConfigurationBaselineImport"

type UseTechnicalConfigurationBaselineImportWorkflowsOptions = Readonly<{
  dossierId: string
  selectedVersion: TechnicalConfigurationBaselineDraftWire | null
  isBlocked: boolean
  onApplied: (version: TechnicalConfigurationBaselineDraftWire) => Promise<void>
  onConflict: (versionId: string) => Promise<void>
  onUnresolvedStateChange: (unresolved: boolean) => void
}>

export type UseTechnicalConfigurationBaselineImportWorkflowsResult = Readonly<{
  decodedVersion: TechnicalConfigurationBaselineDecodedDraft | null
  legacyImport: UseTechnicalConfigurationBaselineImportResult
  hierarchyImport: UseTechnicalConfigurationBaselineHierarchyImportResult
  isApplying: boolean
  operationError: string | null
  reset: () => void
  openLegacyImport: () => void
  openHierarchyImport: () => void
}>

/** Composes legacy and hierarchy import lifecycles without conflating their state. */
export function useTechnicalConfigurationBaselineImportWorkflows({
  dossierId,
  selectedVersion,
  isBlocked,
  onApplied,
  onConflict,
  onUnresolvedStateChange,
}: UseTechnicalConfigurationBaselineImportWorkflowsOptions): UseTechnicalConfigurationBaselineImportWorkflowsResult {
  const unresolvedRef = React.useRef({ hierarchy: false, legacy: false })
  const decodedVersion = React.useMemo(
    () =>
      selectedVersion
        ? decodeTechnicalConfigurationBaselineDraftWire(selectedVersion, "selectedVersion")
        : null,
    [selectedVersion]
  )

  const reportUnresolvedState = React.useCallback(
    (workflow: "hierarchy" | "legacy", unresolved: boolean) => {
      unresolvedRef.current[workflow] = unresolved
      onUnresolvedStateChange(unresolvedRef.current.hierarchy || unresolvedRef.current.legacy)
    },
    [onUnresolvedStateChange]
  )

  const legacyImport = useTechnicalConfigurationBaselineImport({
    dossierId,
    selectedVersion,
    isBlocked,
    onApplied,
    onConflict,
    onUnresolvedStateChange: React.useCallback(
      (unresolved: boolean) => reportUnresolvedState("legacy", unresolved),
      [reportUnresolvedState]
    ),
  })
  const hierarchyImport = useTechnicalConfigurationBaselineHierarchyImport({
    selectedVersion: decodedVersion,
    isBlocked,
    onApplied,
    onConflict,
    onUnresolvedStateChange: React.useCallback(
      (unresolved: boolean) => reportUnresolvedState("hierarchy", unresolved),
      [reportUnresolvedState]
    ),
  })

  return {
    decodedVersion,
    legacyImport,
    hierarchyImport,
    isApplying: legacyImport.isApplying || hierarchyImport.isApplying,
    operationError: hierarchyImport.operationError ?? legacyImport.operationError,
    reset: () => {
      legacyImport.reset()
      hierarchyImport.reset()
    },
    openLegacyImport: () => {
      if (!hierarchyImport.open) legacyImport.openDialog()
    },
    openHierarchyImport: () => {
      if (!legacyImport.open) hierarchyImport.openDialog()
    },
  }
}
