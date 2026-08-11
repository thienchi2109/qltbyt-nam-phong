import { vi } from "vitest"

import type {
  TechnicalConfigurationBaselineCriterionMutationWire,
  TechnicalConfigurationBaselineDraftWire,
} from "../baseline-types"

const timestamp = "2026-08-11T00:00:00.000Z"

export function criterion(
  id: string,
  code: string,
  groupId: string,
  subgroupId: string | null,
  sortOrder: number
) {
  return {
    id,
    baseline_version_id: "draft-1",
    group_id: groupId,
    subgroup_id: subgroupId,
    criterion_code: code,
    title: null,
    requirement_text: `Yêu cầu ${code}`,
    sort_order: sortOrder,
    source_criterion_id: null,
    created_at: timestamp,
    created_by: 1,
    updated_at: timestamp,
    updated_by: 1,
  }
}

export function createDraft(): TechnicalConfigurationBaselineDraftWire {
  return {
    id: "draft-1",
    dossier_id: "dossier-1",
    version_number: 1,
    status: "draft",
    source_baseline_version_id: null,
    source_version_number: null,
    next_criterion_number: 4,
    revision: 4,
    locked_at: null,
    locked_by: null,
    created_at: timestamp,
    created_by: 1,
    updated_at: timestamp,
    updated_by: 1,
    groups: [
      {
        id: "group-1",
        baseline_version_id: "draft-1",
        name: "Yêu cầu chung",
        sort_order: 1,
        created_at: timestamp,
        created_by: 1,
        updated_at: timestamp,
        updated_by: 1,
        criteria: [criterion("criterion-1", "TC-0001", "group-1", null, 1)],
        subgroups: [
          {
            id: "subgroup-1",
            baseline_version_id: "draft-1",
            group_id: "group-1",
            name: "Hạ tầng",
            sort_order: 1,
            created_at: timestamp,
            created_by: 1,
            updated_at: timestamp,
            updated_by: 1,
            criteria: [criterion("criterion-2", "TC-0002", "group-1", "subgroup-1", 2)],
          },
          {
            id: "subgroup-2",
            baseline_version_id: "draft-1",
            group_id: "group-1",
            name: "Môi trường",
            sort_order: 2,
            created_at: timestamp,
            created_by: 1,
            updated_at: timestamp,
            updated_by: 1,
            criteria: [criterion("criterion-3", "TC-0003", "group-1", "subgroup-2", 3)],
          },
        ],
      },
    ],
  }
}

export function subgroupMutation(id: string, name: string, sortOrder: number, revision: number) {
  return {
    id,
    baseline_version_id: "draft-1",
    group_id: "group-1",
    name,
    sort_order: sortOrder,
    created_at: timestamp,
    created_by: 1,
    updated_at: timestamp,
    updated_by: 1,
    revision,
  }
}

export function criterionMutation(
  id: string,
  code: string,
  subgroupId: string | null,
  sortOrder: number,
  revision: number,
  groupId = "group-1"
): TechnicalConfigurationBaselineCriterionMutationWire {
  return {
    ...criterion(id, code, groupId, subgroupId, sortOrder),
    revision,
  }
}

export function createRpc() {
  return {
    createGroup: vi.fn(),
    updateGroup: vi.fn(),
    deleteGroup: vi.fn(),
    reorderGroups: vi.fn(),
    createCriterion: vi.fn(),
    updateCriterion: vi.fn(),
    deleteCriterion: vi.fn(),
    reorderCriteria: vi.fn(),
    createSubgroup: vi.fn(),
    updateSubgroup: vi.fn(),
    deleteSubgroup: vi.fn(),
    reorderSubgroups: vi.fn(),
    createHierarchyCriterion: vi.fn(),
    moveHierarchyCriterion: vi.fn(),
    reorderHierarchyCriteria: vi.fn(),
  }
}
