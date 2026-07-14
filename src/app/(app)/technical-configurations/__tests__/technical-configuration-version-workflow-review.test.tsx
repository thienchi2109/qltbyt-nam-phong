import "@testing-library/jest-dom"
import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationRpcError } from "@/app/(app)/technical-configurations/technical-configuration-rpc"

import {
  baselineVersionsResponse,
  createDraft,
  createLockedVersion,
  deferred,
  dossier,
  getBaselineRpcMock,
  mockVersions,
  renderTab,
} from "./technical-configuration-baseline-tab-fixtures"

const rpc = getBaselineRpcMock()

describe("technical configuration version workflow review regressions", () => {
  beforeEach(() => {
    for (const mock of Object.values(rpc)) mock.mockReset()
    rpc.getDossier.mockResolvedValue({ data: dossier })
  })

  it("switches versions after confirmed discard of dirty editor changes", async () => {
    const user = userEvent.setup()
    const locked = createLockedVersion()
    const draft = createDraft({ id: "draft-2", version_number: 2 })
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true)
    mockVersions([draft, locked])

    renderTab()
    const requirement = await screen.findByLabelText("Nội dung yêu cầu 1.1")
    await user.clear(requirement)
    await user.type(requirement, "Nội dung đang sửa")
    await user.selectOptions(screen.getByRole("combobox", { name: "Lịch sử phiên bản" }), locked.id)

    expect(confirm).toHaveBeenCalledWith("Chuyển phiên bản sẽ bỏ các thay đổi chưa lưu. Tiếp tục?")
    expect(await screen.findByText("Phiên bản 1")).toBeInTheDocument()
    expect(screen.getByText("Nội dung chỉ đọc")).toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  })

  it("switches versions after confirmed discard of pending bulk input", async () => {
    const user = userEvent.setup()
    const locked = createLockedVersion()
    const draft = createDraft({ id: "draft-2", version_number: 2 })
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true)
    mockVersions([draft, locked])

    renderTab()
    await user.click(await screen.findByRole("tab", { name: "Nhập nhiều dòng" }))
    await user.type(screen.getByLabelText("Nội dung nhập nhanh"), "Nội dung chưa áp dụng")
    await user.selectOptions(screen.getByRole("combobox", { name: "Lịch sử phiên bản" }), locked.id)

    expect(confirm).toHaveBeenCalledWith("Chuyển phiên bản sẽ bỏ các thay đổi chưa lưu. Tiếp tục?")
    expect(await screen.findByText("Phiên bản 1")).toBeInTheDocument()
    expect(screen.getByText("Nội dung chỉ đọc")).toBeInTheDocument()
    expect(screen.queryByLabelText("Nội dung nhập nhanh")).not.toBeInTheDocument()
  })

  it("disables locking while conflict reload is pending", async () => {
    const user = userEvent.setup()
    const pending = deferred<ReturnType<typeof baselineVersionsResponse>>()
    const draft = createDraft()
    mockVersions([draft])
    rpc.lockVersion.mockRejectedValue(
      new TechnicalConfigurationRpcError(409, { message: "stale_revision" })
    )

    renderTab()
    await user.click(await screen.findByRole("button", { name: "Khóa phiên bản" }))
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Khóa vĩnh viễn",
      })
    )
    expect(await screen.findByText("Xung đột dữ liệu")).toBeInTheDocument()

    rpc.listVersions.mockReturnValueOnce(pending.promise)
    vi.spyOn(window, "confirm").mockReturnValueOnce(true)
    await user.click(screen.getByRole("button", { name: "Tải lại từ máy chủ" }))

    const lockWasDisabled = screen
      .getByRole("button", { name: "Khóa phiên bản" })
      .hasAttribute("disabled")
    await act(async () => {
      pending.resolve(baselineVersionsResponse([{ ...draft, revision: 8 }]))
      await pending.promise
    })
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Lịch sử phiên bản" })).toBeEnabled()
    )

    expect(lockWasDisabled).toBe(true)
  })

  it("disables draft actions while loading more locked history", async () => {
    const user = userEvent.setup()
    const pending = deferred<ReturnType<typeof baselineVersionsResponse>>()
    const locked = createLockedVersion()
    const older = createLockedVersion({
      id: "locked-0",
      version_number: 0,
      locked_at: "2026-07-13T08:30:00.000Z",
      locked_by: 41,
    })
    rpc.listVersions
      .mockResolvedValueOnce({
        data: [locked],
        total: 101,
        page: 1,
        page_size: 100,
      })
      .mockReturnValueOnce(pending.promise)

    renderTab()
    await user.click(await screen.findByRole("button", { name: "Tải thêm phiên bản" }))
    await waitFor(() => expect(rpc.listVersions).toHaveBeenCalledTimes(2))

    const createWasDisabled = screen
      .getByRole("button", { name: "Tạo bản nháp trống" })
      .hasAttribute("disabled")
    const copyWasDisabled = screen
      .getByRole("button", { name: "Sao chép thành bản nháp" })
      .hasAttribute("disabled")
    await act(async () => {
      pending.resolve({
        data: [older],
        total: 101,
        page: 2,
        page_size: 100,
      })
      await pending.promise
    })
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Lịch sử phiên bản" })).toBeEnabled()
    )

    expect(createWasDisabled).toBe(true)
    expect(copyWasDisabled).toBe(true)
  })

  it("shows copied lineage on the editable draft immediately", async () => {
    const user = userEvent.setup()
    const locked = createLockedVersion()
    const copied = createDraft({
      id: "draft-2",
      version_number: 2,
      source_baseline_version_id: locked.id,
      source_version_number: locked.version_number,
      revision: 1,
    })
    mockVersions([locked])
    rpc.copyVersion.mockResolvedValue({
      data: { ...copied, dossier_revision: 4 },
    })

    renderTab()
    await user.click(await screen.findByRole("button", { name: "Sao chép thành bản nháp" }))

    expect(await screen.findByText("Phiên bản 2")).toBeInTheDocument()
    expect(screen.getByText("Sao chép từ phiên bản 1")).toBeInTheDocument()
  })
})
