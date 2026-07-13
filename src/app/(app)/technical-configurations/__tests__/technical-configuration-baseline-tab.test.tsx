import "@testing-library/jest-dom"
import { act, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type {
  TechnicalConfigurationBaselineDraftWire,
  TechnicalConfigurationBaselineGroupMutationWire,
} from "@/app/(app)/technical-configurations/baseline-types"
import { TechnicalConfigurationRpcError } from "@/app/(app)/technical-configurations/technical-configuration-rpc"
import {
  createDraft,
  createPersistentQueryClient,
  criterionMutation,
  deferred,
  dossier,
  getBaselineRpcMock,
  groupMutation,
  renderTab,
} from "./technical-configuration-baseline-tab-fixtures"

const rpc = getBaselineRpcMock()

describe("technical configuration baseline tab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.getDraft.mockResolvedValue({ data: createDraft() })
  })

  it("renders server groups and stages multiline, add, and reorder changes without autosave", async () => {
    const user = userEvent.setup()
    renderTab()

    expect(await screen.findByDisplayValue("Yêu cầu chung")).toBeInTheDocument()
    expect(screen.queryByDisplayValue("Yêu cầu cấu hình cung cấp")).not.toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Yêu cầu kỹ thuật.*0 tiêu chí/ })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Xem tất cả nhóm" })).toBeInTheDocument()

    const requirement = screen.getByLabelText("Nội dung yêu cầu 1.1")
    await user.clear(requirement)
    await user.type(requirement, "Nguồn điện ổn định\n220V - 50Hz")
    await user.click(screen.getByRole("button", { name: "Thêm tiêu chí vào nhóm 1" }))
    await user.click(screen.getByRole("tab", { name: /Yêu cầu khác.*0 tiêu chí/ }))
    await user.click(screen.getByRole("button", { name: "Di chuyển nhóm 4 lên" }))
    await user.click(screen.getByRole("tab", { name: /Yêu cầu chung.*2 tiêu chí/ }))

    expect(screen.getByLabelText("Nội dung yêu cầu 1.1")).toHaveValue(
      "Nguồn điện ổn định\n220V - 50Hz"
    )
    expect(screen.getByText("Có thay đổi chưa lưu")).toBeInTheDocument()
    expect(rpc.updateCriterion).not.toHaveBeenCalled()
    expect(rpc.createCriterion).not.toHaveBeenCalled()
    expect(rpc.reorderGroups).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Thêm nhóm" }))
    expect(screen.getByLabelText("Tên nhóm 5")).toHaveFocus()
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

    await user.click(await screen.findByRole("tab", { name: /Yêu cầu cấu hình cung cấp/ }))
    await user.click(screen.getByRole("tab", { name: "Nhập nhiều dòng" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await user.type(
      screen.getByLabelText("Nội dung nhập nhanh"),
      "Nguồn điện ổn định\nÁp lực vận hành ≥ 3 bar"
    )
    await user.click(screen.getByRole("button", { name: "Xem trước" }))
    await user.click(screen.getByRole("button", { name: "Thêm vào bản nháp" }))

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
    expect(await screen.findByDisplayValue("Tên đang xung đột")).toBeDisabled()
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
    const queryClient = createPersistentQueryClient()
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
