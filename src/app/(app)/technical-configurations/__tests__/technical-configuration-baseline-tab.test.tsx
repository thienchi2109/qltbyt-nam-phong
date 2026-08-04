import "@testing-library/jest-dom"
import { act, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type {
  TechnicalConfigurationBaselineDraftWire,
  TechnicalConfigurationBaselineGroupMutationWire,
} from "@/app/(app)/technical-configurations/baseline-types"
import type { TechnicalConfigurationBaselineVersionPages } from "@/app/(app)/technical-configurations/technical-configuration-baseline-version-state"
import { technicalConfigurationBaselineVersionsQueryKey } from "@/app/(app)/technical-configurations/technical-configuration-query-keys"
import { TechnicalConfigurationRpcError } from "@/app/(app)/technical-configurations/technical-configuration-rpc"
import {
  baselineVersionsResponse,
  createDraft,
  createPersistentQueryClient,
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
    rpc.listVersions.mockReset()
    rpc.getDossier.mockResolvedValue({ data: dossier })
    rpc.listVersions.mockResolvedValue(baselineVersionsResponse([createDraft()]))
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

  it("reloads a clean draft without discard confirmation", async () => {
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

    await user.clear(nameInput)
    await user.type(nameInput, "Yêu cầu chung")
    const listVersionsCallCount = rpc.listVersions.mock.calls.length
    rpc.listVersions.mockResolvedValueOnce(baselineVersionsResponse([createDraft({ revision: 8 })]))

    await user.click(screen.getByRole("button", { name: "Tải lại từ máy chủ" }))

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    await waitFor(() => {
      expect(rpc.listVersions).toHaveBeenCalledTimes(listVersionsCallCount + 1)
    })
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
    rpc.listVersions.mockResolvedValueOnce(baselineVersionsResponse([reloadedDraft]))

    await user.click(screen.getByRole("button", { name: "Tải lại từ máy chủ" }))
    await user.click(await screen.findByRole("button", { name: "Bỏ thay đổi" }))

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

    const pending = deferred<ReturnType<typeof baselineVersionsResponse>>()
    rpc.listVersions.mockReturnValueOnce(pending.promise)

    await user.click(screen.getByRole("button", { name: "Tải lại từ máy chủ" }))
    await user.click(await screen.findByRole("button", { name: "Bỏ thay đổi" }))

    const pendingButton = screen.getByRole("button", { name: "Đang tải lại..." })
    expect(pendingButton).toBeDisabled()
    expect(await screen.findByDisplayValue("Tên đang xung đột")).toBeDisabled()
    await user.click(pendingButton)
    expect(rpc.listVersions).toHaveBeenCalledTimes(3)

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
      technicalConfigurationBaselineVersionsQueryKey(dossier.id),
      expect.any(Function)
    )
    const cachedVersions = queryClient.getQueryData<TechnicalConfigurationBaselineVersionPages>(
      technicalConfigurationBaselineVersionsQueryKey(dossier.id)
    )
    expect(cachedVersions?.pages[0].data[0].revision).toBe(5)
    expect(cachedVersions?.pages[0].data[0].groups[0].name).toBe("Tên nhóm đã được lưu")

    view.unmount()
    renderTab(vi.fn(), queryClient)

    expect(await screen.findByDisplayValue("Tên nhóm đã được lưu")).toBeInTheDocument()
    expect(rpc.listVersions).toHaveBeenCalledTimes(1)
  })

  it("refreshes a locked version into cache before remounting after a save conflict", async () => {
    const user = userEvent.setup()
    const queryClient = createPersistentQueryClient()
    const lockedVersion = createDraft({
      status: "locked",
      locked_at: "2026-07-14T08:30:00.000Z",
      locked_by: 42,
    })
    rpc.listVersions
      .mockResolvedValueOnce(baselineVersionsResponse([createDraft()]))
      .mockResolvedValueOnce(baselineVersionsResponse([lockedVersion]))
    rpc.updateGroup.mockRejectedValue(
      new TechnicalConfigurationRpcError(409, {
        code: "PT409",
        message: "locked_version",
      })
    )
    const view = renderTab(vi.fn(), queryClient)

    const nameInput = await screen.findByDisplayValue("Yêu cầu chung")
    await user.clear(nameInput)
    await user.type(nameInput, "Tên chưa lưu")
    await user.click(screen.getByRole("button", { name: "Lưu" }))

    expect(await screen.findByText("Xung đột dữ liệu")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Tên chưa lưu")).toBeInTheDocument()
    await waitFor(() => expect(rpc.listVersions).toHaveBeenCalledTimes(2))

    view.unmount()
    renderTab(vi.fn(), queryClient)

    expect(
      await screen.findByRole("region", { name: "Nội dung phiên bản đã khóa" })
    ).toBeInTheDocument()
    expect(screen.getByText("Nội dung chỉ đọc")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Lưu" })).not.toBeInTheDocument()
  })

  it("creates a missing draft only from an explicit action and renders locked data as a placeholder", async () => {
    const user = userEvent.setup()
    rpc.listVersions.mockResolvedValueOnce(baselineVersionsResponse([]))
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
    rpc.listVersions.mockResolvedValueOnce(
      baselineVersionsResponse([createDraft({ status: "locked" })])
    )
    renderTab()

    expect(
      await screen.findByRole("region", { name: "Lịch sử phiên bản cấu hình cơ sở" })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Lịch sử phiên bản/ })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Nội dung phiên bản đã khóa" })).toBeInTheDocument()
    expect(screen.getByText("Nội dung chỉ đọc")).toBeInTheDocument()
    expect(screen.getByText("TC-0001")).toBeInTheDocument()
    expect(screen.getByText(/Dòng 1/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Lưu" })).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue("Yêu cầu chung")).not.toBeInTheDocument()
  })
})
