import * as React from "react"

import { useTechnicalConfigurationBaseline } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaseline"
import { useTechnicalConfigurationBaselineVersions } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineVersions"
import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import { selectTechnicalConfigurationBaselineVersion } from "@/app/(app)/technical-configurations/technical-configuration-baseline-version-state"

export interface TechnicalConfigurationBaselineVersionSelectionResult {
  versionState: ReturnType<typeof useTechnicalConfigurationBaselineVersions>
  selectedVersion: TechnicalConfigurationBaselineDraftWire | null
  versionOptions: TechnicalConfigurationBaselineDraftWire[]
  adoptVersion: (version: TechnicalConfigurationBaselineDraftWire | null) => void
  synchronizeVersion: (replacementBlocked: boolean) => void
  handleRevisionChange: (revision: number) => void
}

/** Shares active-version selection and revision cache updates across read-oriented workspaces. */
export function useTechnicalConfigurationBaselineVersionSelection(
  dossierId: string
): TechnicalConfigurationBaselineVersionSelectionResult {
  const baselineRpc = useTechnicalConfigurationBaseline()
  const versionState = useTechnicalConfigurationBaselineVersions({
    dossierId,
    listVersions: baselineRpc.listVersions,
  })
  const { cacheVersion, versions, versionsQuery } = versionState
  const [selectedVersionId, setSelectedVersionId] = React.useState<string | null>(null)
  const [selectedVersion, setSelectedVersion] =
    React.useState<TechnicalConfigurationBaselineDraftWire | null>(null)
  const adoptVersion = React.useCallback(
    (version: TechnicalConfigurationBaselineDraftWire | null) => {
      setSelectedVersionId(version?.id ?? null)
      setSelectedVersion(version)
    },
    []
  )
  const versionOptions = React.useMemo(
    () =>
      selectedVersion && !versions.some((version) => version.id === selectedVersion.id)
        ? [selectedVersion, ...versions]
        : versions,
    [selectedVersion, versions]
  )
  const synchronizeVersion = React.useCallback(
    (replacementBlocked: boolean) => {
      if (!versionsQuery.data || replacementBlocked) return
      const nextVersion = selectTechnicalConfigurationBaselineVersion(
        versions,
        selectedVersionId,
        selectedVersion,
        Boolean(versionsQuery.hasNextPage)
      )
      if (
        selectedVersion?.id === nextVersion?.id &&
        selectedVersion?.revision === nextVersion?.revision &&
        selectedVersion?.status === nextVersion?.status
      ) {
        return
      }
      adoptVersion(nextVersion)
    },
    [
      adoptVersion,
      selectedVersion,
      selectedVersionId,
      versions,
      versionsQuery.data,
      versionsQuery.hasNextPage,
    ]
  )
  const handleRevisionChange = React.useCallback(
    (revision: number) => {
      setSelectedVersion((current) => {
        if (!current) return current
        const nextVersion = { ...current, revision }
        cacheVersion(nextVersion)
        return nextVersion
      })
    },
    [cacheVersion]
  )

  return {
    versionState,
    selectedVersion,
    versionOptions,
    adoptVersion,
    synchronizeVersion,
    handleRevisionChange,
  }
}
