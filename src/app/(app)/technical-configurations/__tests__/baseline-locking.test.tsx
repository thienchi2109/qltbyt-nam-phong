import "@testing-library/jest-dom"
import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationRpcError } from "@/app/(app)/technical-configurations/technical-configuration-rpc"

import {
  createDraft,
  createLockedVersion,
  createPersistentQueryClient,
  deferred,
  dossier,
  getBaselineRpcMock,
  groupMutation,
  mockVersions,
  renderTab,
} from "./technical-configuration-baseline-tab-fixtures"

const rpc = getBaselineRpcMock()

describe("technical configuration baseline locking and history", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.getDossier.mockResolvedValue({ data: dossier })
  })

  it("renders a locked historical version without edit affordances", async () => {
    const locked = createLockedVersion()
    mockVersions([locked])

    renderTab()

    expect(await screen.findByText("Phiên bản 1")).toBeInTheDocument()
    expect(screen.getByText("Đã khóa")).toBeInTheDocument()
    expect(screen.getByText("Khóa lúc 14/07/2026 08:30")).toBeInTheDocument()
    expect(screen.getByText("Người khóa #42")).toBeInTheDocument()
    expect(screen.getByText(/Dòng 1\s+Dòng 2/)).toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Lưu" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Tạo bản nháp trống" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Sao chép thành bản nháp" })).toBeEnabled()
  })

  it("renders copied-version lineage when the source page is not loaded", async () => {
    const copied = createDraft({
      id: "locked-3",
      version_number: 3,
      status: "locked",
      source_baseline_version_id: "locked-1",
      source_version_number: 1,
      locked_at: "2026-07-14T08:30:00.000Z",
      locked_by: 42,
    })
    mockVersions([copied])

    renderTab()

    expect(await screen.findByText("Sao chép từ phiên bản 1")).toBeInTheDocument()
  })

  it("requires confirmation and locks the current persisted revision", async () => {
    const user = userEvent.setup()
    const draft = createDraft()
    const locked = createLockedVersion()
    mockVersions([draft])
    rpc.lockVersion.mockResolvedValue({ data: locked })

    renderTab()
    await user.click(await screen.findByRole("button", { name: "Khóa phiên bản" }))

    const dialog = screen.getByRole("alertdialog")
    expect(within(dialog).getByText("Khóa phiên bản 1?")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Khóa vĩnh viễn" }))

    await waitFor(() =>
      expect(rpc.lockVersion).toHaveBeenCalledWith({
        p_baseline_version_id: draft.id,
        p_expected_revision: draft.revision,
      })
    )
    expect(await screen.findByText("Đã khóa")).toBeInTheDocument()
  })

  it("keeps the editor form when lock rejects a stale revision", async () => {
    const user = userEvent.setup()
    const draft = createDraft()
    mockVersions([draft])
    rpc.lockVersion.mockRejectedValue(
      new TechnicalConfigurationRpcError(409, { message: "stale_revision" })
    )

    renderTab()
    const requirement = await screen.findByLabelText("Nội dung yêu cầu 1.1")
    expect(requirement).toHaveValue("Dòng 1\nDòng 2")

    await user.click(screen.getByRole("button", { name: "Khóa phiên bản" }))
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Khóa vĩnh viễn",
      })
    )

    expect(await screen.findByText("Xung đột dữ liệu")).toBeInTheDocument()
    expect(requirement).toHaveValue("Dòng 1\nDòng 2")
    expect(screen.getByRole("button", { name: "Khóa phiên bản" })).toBeEnabled()
  })

  it("reloads a concurrently locked draft into read-only history", async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true)
    const draft = createDraft()
    const locked = createLockedVersion()
    mockVersions([draft])
    rpc.lockVersion.mockRejectedValue(
      new TechnicalConfigurationRpcError(409, { message: "locked_version" })
    )

    renderTab()
    await screen.findByLabelText("Nội dung yêu cầu 1.1")
    await user.click(screen.getByRole("button", { name: "Khóa phiên bản" }))
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Khóa vĩnh viễn",
      })
    )

    expect(await screen.findByText("Xung đột dữ liệu")).toBeInTheDocument()
    rpc.listVersions.mockResolvedValueOnce({
      data: [locked],
      total: 1,
      page: 1,
      page_size: 100,
    })
    await user.click(screen.getByRole("button", { name: "Tải lại từ máy chủ" }))

    expect(confirm).toHaveBeenCalled()
    expect(await screen.findByText("Nội dung chỉ đọc")).toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  })

  it("copies a locked version into a new editable draft", async () => {
    const user = userEvent.setup()
    const queryClient = createPersistentQueryClient()
    const locked = createLockedVersion()
    const copied = createDraft({
      id: "draft-2",
      version_number: 2,
      source_baseline_version_id: locked.id,
      revision: 1,
    })
    mockVersions([locked])
    rpc.copyVersion.mockResolvedValue({
      data: { ...copied, dossier_revision: 4 },
    })
    queryClient.setQueryData(["technical-configurations", "dossiers", "detail", dossier.id], {
      data: dossier,
    })

    renderTab(vi.fn(), queryClient)
    await user.click(await screen.findByRole("button", { name: "Sao chép thành bản nháp" }))

    await waitFor(() =>
      expect(rpc.copyVersion).toHaveBeenCalledWith({
        p_source_baseline_version_id: locked.id,
        p_expected_revision: locked.revision,
      })
    )
    expect(await screen.findByText("Phiên bản 2")).toBeInTheDocument()
    expect(screen.getByLabelText("Nội dung yêu cầu 1.1")).toHaveValue("Dòng 1\nDòng 2")
    expect(
      queryClient.getQueryData<{
        data: typeof dossier
      }>(["technical-configurations", "dossiers", "detail", dossier.id])?.data.revision
    ).toBe(4)
  })

  it("refreshes and keeps the selected locked history when copy rejects a stale revision", async () => {
    const user = userEvent.setup()
    const locked = createLockedVersion()
    mockVersions([locked])
    rpc.copyVersion.mockRejectedValue(
      new TechnicalConfigurationRpcError(409, { message: "stale_revision" })
    )

    renderTab()
    await user.click(await screen.findByRole("button", { name: "Sao chép thành bản nháp" }))

    await waitFor(() => expect(rpc.listVersions).toHaveBeenCalledTimes(2))
    expect(screen.queryByText("Xung đột dữ liệu")).not.toBeInTheDocument()
    expect(screen.getByText("Phiên bản 1")).toBeInTheDocument()
    expect(screen.getByText("Nội dung chỉ đọc")).toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  })

  it("keeps a dirty draft selected when history navigation is rejected", async () => {
    const user = userEvent.setup()
    const locked = createLockedVersion()
    const draft = createDraft({ id: "draft-2", version_number: 2 })
    mockVersions([draft, locked])
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)

    renderTab()
    const requirement = await screen.findByLabelText("Nội dung yêu cầu 1.1")
    await user.clear(requirement)
    await user.type(requirement, "Nội dung đang sửa")
    await user.selectOptions(screen.getByRole("combobox", { name: "Lịch sử phiên bản" }), locked.id)

    expect(confirm).toHaveBeenCalledWith("Chuyển phiên bản sẽ bỏ các thay đổi chưa lưu. Tiếp tục?")
    expect(requirement).toHaveValue("Nội dung đang sửa")
    expect(screen.getByText("Phiên bản 2")).toBeInTheDocument()
    expect(screen.queryByText("Nội dung chỉ đọc")).not.toBeInTheDocument()
  })

  it("blocks history navigation while a save is pending", async () => {
    const user = userEvent.setup()
    const pending = deferred<{ data: ReturnType<typeof groupMutation> }>()
    const locked = createLockedVersion()
    const draft = createDraft({ id: "draft-2", version_number: 2 })
    rpc.listVersions.mockResolvedValue({
      data: [draft, locked],
      total: 101,
      page: 1,
      page_size: 100,
    })
    rpc.updateGroup.mockReturnValue(pending.promise)

    renderTab()
    const groupName = await screen.findByDisplayValue("Yêu cầu chung")
    await user.clear(groupName)
    await user.type(groupName, "Yêu cầu kỹ thuật chung")
    await user.click(screen.getByRole("button", { name: "Lưu" }))

    await waitFor(() => expect(rpc.updateGroup).toHaveBeenCalled())
    expect(screen.getByRole("combobox", { name: "Lịch sử phiên bản" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Tải thêm phiên bản" })).toBeDisabled()

    pending.resolve({ data: groupMutation(5, "Yêu cầu kỹ thuật chung") })
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Lịch sử phiên bản" })).toBeEnabled()
    )
  })

  it("blocks history navigation and handles rejection while refreshing locked history", async () => {
    const user = userEvent.setup()
    const pending = deferred<{
      data: ReturnType<typeof createDraft>[]
      total: number
      page: number
      page_size: number
    }>()
    const locked = createLockedVersion()
    const older = createDraft({
      id: "locked-0",
      version_number: 0,
      status: "locked",
      locked_at: "2026-07-13T08:30:00.000Z",
      locked_by: 41,
    })
    rpc.listVersions
      .mockResolvedValueOnce({
        data: [locked, older],
        total: 102,
        page: 1,
        page_size: 100,
      })
      .mockReturnValueOnce(pending.promise)
    rpc.copyVersion.mockRejectedValue(
      new TechnicalConfigurationRpcError(409, { message: "stale_revision" })
    )

    renderTab()
    await user.click(await screen.findByRole("button", { name: "Sao chép thành bản nháp" }))

    await waitFor(() => expect(rpc.listVersions).toHaveBeenCalledTimes(2))
    expect(screen.getByRole("combobox", { name: "Lịch sử phiên bản" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Tải thêm phiên bản" })).toBeDisabled()

    pending.reject(new Error("network_error"))
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Lịch sử phiên bản" })).toBeEnabled()
    )
    expect(screen.getByText("Xung đột dữ liệu")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sao chép thành bản nháp" })).toBeEnabled()
  })

  it("creates a blank draft after the locked history", async () => {
    const user = userEvent.setup()
    const queryClient = createPersistentQueryClient()
    const locked = createLockedVersion()
    const blank = createDraft({
      id: "draft-2",
      version_number: 2,
      next_criterion_number: 1,
      groups: [],
    })
    mockVersions([locked])
    rpc.createDraft.mockResolvedValue({
      data: { ...blank, dossier_revision: 4 },
    })
    queryClient.setQueryData(["technical-configurations", "dossiers", "detail", dossier.id], {
      data: dossier,
    })

    renderTab(vi.fn(), queryClient)
    await user.click(await screen.findByRole("button", { name: "Tạo bản nháp trống" }))

    await waitFor(() =>
      expect(rpc.createDraft).toHaveBeenCalledWith({
        p_dossier_id: dossier.id,
        p_expected_revision: dossier.revision,
      })
    )
    expect(await screen.findByText("Phiên bản 2")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Thêm nhóm" })).toBeEnabled()
    expect(
      queryClient.getQueryData<{
        data: typeof dossier
      }>(["technical-configurations", "dossiers", "detail", dossier.id])?.data.revision
    ).toBe(4)
  })

  it("shows blank-draft failures from locked history", async () => {
    const user = userEvent.setup()
    const locked = createLockedVersion()
    mockVersions([locked])
    rpc.createDraft.mockRejectedValue(
      new TechnicalConfigurationRpcError(409, { message: "draft_already_exists" })
    )

    renderTab()
    await user.click(await screen.findByRole("button", { name: "Tạo bản nháp trống" }))

    expect(
      await screen.findByText(
        "Dữ liệu hồ sơ đã thay đổi. Trạng thái mới đã được tải; vui lòng thử lại."
      )
    ).toBeInTheDocument()
    expect(screen.getByText("Nội dung chỉ đọc")).toBeInTheDocument()
  })
})
