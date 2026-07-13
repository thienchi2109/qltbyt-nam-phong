import * as React from "react"
import { QueryClient } from "@tanstack/react-query"
import "@testing-library/jest-dom"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationBaselineTab } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineTab"
import type {
  TechnicalConfigurationBaselineCriterionMutationWire,
  TechnicalConfigurationBaselineDraftWire,
  TechnicalConfigurationBaselineGroupMutationWire,
} from "@/app/(app)/technical-configurations/baseline-types"
import { TechnicalConfigurationRpcError } from "@/app/(app)/technical-configurations/technical-configuration-rpc"
import type { TechnicalConfigurationDossierWire } from "@/app/(app)/technical-configurations/types"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"

const timestamp = "2026-07-13T00:00:00.000Z"

const rpc = vi.hoisted(() => ({
  createDraft: vi.fn(),
  getDraft: vi.fn(),
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

const dossier: TechnicalConfigurationDossierWire = {
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

function createDraft(
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

function groupMutation(
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

function criterionMutation(
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

function renderTab(onDirtyChange = vi.fn(), queryClient = createTestQueryClient()) {
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

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolver, rejecter) => {
    resolve = resolver
    reject = rejecter
  })
  return { promise, reject, resolve }
}

describe("technical configuration baseline tab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.getDraft.mockResolvedValue({ data: createDraft() })
  })

  it("renders server groups and stages multiline, add, and reorder changes without autosave", async () => {
    const user = userEvent.setup()
    renderTab()

    expect(await screen.findByDisplayValue("Yêu cầu chung")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Yêu cầu cấu hình cung cấp")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Yêu cầu kỹ thuật")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Yêu cầu khác")).toBeInTheDocument()

    const requirement = screen.getByLabelText("Nội dung yêu cầu 1.1")
    await user.clear(requirement)
    await user.type(requirement, "Nguồn điện ổn định\n220V - 50Hz")
    await user.click(screen.getByRole("button", { name: "Thêm tiêu chí vào nhóm 1" }))
    await user.click(screen.getByRole("button", { name: "Di chuyển nhóm 4 lên" }))

    expect(screen.getByLabelText("Nội dung yêu cầu 1.1")).toHaveValue(
      "Nguồn điện ổn định\n220V - 50Hz"
    )
    expect(screen.getByText("Có thay đổi chưa lưu")).toBeInTheDocument()
    expect(rpc.updateCriterion).not.toHaveBeenCalled()
    expect(rpc.createCriterion).not.toHaveBeenCalled()
    expect(rpc.reorderGroups).not.toHaveBeenCalled()
  })

  it("keeps bulk preview and accept local until explicit save", async () => {
    const user = userEvent.setup()
    rpc.createCriterion
      .mockResolvedValueOnce({
        data: criterionMutation("criterion-2", "TC-0002", "group-2", "Nguồn điện ổn định", 1, 5),
      })
      .mockResolvedValueOnce({
        data: criterionMutation(
          "criterion-3",
          "TC-0003",
          "group-2",
          "Áp lực vận hành ≥ 3 bar",
          2,
          6
        ),
      })
    renderTab()

    await user.click(await screen.findByRole("button", { name: "Nhập nhanh tiêu chí vào nhóm 2" }))
    const dialog = screen.getByRole("dialog", { name: "Nhập nhanh tiêu chí" })
    await user.type(
      within(dialog).getByLabelText("Nội dung nhập nhanh"),
      "Nguồn điện ổn định\nÁp lực vận hành ≥ 3 bar"
    )
    await user.click(within(dialog).getByRole("button", { name: "Xem trước" }))
    await user.click(within(dialog).getByRole("button", { name: "Thêm vào nhóm" }))

    for (const mutation of [
      rpc.createGroup,
      rpc.updateGroup,
      rpc.deleteGroup,
      rpc.reorderGroups,
      rpc.createCriterion,
      rpc.updateCriterion,
      rpc.deleteCriterion,
      rpc.reorderCriteria,
      rpc.previewBulk,
    ]) {
      expect(mutation).not.toHaveBeenCalled()
    }

    await user.click(screen.getByRole("button", { name: "Lưu" }))

    await waitFor(() => expect(rpc.createCriterion).toHaveBeenCalledTimes(2))
    expect(rpc.createCriterion).toHaveBeenNthCalledWith(1, {
      p_group_id: "group-2",
      p_title: null,
      p_requirement_text: "Nguồn điện ổn định",
      p_expected_revision: 4,
    })
    expect(rpc.createCriterion).toHaveBeenNthCalledWith(2, {
      p_group_id: "group-2",
      p_title: null,
      p_requirement_text: "Áp lực vận hành ≥ 3 bar",
      p_expected_revision: 5,
    })
    expect(rpc.previewBulk).not.toHaveBeenCalled()
    expect(await screen.findByText("Đã lưu")).toBeInTheDocument()
  })

  it("saves only from explicit Lưu and shows the exact pending label", async () => {
    const user = userEvent.setup()
    const pending = deferred<{ data: TechnicalConfigurationBaselineGroupMutationWire }>()
    rpc.updateGroup.mockReturnValue(pending.promise)
    renderTab()

    const nameInput = await screen.findByDisplayValue("Yêu cầu chung")
    await user.clear(nameInput)
    await user.type(nameInput, "Yêu cầu kỹ thuật chung")

    expect(rpc.updateGroup).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Lưu" }))

    expect(screen.getByRole("button", { name: "Đang lưu..." })).toBeDisabled()
    expect(rpc.updateGroup).toHaveBeenCalledWith({
      p_group_id: "group-1",
      p_name: "Yêu cầu kỹ thuật chung",
      p_expected_revision: 4,
    })

    await act(async () => {
      pending.resolve({ data: groupMutation(5, "Yêu cầu kỹ thuật chung") })
      await pending.promise
    })

    expect(await screen.findByText("Đã lưu")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled()
  })

  it("keeps fields on validation and persistence failures", async () => {
    const user = userEvent.setup()
    rpc.updateGroup.mockRejectedValue(new Error("network_down"))
    renderTab()

    const nameInput = await screen.findByDisplayValue("Yêu cầu chung")
    await user.clear(nameInput)
    await user.click(screen.getByRole("button", { name: "Lưu" }))

    expect(await screen.findByText("Tên nhóm là bắt buộc.")).toBeInTheDocument()
    expect(rpc.updateGroup).not.toHaveBeenCalled()

    await user.type(nameInput, "Tên vẫn được giữ")
    await user.click(screen.getByRole("button", { name: "Lưu" }))

    expect(await screen.findByText("Không thể lưu cấu hình cơ sở.")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Tên vẫn được giữ")).toBeInTheDocument()
  })

  it("keeps conflict input and requires an explicit server reload before another save", async () => {
    const user = userEvent.setup()
    rpc.updateGroup.mockRejectedValue(
      new TechnicalConfigurationRpcError(409, {
        code: "PT409",
        message: "stale_revision",
      })
    )
    renderTab()

    const nameInput = await screen.findByDisplayValue("Yêu cầu chung")
    await user.clear(nameInput)
    await user.type(nameInput, "Tên đang xung đột")
    await user.click(screen.getByRole("button", { name: "Lưu" }))

    expect(await screen.findByText("Xung đột dữ liệu")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Tên đang xung đột")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Tải lại từ máy chủ" })).toBeEnabled()
  })

  it("keeps the explicitly reloaded server draft instead of restoring stale query data", async () => {
    const user = userEvent.setup()
    rpc.updateGroup.mockRejectedValue(
      new TechnicalConfigurationRpcError(409, {
        code: "PT409",
        message: "stale_revision",
      })
    )
    renderTab()

    const nameInput = await screen.findByDisplayValue("Yêu cầu chung")
    await user.clear(nameInput)
    await user.type(nameInput, "Tên đang xung đột")
    await user.click(screen.getByRole("button", { name: "Lưu" }))
    expect(await screen.findByText("Xung đột dữ liệu")).toBeInTheDocument()

    const currentDraft = createDraft()
    const reloadedDraft = createDraft({
      revision: 8,
      groups: currentDraft.groups.map((group, index) =>
        index === 0 ? { ...group, name: "Tên mới từ máy chủ" } : group
      ),
    })
    rpc.getDraft.mockResolvedValueOnce({ data: reloadedDraft })
    vi.spyOn(window, "confirm").mockReturnValueOnce(true)

    await user.click(screen.getByRole("button", { name: "Tải lại từ máy chủ" }))

    expect(await screen.findByDisplayValue("Tên mới từ máy chủ")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByDisplayValue("Yêu cầu chung")).not.toBeInTheDocument()
    })
  })

  it("disables conflict reload while pending and surfaces reload failures", async () => {
    const user = userEvent.setup()
    rpc.updateGroup.mockRejectedValue(
      new TechnicalConfigurationRpcError(409, {
        code: "PT409",
        message: "stale_revision",
      })
    )
    renderTab()

    const nameInput = await screen.findByDisplayValue("Yêu cầu chung")
    await user.clear(nameInput)
    await user.type(nameInput, "Tên đang xung đột")
    await user.click(screen.getByRole("button", { name: "Lưu" }))
    expect(await screen.findByText("Xung đột dữ liệu")).toBeInTheDocument()

    const pending = deferred<{ data: TechnicalConfigurationBaselineDraftWire }>()
    rpc.getDraft.mockReturnValueOnce(pending.promise)
    vi.spyOn(window, "confirm").mockReturnValueOnce(true)

    await user.click(screen.getByRole("button", { name: "Tải lại từ máy chủ" }))

    const pendingButton = screen.getByRole("button", { name: "Đang tải lại..." })
    expect(pendingButton).toBeDisabled()
    await user.click(pendingButton)
    expect(rpc.getDraft).toHaveBeenCalledTimes(2)

    await act(async () => {
      pending.reject(new Error("network_down"))
      await pending.promise.catch(() => undefined)
    })

    expect(await screen.findByText("Không thể tải lại cấu hình cơ sở.")).toBeInTheDocument()
    expect(screen.getByText("Xung đột dữ liệu")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Tải lại từ máy chủ" })).toBeEnabled()
  })

  it("keeps accepted partial-save progress in the query cache across remounts", async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 60_000 },
        mutations: { retry: false },
      },
    })
    const setQueryData = vi.spyOn(queryClient, "setQueryData")
    rpc.updateGroup.mockResolvedValue({ data: groupMutation(5, "Tên nhóm đã được lưu") })
    rpc.createCriterion.mockRejectedValue(new Error("network_down"))
    const view = renderTab(vi.fn(), queryClient)

    const nameInput = await screen.findByDisplayValue("Yêu cầu chung")
    await user.clear(nameInput)
    await user.type(nameInput, "Tên nhóm đã được lưu")
    await user.click(screen.getByRole("button", { name: "Thêm tiêu chí vào nhóm 1" }))
    await user.type(screen.getByLabelText("Nội dung yêu cầu 1.2"), "Giá trị chưa lưu")
    await user.click(screen.getByRole("button", { name: "Lưu" }))

    expect(await screen.findByText("Không thể lưu cấu hình cơ sở.")).toBeInTheDocument()
    expect(rpc.updateGroup).toHaveBeenCalledTimes(1)
    expect(rpc.createCriterion).toHaveBeenCalledTimes(1)
    expect(setQueryData).toHaveBeenLastCalledWith(
      ["technical-configurations", "baseline-draft", dossier.id],
      {
        data: expect.objectContaining({
          revision: 5,
        }),
      }
    )
    const cachedDraft = queryClient.getQueryData<{ data: TechnicalConfigurationBaselineDraftWire }>(
      ["technical-configurations", "baseline-draft", dossier.id]
    )
    expect(cachedDraft?.data.revision).toBe(5)
    expect(cachedDraft?.data.groups[0].name).toBe("Tên nhóm đã được lưu")

    view.unmount()
    renderTab(vi.fn(), queryClient)

    expect(await screen.findByDisplayValue("Tên nhóm đã được lưu")).toBeInTheDocument()
    expect(rpc.getDraft).toHaveBeenCalledTimes(1)
  })

  it("creates a missing draft only from an explicit action and renders locked data as a placeholder", async () => {
    const user = userEvent.setup()
    rpc.getDraft.mockRejectedValueOnce(
      new TechnicalConfigurationRpcError(404, {
        code: "PT404",
        message: "not_found",
      })
    )
    rpc.createDraft.mockResolvedValue({
      data: { ...createDraft(), dossier_revision: 4 },
    })
    const view = renderTab()

    expect(await screen.findByText("Chưa có bản nháp cấu hình")).toBeInTheDocument()
    expect(rpc.createDraft).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Khởi tạo cấu hình cơ sở" }))
    expect(rpc.createDraft).toHaveBeenCalledWith({
      p_dossier_id: dossier.id,
      p_expected_revision: dossier.revision,
    })
    expect(await screen.findByDisplayValue("Yêu cầu chung")).toBeInTheDocument()

    view.unmount()
    rpc.getDraft.mockResolvedValueOnce({
      data: createDraft({ status: "locked" }),
    })
    renderTab()

    expect(await screen.findByText("Phiên bản đã khóa")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Lưu" })).not.toBeInTheDocument()
  })

  it("registers beforeunload protection only while the form is dirty", async () => {
    const user = userEvent.setup()
    renderTab()

    const cleanEvent = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(cleanEvent)
    expect(cleanEvent.defaultPrevented).toBe(false)

    const nameInput = await screen.findByDisplayValue("Yêu cầu chung")
    await user.type(nameInput, " thay đổi")

    const dirtyEvent = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(dirtyEvent)
    expect(dirtyEvent.defaultPrevented).toBe(true)
  })
})
