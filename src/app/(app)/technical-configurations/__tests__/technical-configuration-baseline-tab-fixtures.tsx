import { QueryClient } from "@tanstack/react-query"
import { render } from "@testing-library/react"
import { vi } from "vitest"

import { TechnicalConfigurationBaselineTab } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineTab"
import type {
  TechnicalConfigurationBaselineCriterionMutationWire,
  TechnicalConfigurationBaselineDraftWire,
  TechnicalConfigurationBaselineGroupMutationWire,
  TechnicalConfigurationBaselineVersionsListWireResponse,
} from "@/app/(app)/technical-configurations/baseline-types"
import type { TechnicalConfigurationDossierWire } from "@/app/(app)/technical-configurations/types"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"

const timestamp = "2026-07-13T00:00:00.000Z"

const rpc = vi.hoisted(() => ({
  createDraft: vi.fn(),
  getDossier: vi.fn(),
  getDraft: vi.fn(),
  listVersions: vi.fn(),
  lockVersion: vi.fn(),
  copyVersion: vi.fn(),
  createGroup: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
  reorderGroups: vi.fn(),
  createCriterion: vi.fn(),
  updateCriterion: vi.fn(),
  deleteCriterion: vi.fn(),
  reorderCriteria: vi.fn(),
  previewBulk: vi.fn(),
}))

vi.mock("@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaseline", () => ({
  useTechnicalConfigurationBaseline: () => rpc,
}))

export function getBaselineRpcMock() {
  return rpc
}

export const dossier: TechnicalConfigurationDossierWire = {
  id: "dossier-1",
  device_type_name: "Máy lọc thận",
  name: "Cấu hình máy lọc thận",
  description: null,
  revision: 3,
  archived_at: null,
  archived_by: null,
  created_at: timestamp,
  created_by: 1,
  updated_at: timestamp,
  updated_by: 1,
}

export function createDraft(
  overrides: Partial<TechnicalConfigurationBaselineDraftWire> = {}
): TechnicalConfigurationBaselineDraftWire {
  const groupNames = [
    "Yêu cầu chung",
    "Yêu cầu cấu hình cung cấp",
    "Yêu cầu kỹ thuật",
    "Yêu cầu khác",
  ]

  return {
    id: "draft-1",
    dossier_id: dossier.id,
    version_number: 1,
    status: "draft",
    next_criterion_number: 2,
    revision: 4,
    created_at: timestamp,
    created_by: 1,
    updated_at: timestamp,
    updated_by: 1,
    groups: groupNames.map((name, index) => ({
      id: `group-${index + 1}`,
      baseline_version_id: "draft-1",
      name,
      sort_order: index + 1,
      created_at: timestamp,
      created_by: 1,
      updated_at: timestamp,
      updated_by: 1,
      criteria:
        index === 0
          ? [
              {
                id: "criterion-1",
                baseline_version_id: "draft-1",
                group_id: "group-1",
                criterion_code: "TC-0001",
                title: "Nguồn điện",
                requirement_text: "Dòng 1\nDòng 2",
                sort_order: 1,
                source_criterion_id: null,
                created_at: timestamp,
                created_by: 1,
                updated_at: timestamp,
                updated_by: 1,
              },
            ]
          : [],
    })),
    ...overrides,
  }
}

export function baselineVersionsResponse(
  data: TechnicalConfigurationBaselineDraftWire[]
): TechnicalConfigurationBaselineVersionsListWireResponse {
  return {
    data,
    total: data.length,
    page: 1,
    page_size: 100,
  }
}

export function groupMutation(
  revision: number,
  name: string
): TechnicalConfigurationBaselineGroupMutationWire {
  return {
    id: "group-1",
    baseline_version_id: "draft-1",
    name,
    sort_order: 1,
    created_at: timestamp,
    created_by: 1,
    updated_at: timestamp,
    updated_by: 1,
    revision,
  }
}

export function criterionMutation(
  id: string,
  criterionCode: string,
  groupId: string,
  requirementText: string,
  sortOrder: number,
  revision: number
): TechnicalConfigurationBaselineCriterionMutationWire {
  return {
    id,
    baseline_version_id: "draft-1",
    group_id: groupId,
    criterion_code: criterionCode,
    title: null,
    requirement_text: requirementText,
    sort_order: sortOrder,
    source_criterion_id: null,
    created_at: timestamp,
    created_by: 1,
    updated_at: timestamp,
    updated_by: 1,
    revision,
  }
}

export function renderTab(onDirtyChange = vi.fn(), queryClient = createTestQueryClient()) {
  return {
    onDirtyChange,
    ...render(
      <TechnicalConfigurationBaselineTab dossier={dossier} onDirtyChange={onDirtyChange} />,
      {
        wrapper: createReactQueryWrapper(queryClient),
      }
    ),
  }
}

export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolver, rejecter) => {
    resolve = resolver
    reject = rejecter
  })
  return { promise, reject, resolve }
}

export function createPersistentQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 60_000 },
      mutations: { retry: false },
    },
  })
}
