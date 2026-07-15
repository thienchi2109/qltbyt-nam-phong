import type { TechnicalConfigurationBaselineDraftWire } from "./baseline-types"

type BaselineRevisionState = {
  refreshDossierRevision: () => Promise<unknown>
}

type BaselineVersionState = {
  cacheVersion: (version: TechnicalConfigurationBaselineDraftWire) => void
  refreshVersions: (versionId?: string) => Promise<TechnicalConfigurationBaselineDraftWire | null>
}

/** Bridges P5D results into the baseline editor without owning transient import state. */
export function createBaselineImportBridge(
  revisionState: BaselineRevisionState,
  versionState: BaselineVersionState,
  adoptVersion: (version: TechnicalConfigurationBaselineDraftWire | null) => void
) {
  return {
    onAdoptImportSnapshot: async (version: TechnicalConfigurationBaselineDraftWire) => {
      versionState.cacheVersion(version)
      adoptVersion(version)
      await revisionState.refreshDossierRevision()
    },
    onRefreshImportConflict: async (versionId: string) => {
      const [revisionResult, versionResult] = await Promise.allSettled([
        revisionState.refreshDossierRevision(),
        versionState.refreshVersions(versionId),
      ])
      if (versionResult.status === "fulfilled" && versionResult.value) {
        adoptVersion(versionResult.value)
      }
      if (versionResult.status === "rejected") throw versionResult.reason
      if (revisionResult.status === "rejected") throw revisionResult.reason
    },
  }
}
