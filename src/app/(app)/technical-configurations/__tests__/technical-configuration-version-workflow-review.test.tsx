import "@testing-library/jest-dom"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationVersionBar } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationVersionBar"
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

  it("recovers offset-shift history from the load-more control", async () => {
    const user = userEvent.setup()
    const createVersions = (highestVersion: number, count: number) =>
      Array.from({ length: count }, (_, index) =>
        createLockedVersion({
          id: `version-${highestVersion - index}`,
          version_number: highestVersion - index,
        })
      )
    const initialFirstPage = createVersions(200, 100)
    const refreshedFirstPage = createVersions(201, 100)
    const shiftedSecondPage = createVersions(101, 100)
    const finalPage = createVersions(1, 1)
    let pageOneRequestCount = 0
    rpc.listVersions.mockImplementation(({ p_page }: { p_page: number }) => {
      if (p_page === 2) {
        return Promise.resolve({
          data: shiftedSecondPage,
          total: 201,
          page: 2,
          page_size: 100,
        })
      }
      if (p_page === 3) {
        return Promise.resolve({ data: finalPage, total: 201, page: 3, page_size: 100 })
      }
      pageOneRequestCount += 1
      return Promise.resolve({
        data: pageOneRequestCount === 1 ? initialFirstPage : refreshedFirstPage,
        total: pageOneRequestCount === 1 ? 200 : 201,
        page: 1,
        page_size: 100,
      })
    })

    renderTab()
    await user.click(await screen.findByRole("button", { name: "Tải thêm phiên bản" }))
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Tải thêm phiên bản" })).toBeEnabled()
    )
    await user.click(screen.getByRole("button", { name: "Tải thêm phiên bản" }))

    const retry = await screen.findByRole("button", { name: "Tải lại lịch sử phiên bản" })
    await user.click(retry)

    expect(
      await screen.findByRole("option", { name: "Phiên bản 201 · Đã khóa" })
    ).toBeInTheDocument()
    expect(rpc.listVersions).toHaveBeenCalledWith({
      p_dossier_id: dossier.id,
      p_page: 1,
      p_page_size: 100,
    })
  })

  it("keeps a preserved historical selection represented in the selector", () => {
    const selectedVersion = createLockedVersion({ id: "version-1", version_number: 1 })
    const visibleVersion = createLockedVersion({ id: "version-2", version_number: 2 })

    render(
      <TechnicalConfigurationVersionBar
        versions={[visibleVersion]}
        selectedVersion={selectedVersion}
        lockBlockedReason={null}
        status={{
          hasDraft: false,
          isCreating: false,
          isLocking: false,
          isCopying: false,
          isLoadingMoreVersions: false,
          isNavigationDisabled: false,
          hasMoreVersions: true,
        }}
        onSelectVersion={vi.fn()}
        onLoadMoreVersions={vi.fn()}
        onRequestLock={vi.fn()}
        onCreateBlank={vi.fn()}
        onCopy={vi.fn()}
      />
    )

    const selector = screen.getByRole("combobox", {
      name: "Lịch sử phiên bản",
    }) as HTMLSelectElement
    expect(selector.value).toBe(selectedVersion.id)
    expect(
      within(selector).getByRole("option", { name: "Phiên bản 1 · Đã khóa" })
    ).toBeInTheDocument()
  })

  it("clears the creation alert after adopting a concurrently created draft", async () => {
    const user = userEvent.setup()
    const existingDraft = createDraft()
    rpc.listVersions
      .mockResolvedValueOnce(baselineVersionsResponse([]))
      .mockResolvedValueOnce(baselineVersionsResponse([existingDraft]))
    rpc.createDraft.mockRejectedValue(
      new TechnicalConfigurationRpcError(409, { message: "draft_already_exists" })
    )

    renderTab()
    await user.click(await screen.findByRole("button", { name: "Khởi tạo cấu hình cơ sở" }))

    expect(await screen.findByLabelText("Nội dung yêu cầu 1.1")).toBeInTheDocument()
    expect(screen.queryByText("Không thể khởi tạo bản nháp.")).not.toBeInTheDocument()
  })
})
