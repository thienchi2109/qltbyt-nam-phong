import { expect } from "vitest"

import type {
  TechnicalConfigurationBaselineDecodedDraft,
  TechnicalConfigurationBaselineDraftWire,
} from "@/app/(app)/technical-configurations/baseline-types"

/** Re-keys nested ownership when a fixture represents another baseline version. */
export function withBaselineVersionId(
  version: TechnicalConfigurationBaselineDraftWire,
  id: string
): TechnicalConfigurationBaselineDraftWire {
  return {
    ...version,
    id,
    groups: version.groups.map((group) => ({
      ...group,
      baseline_version_id: id,
      criteria: group.criteria.map((criterion) => ({
        ...criterion,
        baseline_version_id: id,
      })),
      ...(group.subgroups === undefined
        ? {}
        : {
            subgroups: group.subgroups.map((subgroup) => ({
              ...subgroup,
              baseline_version_id: id,
              criteria: subgroup.criteria.map((criterion) => ({
                ...criterion,
                baseline_version_id: id,
              })),
            })),
          }),
    })),
  }
}

/** Verifies that a legacy two-level response is preserved and normalized for consumers. */
export function expectLegacyBaselineVersionNormalized(
  actual: TechnicalConfigurationBaselineDecodedDraft | undefined,
  legacy: TechnicalConfigurationBaselineDraftWire
) {
  expect(actual).toMatchObject(legacy)
  expect(actual?.groups).toHaveLength(legacy.groups.length)
  for (const group of actual?.groups ?? []) {
    expect(group.subgroups).toEqual([])
    expect(group.criteria.every((criterion) => criterion.subgroup_id === null)).toBe(true)
  }
}

/** Verifies normalized legacy responses without requiring raw and decoded shapes to be identical. */
export function expectLegacyBaselineVersionsNormalized(
  actual: TechnicalConfigurationBaselineDecodedDraft[],
  legacy: TechnicalConfigurationBaselineDraftWire[]
) {
  expect(actual).toHaveLength(legacy.length)
  actual.forEach((version, index) => {
    expectLegacyBaselineVersionNormalized(version, legacy[index])
  })
}
