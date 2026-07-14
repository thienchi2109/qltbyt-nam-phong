import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { PropsWithChildren } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useTechnicalConfigurationBaselineEditor } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineEditor"
import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import { TechnicalConfigurationRpcError } from "@/app/(app)/technical-configurations/technical-configuration-rpc"
import type { TechnicalConfigurationDossierWire } from "@/app/(app)/technical-configurations/types"

const rpc = vi.hoisted(() => ({
  createDraft: vi.fn(),
  getDossier: vi.fn(),
  getDraft: vi.fn(),
  listVersions: vi.fn(),
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
  source_baseline_version_id: null,
  source_version_number: null,
  next_criterion_number: 2,
  revision: 4,
  locked_at: null,
  locked_by: null,
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
    rpc.getDossier.mockResolvedValue({ data: dossier })
    rpc.getDraft.mockResolvedValue({ data: draft })
    rpc.listVersions.mockResolvedValue({
      data: [draft],
      total: 1,
      page: 1,
      page_size: 100,
    })
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

  it("loads older version-history pages on demand", async () => {
    const newest = { ...draft, id: "draft-101", version_number: 101 }
    const oldest = {
      ...draft,
      id: "locked-1",
      version_number: 1,
      status: "locked" as const,
      locked_at: "2026-07-14T08:30:00.000Z",
      locked_by: 42,
    }
    rpc.listVersions.mockImplementation(({ p_page }: { p_page: number }) =>
      Promise.resolve(
        p_page === 1
          ? { data: [newest], total: 101, page: 1, page_size: 100 }
          : { data: [oldest], total: 101, page: 2, page_size: 100 }
      )
    )

    const { result } = renderHook(
      () =>
        useTechnicalConfigurationBaselineEditor({
          dossier,
        }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.versions).toEqual([newest]))
    expect(result.current.hasMoreVersions).toBe(true)

    await act(async () => {
      await result.current.onLoadMoreVersions()
    })

    await waitFor(() => expect(result.current.versions).toEqual([newest, oldest]))
    expect(result.current.hasMoreVersions).toBe(false)
    expect(rpc.listVersions).toHaveBeenLastCalledWith({
      p_dossier_id: dossier.id,
      p_page: 2,
      p_page_size: 100,
    })
  })

  it("keeps a selected page-2 locked version when refreshing page 1", async () => {
    const createVersion = (versionNumber: number) => ({
      ...draft,
      id: `version-${versionNumber}`,
      version_number: versionNumber,
      status: "locked" as const,
      locked_at: "2026-07-14T08:30:00.000Z",
      locked_by: 42,
    })
    const initialFirstPage = Array.from({ length: 100 }, (_, index) => createVersion(200 - index))
    const initialSecondPage = Array.from({ length: 100 }, (_, index) => createVersion(100 - index))
    const refreshedFirstPage = Array.from({ length: 100 }, (_, index) => createVersion(201 - index))
    const oldest = initialSecondPage.at(-1)
    if (!oldest) throw new Error("Expected oldest version")
    let pageOneRequestCount = 0
    rpc.listVersions.mockImplementation(({ p_page }: { p_page: number }) => {
      if (p_page === 2) {
        return Promise.resolve({
          data: initialSecondPage,
          total: 200,
          page: 2,
          page_size: 100,
        })
      }
      if (p_page === 3) {
        return Promise.resolve({
          data: [oldest],
          total: 201,
          page: 3,
          page_size: 100,
        })
      }
      pageOneRequestCount += 1
      return Promise.resolve({
        data: pageOneRequestCount === 1 ? initialFirstPage : refreshedFirstPage,
        total: pageOneRequestCount === 1 ? 200 : 201,
        page: 1,
        page_size: 100,
      })
    })

    const { result } = renderHook(
      () =>
        useTechnicalConfigurationBaselineEditor({
          dossier,
        }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.versions).toHaveLength(100))
    await act(async () => {
      await result.current.onLoadMoreVersions()
    })
    await waitFor(() => expect(result.current.versions).toHaveLength(200))
    act(() => {
      result.current.onSelectVersion(oldest.id)
    })
    await waitFor(() => expect(result.current.selectedVersion?.id).toBe(oldest.id))

    await act(async () => {
      await result.current.onRefreshVersions()
    })

    expect(result.current.selectedVersion?.id).toBe(oldest.id)
    expect(result.current.versions.map((version) => version.id)).not.toContain(oldest.id)
    expect(result.current.hasMoreVersions).toBe(true)

    await act(async () => {
      await result.current.onLoadMoreVersions()
    })

    await waitFor(() =>
      expect(result.current.versions.map((version) => version.id)).toContain(oldest.id)
    )
    expect(result.current.selectedVersion?.id).toBe(oldest.id)
    expect(rpc.listVersions).toHaveBeenLastCalledWith({
      p_dossier_id: dossier.id,
      p_page: 3,
      p_page_size: 100,
    })
  })

  it("classifies stale draft creation as a recoverable conflict", async () => {
    const locked = {
      ...draft,
      id: "locked-1",
      status: "locked" as const,
      locked_at: "2026-07-14T08:30:00.000Z",
      locked_by: 42,
    }
    rpc.listVersions.mockResolvedValue({
      data: [locked],
      total: 1,
      page: 1,
      page_size: 100,
    })
    rpc.createDraft.mockRejectedValue(
      new TechnicalConfigurationRpcError(409, { message: "stale_revision" })
    )

    const { result } = renderHook(
      () =>
        useTechnicalConfigurationBaselineEditor({
          dossier,
        }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.selectedVersion?.id).toBe(locked.id))
    act(() => {
      result.current.onCreate()
    })

    await waitFor(() => expect(result.current.isConflict).toBe(true))
    expect(result.current.createError).toBe(
      "Dữ liệu hồ sơ đã thay đổi. Trạng thái mới đã được tải; vui lòng thử lại."
    )
    expect(result.current.lifecycleError).toBeNull()
  })

  it("refreshes the dossier revision before retrying stale first-draft creation", async () => {
    rpc.listVersions.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      page_size: 100,
    })
    rpc.getDossier.mockResolvedValue({
      data: {
        ...dossier,
        revision: 4,
      },
    })
    rpc.createDraft
      .mockRejectedValueOnce(new TechnicalConfigurationRpcError(409, { message: "stale_revision" }))
      .mockResolvedValueOnce({
        data: {
          ...draft,
          dossier_revision: 5,
        },
      })

    const { result } = renderHook(
      () =>
        useTechnicalConfigurationBaselineEditor({
          dossier,
        }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isMissing).toBe(true))
    act(() => {
      result.current.onCreate()
    })

    await waitFor(() => expect(rpc.getDossier).toHaveBeenCalledWith(dossier.id))
    expect(result.current.createError).toBe(
      "Dữ liệu hồ sơ đã thay đổi. Trạng thái mới đã được tải; vui lòng thử lại."
    )

    act(() => {
      result.current.onCreate()
    })

    await waitFor(() => expect(rpc.createDraft).toHaveBeenCalledTimes(2))
    expect(rpc.createDraft).toHaveBeenLastCalledWith({
      p_dossier_id: dossier.id,
      p_expected_revision: 4,
    })
  })
})
