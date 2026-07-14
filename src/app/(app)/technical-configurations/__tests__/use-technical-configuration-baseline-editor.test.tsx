import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { PropsWithChildren } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useTechnicalConfigurationBaselineEditor } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineEditor"
import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import type { TechnicalConfigurationDossierWire } from "@/app/(app)/technical-configurations/types"

const rpc = vi.hoisted(() => ({
  getDraft: vi.fn(),
}))

vi.mock("@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaseline", () => ({
  useTechnicalConfigurationBaseline: () => rpc,
}))

const dossier: TechnicalConfigurationDossierWire = {
  id: "dossier-1",
  device_type_name: "Máy lọc thận",
  name: "Cấu hình máy lọc thận",
  description: null,
  revision: 3,
  archived_at: null,
  archived_by: null,
  created_at: "2026-07-13T00:00:00.000Z",
  created_by: 1,
  updated_at: "2026-07-13T00:00:00.000Z",
  updated_by: 1,
}

const draft: TechnicalConfigurationBaselineDraftWire = {
  id: "draft-1",
  dossier_id: "dossier-1",
  version_number: 1,
  status: "draft",
  next_criterion_number: 2,
  revision: 4,
  created_at: "2026-07-13T00:00:00.000Z",
  created_by: 1,
  updated_at: "2026-07-13T00:00:00.000Z",
  updated_by: 1,
  groups: [
    {
      id: "group-1",
      baseline_version_id: "draft-1",
      name: "Yêu cầu chung",
      sort_order: 1,
      created_at: "2026-07-13T00:00:00.000Z",
      created_by: 1,
      updated_at: "2026-07-13T00:00:00.000Z",
      updated_by: 1,
      criteria: [
        {
          id: "criterion-1",
          baseline_version_id: "draft-1",
          group_id: "group-1",
          criterion_code: "TC-0001",
          title: null,
          requirement_text: "Nguồn điện ổn định",
          sort_order: 1,
          source_criterion_id: null,
          created_at: "2026-07-13T00:00:00.000Z",
          created_by: 1,
          updated_at: "2026-07-13T00:00:00.000Z",
          updated_by: 1,
        },
      ],
    },
  ],
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return function QueryClientWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe("useTechnicalConfigurationBaselineEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.getDraft.mockResolvedValue({ data: draft })
  })

  it("shows field validation only after an explicit save attempt", async () => {
    const { result } = renderHook(
      () =>
        useTechnicalConfigurationBaselineEditor({
          dossier,
        }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.editorDraft).not.toBeNull())
    const currentDraft = result.current.editorDraft
    if (!currentDraft) throw new Error("Expected loaded editor draft")

    act(() => {
      result.current.onEditorChange({
        ...currentDraft,
        groups: currentDraft.groups.map((group) => ({
          ...group,
          name: " ",
          criteria: group.criteria.map((criterion) => ({
            ...criterion,
            requirementText: "\n ",
          })),
        })),
      })
    })

    expect(result.current.validation).toEqual({
      groupErrors: {},
      criterionErrors: {},
    })

    act(() => {
      result.current.onSave()
    })

    await waitFor(() =>
      expect(result.current.validation).toEqual({
        groupErrors: {
          "group-1": "Tên nhóm là bắt buộc.",
        },
        criterionErrors: {
          "criterion-1": "Nội dung yêu cầu là bắt buộc.",
        },
      })
    )
  })
})
