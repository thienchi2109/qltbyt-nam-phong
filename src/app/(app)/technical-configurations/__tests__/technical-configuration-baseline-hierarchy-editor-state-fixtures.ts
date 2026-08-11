import type {
  TechnicalConfigurationBaselineCriterionWire,
  TechnicalConfigurationBaselineDraftWire,
  TechnicalConfigurationBaselineGroupWire,
  TechnicalConfigurationBaselineSubgroupWire,
} from "@/app/(app)/technical-configurations/baseline-types"

const timestamp = "2026-08-11T00:00:00.000Z"

export function criterion(
  overrides: Partial<TechnicalConfigurationBaselineCriterionWire> = {}
): TechnicalConfigurationBaselineCriterionWire {
  return {
    id: "criterion-direct",
    baseline_version_id: "version-1",
    group_id: "group-1",
    subgroup_id: null,
    criterion_code: "TC-0001",
    title: null,
    requirement_text: "Direct criterion",
    sort_order: 1,
    source_criterion_id: null,
    created_at: timestamp,
    created_by: 1,
    updated_at: timestamp,
    updated_by: 1,
    ...overrides,
  }
}

export function subgroup(
  overrides: Partial<TechnicalConfigurationBaselineSubgroupWire> = {}
): TechnicalConfigurationBaselineSubgroupWire {
  return {
    id: "subgroup-1",
    baseline_version_id: "version-1",
    group_id: "group-1",
    name: "Subgroup 1",
    sort_order: 1,
    created_at: timestamp,
    created_by: 1,
    updated_at: timestamp,
    updated_by: 1,
    criteria: [
      criterion({
        id: "criterion-subgroup",
        subgroup_id: "subgroup-1",
        criterion_code: "TC-0002",
        requirement_text: "Subgroup criterion",
        sort_order: 2,
      }),
    ],
    ...overrides,
  }
}

export function group(
  overrides: Partial<TechnicalConfigurationBaselineGroupWire> = {}
): TechnicalConfigurationBaselineGroupWire {
  return {
    id: "group-1",
    baseline_version_id: "version-1",
    name: "Section 1",
    sort_order: 1,
    created_at: timestamp,
    created_by: 1,
    updated_at: timestamp,
    updated_by: 1,
    criteria: [criterion()],
    subgroups: [subgroup()],
    ...overrides,
  }
}

export function wireDraft(
  overrides: Partial<TechnicalConfigurationBaselineDraftWire> = {}
): TechnicalConfigurationBaselineDraftWire {
  return {
    id: "version-1",
    dossier_id: "dossier-1",
    version_number: 1,
    status: "draft",
    source_baseline_version_id: null,
    source_version_number: null,
    next_criterion_number: 3,
    revision: 4,
    locked_at: null,
    locked_by: null,
    created_at: timestamp,
    created_by: 1,
    updated_at: timestamp,
    updated_by: 1,
    groups: [group()],
    ...overrides,
  }
}
