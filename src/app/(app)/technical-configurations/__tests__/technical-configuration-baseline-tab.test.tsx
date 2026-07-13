import * as React from "react"
import "@testing-library/jest-dom"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"

import type {
  TechnicalConfigurationBaselineDraftWire,
  TechnicalConfigurationBaselineGroupMutationWire,
} from "../baseline-types"
import { TechnicalConfigurationRpcError } from "../technical-configuration-rpc"
import { TechnicalConfigurationBaselineTab } from "../_components/TechnicalConfigurationBaselineTab"
import type { TechnicalConfigurationDossierWire } from "../types"

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

vi.mock("../_hooks/useTechnicalConfigurationBaseline", () => ({
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

function renderTab(onDirtyChange = vi.fn()) {
  return {
    onDirtyChange,
    ...render(
      <TechnicalConfigurationBaselineTab dossier={dossier} onDirtyChange={onDirtyChange} />,
      {
        wrapper: createReactQueryWrapper(createTestQueryClient()),
      }
    ),
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolver) => {
    resolve = resolver
  })
  return { promise, resolve }
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
