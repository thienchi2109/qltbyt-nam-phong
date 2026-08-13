"use client"

import type * as React from "react"

import type { UseTechnicalConfigurationBaselineHierarchyImportResult } from "../_hooks/useTechnicalConfigurationBaselineHierarchyImport"
import type { UseTechnicalConfigurationBaselineImportResult } from "../_hooks/useTechnicalConfigurationBaselineImport"
import type { TechnicalConfigurationBaselineDecodedDraft } from "../baseline-types"

import { TechnicalConfigurationBaselineHierarchyImportDialog } from "./TechnicalConfigurationBaselineHierarchyImportDialog"
import { TechnicalConfigurationBaselineImportDialog } from "./TechnicalConfigurationBaselineImportDialog"
import { TechnicalConfigurationBaselineProductionActions } from "./TechnicalConfigurationBaselineProductionActions"

type TechnicalConfigurationBaselineProductionSurfacesProps = Readonly<{
  isFocusMode: boolean
  version: TechnicalConfigurationBaselineDecodedDraft | null
  dirty: boolean
  conflict: boolean
  disabled: boolean
  disabledMessage: string | null
  legacyImport: UseTechnicalConfigurationBaselineImportResult
  hierarchyImport: UseTechnicalConfigurationBaselineHierarchyImportResult
  onRequestHierarchyImport: () => void
}>

/** Mounts production spreadsheet commands and their independent import dialogs. */
export function TechnicalConfigurationBaselineProductionSurfaces({
  isFocusMode,
  version,
  dirty,
  conflict,
  disabled,
  disabledMessage,
  legacyImport,
  hierarchyImport,
  onRequestHierarchyImport,
}: TechnicalConfigurationBaselineProductionSurfacesProps): React.JSX.Element {
  return (
    <>
      {!isFocusMode && version ? (
        <TechnicalConfigurationBaselineProductionActions
          version={version}
          dirty={dirty}
          conflict={conflict}
          disabled={disabled}
          disabledMessage={disabledMessage}
          onRequestHierarchyImport={onRequestHierarchyImport}
        />
      ) : null}
      <TechnicalConfigurationBaselineImportDialog workflow={legacyImport} />
      <TechnicalConfigurationBaselineHierarchyImportDialog workflow={hierarchyImport} />
    </>
  )
}
