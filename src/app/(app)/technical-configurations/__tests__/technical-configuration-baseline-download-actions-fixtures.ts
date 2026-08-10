import type {
  TechnicalConfigurationBaselineDecodedDraft,
  TechnicalConfigurationBaselineDraftWire,
} from "@/app/(app)/technical-configurations/baseline-types"

import { createDraft } from "./technical-configuration-baseline-tab-fixtures"

export function readBlobBytes(blob: Blob): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => resolve(Array.from(new Uint8Array(reader.result as ArrayBuffer)))
    reader.readAsArrayBuffer(blob)
  })
}

export function createHierarchicalDraft(
  overrides: Partial<TechnicalConfigurationBaselineDraftWire> = {}
): TechnicalConfigurationBaselineDecodedDraft {
  const draft = createDraft({
    version_number: 7,
    revision: 11,
  })
  const group = draft.groups[0]
  const directCriterion = group.criteria[0]

  return {
    ...draft,
    groups: [
      {
        ...group,
        criteria: [{ ...directCriterion, subgroup_id: null }],
        subgroups: [
          {
            id: "subgroup-1",
            baseline_version_id: draft.id,
            group_id: group.id,
            name: "Điều kiện vận hành",
            sort_order: 1,
            created_at: draft.created_at,
            created_by: draft.created_by,
            updated_at: draft.updated_at,
            updated_by: draft.updated_by,
            criteria: [
              {
                ...directCriterion,
                id: "criterion-2",
                group_id: group.id,
                subgroup_id: "subgroup-1",
                criterion_code: "TC-0002",
                title: "Nhiệt độ",
                requirement_text: "Hoạt động ổn định ở 18-30°C",
              },
            ],
          },
        ],
      },
      ...draft.groups.slice(1).map((remainingGroup) => ({
        ...remainingGroup,
        criteria: remainingGroup.criteria.map((criterion) => ({
          ...criterion,
          subgroup_id: criterion.subgroup_id ?? null,
        })),
        subgroups: (remainingGroup.subgroups ?? []).map((subgroup) => ({
          ...subgroup,
          criteria: subgroup.criteria.map((criterion) => ({
            ...criterion,
            subgroup_id: criterion.subgroup_id ?? subgroup.id,
          })),
        })),
      })),
    ],
    ...overrides,
  }
}
