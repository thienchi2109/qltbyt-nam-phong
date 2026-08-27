import * as React from "react"
import "@testing-library/jest-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationsClient } from "../TechnicalConfigurationsClient"
import type {
  TechnicalConfigurationDossierListItemWire,
  TechnicalConfigurationDossierListRpcArgs,
  TechnicalConfigurationDossierListWireResponse,
} from "../types"
import {
  buildDossierListPage,
  buildDossierListRow,
  createQueryClient,
  dossier,
  flushQueryNotifications,
} from "./technical-configuration-dossier-actions-test-harness"

const mocks = vi.hoisted(() => ({
  listDossiers: vi.fn(),
  getDossier: vi.fn(),
  createDossier: vi.fn(),
  updateDossier: vi.fn(),
  deleteDossier: vi.fn(),
}))

vi.mock("../technical-configuration-rpc", () => ({
  listTechnicalConfigurationDossiers: (...args: unknown[]) => mocks.listDossiers(...args),
  getTechnicalConfigurationDossier: (...args: unknown[]) => mocks.getDossier(...args),
  createTechnicalConfigurationDossier: (...args: unknown[]) => mocks.createDossier(...args),
  updateTechnicalConfigurationDossier: (...args: unknown[]) => mocks.updateDossier(...args),
  deleteTechnicalConfigurationDossier: (...args: unknown[]) => mocks.deleteDossier(...args),
}))

function renderClient() {
  const queryClient = createQueryClient()
  const renderResult = render(
    <QueryClientProvider client={queryClient}>
      <TechnicalConfigurationsClient />
    </QueryClientProvider>
  )

  return { queryClient, ...renderResult }
}

function getListCallArgs(call: number): TechnicalConfigurationDossierListRpcArgs {
  const [args] = mocks.listDossiers.mock.calls[call - 1] as [
    TechnicalConfigurationDossierListRpcArgs,
    AbortSignal?,
  ]

  return args
}

function createDeferredListResponse() {
  let resolveResponse: (response: TechnicalConfigurationDossierListWireResponse) => void = () =>
    undefined
  const promise = new Promise<TechnicalConfigurationDossierListWireResponse>((resolve) => {
    resolveResponse = resolve
  })

  return { promise, resolveResponse }
}

const initialDossier: TechnicalConfigurationDossierListItemWire = {
  ...dossier,
  id: "dossier-initial",
  name: "Hồ sơ máy siêu âm",
}

const filteredDossier: TechnicalConfigurationDossierListItemWire = {
  ...dossier,
  id: "dossier-filtered",
  name: "Hồ sơ máy CT",
  device_type_name: "Máy CT",
}

describe("technical configuration dossier search UI", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("keeps the shared local search visible before the initial skeleton and empty state", async () => {
    const initialRequest = createDeferredListResponse()
    mocks.listDossiers.mockReturnValue(initialRequest.promise)
    const { container } = renderClient()

    const searchInput = screen.getByRole("searchbox", {
      name: "Tìm theo loại thiết bị hoặc tên hồ sơ...",
    })
    const searchSlot = container.querySelector(".md\\:min-w-\\[280px\\]")

    expect(searchInput).toHaveAttribute("maxlength", "200")
    expect(searchSlot).toHaveClass("w-full", "md:min-w-[280px]", "md:max-w-[460px]")
    expect(screen.getByLabelText("Đang tải hồ sơ cấu hình")).toBeInTheDocument()
    expect(
      searchInput.compareDocumentPosition(screen.getByLabelText("Đang tải hồ sơ cấu hình"))
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)

    await act(async () => {
      initialRequest.resolveResponse(
        buildDossierListPage(
          {
            p_page: 1,
            p_page_size: 20,
            p_include_archived: false,
          },
          [],
          0
        )
      )
      await Promise.resolve()
    })
    await flushQueryNotifications()

    expect(screen.getByText("Chưa có hồ sơ cấu hình")).toBeInTheDocument()

    fireEvent.change(searchInput, { target: { value: "Máy CT" } })
    expect(screen.getByText("Chưa có hồ sơ cấu hình")).toBeInTheDocument()

    fireEvent.change(searchInput, { target: { value: "---" } })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    await flushQueryNotifications()

    expect(screen.getByText("Chưa có hồ sơ cấu hình")).toBeInTheDocument()
    expect(mocks.listDossiers).toHaveBeenCalledTimes(1)
  })

  it("retains rows and freezes pagination through debounce and the current search request", async () => {
    const searchRequest = createDeferredListResponse()
    mocks.listDossiers
      .mockResolvedValueOnce(
        buildDossierListPage(
          {
            p_page: 1,
            p_page_size: 20,
            p_include_archived: false,
          },
          [initialDossier],
          40
        )
      )
      .mockReturnValueOnce(searchRequest.promise)
    renderClient()
    await flushQueryNotifications()

    const searchInput = screen.getByRole("searchbox", {
      name: "Tìm theo loại thiết bị hoặc tên hồ sơ...",
    })
    const tableRegion = screen.getByRole("region", { name: "Bảng hồ sơ cấu hình" })
    const nextPageButton = screen.getByRole("button", { name: "Trang tiếp" })
    const openDossierButton = screen.getByRole("button", {
      name: `Mở ${initialDossier.name}`,
    })

    expect(screen.getByText(initialDossier.name)).toBeInTheDocument()
    fireEvent.change(searchInput, { target: { value: "Máy CT" } })

    expect(screen.getByRole("status", { name: "Đang tìm kiếm hồ sơ" })).toBeInTheDocument()
    expect(tableRegion).toHaveAttribute("aria-busy", "true")
    expect(nextPageButton).toBeDisabled()
    expect(openDossierButton).toBeEnabled()
    expect(searchInput).toBeEnabled()
    expect(screen.getByRole("button", { name: "Xóa tìm kiếm" })).toBeEnabled()
    expect(screen.getByText(initialDossier.name)).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(mocks.listDossiers).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    await flushQueryNotifications()

    expect(mocks.listDossiers).toHaveBeenCalledTimes(2)
    expect(getListCallArgs(2)).toEqual({
      p_page: 1,
      p_page_size: 20,
      p_include_archived: false,
      p_search: "may ct",
    })
    expect(screen.getByText(initialDossier.name)).toBeInTheDocument()
    expect(tableRegion).toHaveAttribute("aria-busy", "true")
    expect(nextPageButton).toBeDisabled()

    await act(async () => {
      searchRequest.resolveResponse(buildDossierListPage(getListCallArgs(2), [filteredDossier], 40))
      await Promise.resolve()
    })
    await flushQueryNotifications()

    expect(screen.getByText(filteredDossier.name)).toBeInTheDocument()
    expect(screen.queryByText(initialDossier.name)).not.toBeInTheDocument()
    expect(tableRegion).toHaveAttribute("aria-busy", "false")
    expect(nextPageButton).toBeEnabled()
    expect(screen.queryByRole("status", { name: "Đang tìm kiếm hồ sơ" })).not.toBeInTheDocument()
  })

  it("preserves shared clear and Escape focus behavior without writing search state to the URL", async () => {
    mocks.listDossiers.mockImplementation((args: TechnicalConfigurationDossierListRpcArgs) =>
      Promise.resolve(
        buildDossierListPage(
          args,
          args.p_search ? [buildDossierListRow(`search-${args.p_search}`)] : [initialDossier],
          1
        )
      )
    )
    const initialUrl = window.location.href
    renderClient()
    await flushQueryNotifications()

    const searchInput = screen.getByRole("searchbox", {
      name: "Tìm theo loại thiết bị hoặc tên hồ sơ...",
    })

    fireEvent.change(searchInput, { target: { value: "Máy CT" } })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    await flushQueryNotifications()

    fireEvent.click(screen.getByRole("button", { name: "Xóa tìm kiếm" }))
    expect(searchInput).toHaveValue("")
    expect(searchInput).toHaveFocus()
    expect(window.location.href).toBe(initialUrl)
    expect(screen.getByRole("status", { name: "Đang tìm kiếm hồ sơ" })).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(300)
    })
    await flushQueryNotifications()
    expect(screen.getByText(initialDossier.name)).toBeInTheDocument()

    fireEvent.change(searchInput, { target: { value: "Máy MRI" } })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    await flushQueryNotifications()
    fireEvent.keyDown(searchInput, { key: "Escape" })

    expect(searchInput).toHaveValue("")
    expect(searchInput).toHaveFocus()
    expect(window.location.href).toBe(initialUrl)
    expect(screen.getByRole("status", { name: "Đang tìm kiếm hồ sơ" })).toBeInTheDocument()
  })

  it("distinguishes filtered empty and error states while keeping search and retry visible", async () => {
    mocks.listDossiers
      .mockResolvedValueOnce(
        buildDossierListPage(
          {
            p_page: 1,
            p_page_size: 20,
            p_include_archived: false,
          },
          [initialDossier],
          1
        )
      )
      .mockResolvedValueOnce(
        buildDossierListPage(
          {
            p_page: 1,
            p_page_size: 20,
            p_include_archived: false,
            p_search: "khong co",
          },
          [],
          0
        )
      )
      .mockRejectedValueOnce(new Error("Mất kết nối"))
      .mockResolvedValueOnce(
        buildDossierListPage(
          {
            p_page: 1,
            p_page_size: 20,
            p_include_archived: false,
            p_search: "loi mang",
          },
          [filteredDossier],
          1
        )
      )
    renderClient()
    await flushQueryNotifications()

    const searchInput = screen.getByRole("searchbox", {
      name: "Tìm theo loại thiết bị hoặc tên hồ sơ...",
    })
    fireEvent.change(searchInput, { target: { value: "Không có" } })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    await flushQueryNotifications()

    expect(screen.getByText('Không tìm thấy hồ sơ phù hợp với "Không có"')).toBeInTheDocument()

    fireEvent.change(searchInput, { target: { value: "" } })
    expect(screen.getByText('Không tìm thấy hồ sơ phù hợp với "Không có"')).toBeInTheDocument()

    fireEvent.change(searchInput, { target: { value: "Lỗi mạng" } })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    await flushQueryNotifications()

    expect(searchInput).toHaveValue("Lỗi mạng")
    expect(screen.getByText("Mất kết nối")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument()
    expect(screen.queryByText(initialDossier.name)).not.toBeInTheDocument()
    expect(screen.queryByText(filteredDossier.name)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }))
    await flushQueryNotifications()

    expect(screen.getByText(filteredDossier.name)).toBeInTheDocument()
    expect(screen.queryByText("Mất kết nối")).not.toBeInTheDocument()
  })
})
