import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import DeviceQuotaCategoriesPage from "../page"
import { callRpc } from "@/lib/rpc-client"
import {
  assignedEquipment,
  categories,
  category,
  secondAssignedEquipment,
  secondUnassignedEquipment,
  unassignedEquipment,
} from "./DeviceQuotaCategoryManualAssignmentFixtures"

const mockUseSession = vi.fn()
const mockToast = vi.fn()

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}))

vi.mock("@/contexts/TenantSelectionContext", () => ({
  useTenantSelection: () => ({
    selectedFacilityId: null,
    showSelector: false,
  }),
}))

vi.mock("@/components/shared/TenantSelector", () => ({
  TenantSelector: () => <button type="button">Chọn đơn vị</button>,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: vi.fn(),
}))

const mockCallRpc = vi.mocked(callRpc)

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  vi.stubGlobal("ResizeObserver", ResizeObserverMock)
})

type RpcRequest = {
  fn: string
  args?: Record<string, unknown>
}

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function setupRpc({
  linkResult = 1,
  linkError,
  unassignedResult = unassignedEquipment,
  previewResult = assignedEquipment,
  reconciledResult = assignedEquipment,
  deferredReconciliation,
}: {
  linkResult?: number
  linkError?: Error
  unassignedResult?: typeof unassignedEquipment
  previewResult?: typeof assignedEquipment
  reconciledResult?: typeof assignedEquipment
  deferredReconciliation?: Deferred<typeof assignedEquipment>
} = {}) {
  let linkAttempted = false

  mockCallRpc.mockImplementation((request) => {
    const { fn } = request as RpcRequest

    switch (fn) {
      case "dinh_muc_nhom_list":
        return Promise.resolve(categories)
      case "dinh_muc_thiet_bi_unassigned_filter_options":
        return Promise.resolve({
          departments: [],
          users: [],
          locations: [],
          fundingSources: [],
        })
      case "dinh_muc_thiet_bi_unassigned":
        return Promise.resolve(linkAttempted && linkResult > 0 ? [] : unassignedResult)
      case "dinh_muc_thiet_bi_by_ids":
        return Promise.resolve(previewResult)
      case "dinh_muc_thiet_bi_by_nhom":
        if (!linkAttempted) return Promise.resolve([])
        return deferredReconciliation?.promise ?? Promise.resolve(reconciledResult)
      case "dinh_muc_thiet_bi_link":
        linkAttempted = true
        return linkError ? Promise.reject(linkError) : Promise.resolve(linkResult)
      default:
        return Promise.resolve([])
    }
  })
}

async function enterAssignmentAndOpenPreview(equipmentCodes = ["TB-001"], targetName?: RegExp) {
  const user = userEvent.setup()

  render(<DeviceQuotaCategoriesPage />, { wrapper: createWrapper() })

  if (targetName) {
    await user.click(await screen.findByRole("button", { name: targetName }))
  }
  await user.click(await screen.findByRole("button", { name: "Phân loại thiết bị" }))
  for (const equipmentCode of equipmentCodes) {
    const equipmentButton = (await screen.findByText(equipmentCode)).closest("button")
    expect(equipmentButton).not.toBeNull()
    await user.click(equipmentButton as HTMLButtonElement)
  }
  await user.click(screen.getByRole("button", { name: "Phân loại" }))
  await screen.findByRole("dialog", { name: "Xác nhận phân loại thiết bị" })

  return user
}

describe("DeviceQuota Categories manual assignment", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSession.mockReturnValue({
      data: { user: { role: "to_qltb", don_vi: "1" } },
      status: "authenticated",
    })
  })

  it("keeps assignment actions visible while only the equipment rows scroll", async () => {
    setupRpc()
    const user = userEvent.setup()

    render(<DeviceQuotaCategoriesPage />, { wrapper: createWrapper() })

    await user.click(await screen.findByRole("button", { name: "Phân loại thiết bị" }))

    const pane = screen.getByTestId("device-quota-category-assignment-pane")
    const scrollRegion = screen.getByTestId("device-quota-manual-mapping-scroll")
    const actions = screen.getByTestId("device-quota-category-assignment-actions")

    expect(pane).toHaveClass("h-full", "overflow-hidden")
    expect(pane.parentElement).toHaveClass("lg:h-[calc(100vh-12rem)]", "lg:overflow-hidden")
    expect(scrollRegion).toHaveClass("min-h-0", "flex-1", "overflow-y-auto")
    expect(scrollRegion).not.toContainElement(actions)
  })

  it("keeps the desktop preview contained and shows the full equipment name", async () => {
    const longEquipmentName =
      "Bảng điều khiển monitor trung tâm, 24 kênh, có 16 máy monitor theo dõi liên tục"
    setupRpc({
      previewResult: [{ ...assignedEquipment[0], ten_thiet_bi: longEquipmentName }],
    })

    await enterAssignmentAndOpenPreview()

    expect(screen.getByRole("dialog", { name: "Xác nhận phân loại thiết bị" })).toHaveClass(
      "max-w-2xl",
      "md:w-[calc(100%-2rem)]",
      "md:max-w-4xl"
    )
    expect(screen.getByTestId("device-quota-mapping-preview-layout")).toHaveClass("md:min-w-0")
    const equipmentList = screen.getByTestId("device-quota-mapping-preview-equipment-list")
    expect(equipmentList).toHaveClass(
      "md:min-w-0",
      "md:[&_p]:overflow-visible",
      "md:[&_p]:text-clip",
      "md:[&_p]:whitespace-normal",
      "md:[&_p]:break-words"
    )
    expect(screen.getByText(longEquipmentName)).toBeVisible()
  })

  it("preserves the selected category and equipment selection when preview is cancelled", async () => {
    setupRpc()
    const user = await enterAssignmentAndOpenPreview()

    await user.click(screen.getByRole("button", { name: "Hủy" }))

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByText("Thiết bị chưa phân loại")).toBeInTheDocument()
    expect(screen.getByText("Chọn tất cả trang này (1/1)")).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: /^Chọn danh mục G1\.1: Máy X quang\b/,
        pressed: true,
      })
    ).toBeInTheDocument()
    expect(mockCallRpc).not.toHaveBeenCalledWith(
      expect.objectContaining({ fn: "dinh_muc_thiet_bi_link" })
    )
  })

  it("keeps the assignment target locked while assignment mode is active", async () => {
    setupRpc()
    const user = await enterAssignmentAndOpenPreview()

    await user.click(screen.getByRole("button", { name: "Hủy" }))
    await user.click(
      screen.getByRole("button", {
        name: /^Chọn danh mục G1: Nhóm chẩn đoán hình ảnh\b/,
      })
    )

    expect(screen.getByTestId("device-quota-category-assignment-pane")).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: /^Chọn danh mục G1\.1: Máy X quang\b/,
        pressed: true,
      })
    ).toBeInTheDocument()
  })

  it("locks tenant selection for the active assignment session", async () => {
    setupRpc()
    const user = await enterAssignmentAndOpenPreview()
    const tenantButton = screen.getByText("Chọn đơn vị").closest("button")

    expect(tenantButton).not.toBeNull()
    expect(tenantButton).toBeDisabled()

    await user.click(screen.getByRole("button", { name: "Hủy" }))
    await user.click(screen.getByRole("button", { name: "Quay lại chi tiết" }))

    expect(tenantButton).toBeEnabled()
  })

  it("keeps the assignment target stable when category search changes", async () => {
    setupRpc()
    const user = await enterAssignmentAndOpenPreview()

    await user.click(screen.getByRole("button", { name: "Hủy" }))
    await user.type(screen.getByPlaceholderText("Tìm theo mã, tên nhóm..."), "không tồn tại")

    expect(screen.getByTestId("device-quota-category-assignment-pane")).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("G1.1 · Máy X quang")
  })

  it("waits for exact reconciliation before returning to the same category detail", async () => {
    const reconciliation = createDeferred<typeof assignedEquipment>()
    setupRpc({ deferredReconciliation: reconciliation })
    const user = await enterAssignmentAndOpenPreview()

    await user.click(screen.getByRole("button", { name: "Xác nhận phân loại" }))

    await waitFor(() => {
      expect(mockCallRpc).toHaveBeenCalledWith({
        fn: "dinh_muc_thiet_bi_link",
        args: {
          p_thiet_bi_ids: [101],
          p_nhom_id: 2,
          p_don_vi: 1,
        },
      })
    })
    expect(screen.getAllByText("Đang xử lý...").length).toBeGreaterThan(0)
    expect(screen.queryByTestId("device-quota-category-detail-pane")).not.toBeInTheDocument()

    reconciliation.resolve(assignedEquipment)

    const detailPane = await screen.findByTestId("device-quota-category-detail-pane")
    expect(
      within(detailPane).getByRole("heading", { level: 2, name: category.ten_nhom })
    ).toBeInTheDocument()
    expect(within(detailPane).getByTestId("assigned-equipment-row")).toHaveAttribute(
      "data-reconciled",
      "true"
    )
    expect(
      screen.getByRole("button", {
        name: /^Chọn danh mục G1\.1: Máy X quang\b/,
        pressed: true,
      })
    ).toBeInTheDocument()
    expect(mockCallRpc).toHaveBeenCalledWith({
      fn: "dinh_muc_thiet_bi_by_nhom",
      args: { p_nhom_id: 2, p_don_vi: 1 },
    })
  })

  it("reports count-based partial success and highlights only IDs in refreshed detail", async () => {
    setupRpc({
      linkResult: 1,
      unassignedResult: [{ ...unassignedEquipment[0], total_count: 2 }, secondUnassignedEquipment],
      previewResult: [...assignedEquipment, secondAssignedEquipment],
      reconciledResult: assignedEquipment,
    })
    const user = await enterAssignmentAndOpenPreview(["TB-001", "TB-002"])

    await user.click(screen.getByRole("button", { name: "Xác nhận phân loại" }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Đã gán một phần",
        description: "Đã gán 1/2 thiết bị vào nhóm định mức.",
      })
    })
    const detailPane = await screen.findByTestId("device-quota-category-detail-pane")
    const rows = within(detailPane).getAllByTestId("assigned-equipment-row")
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveAttribute("data-reconciled", "true")
    expect(within(detailPane).queryByText("TB-002")).not.toBeInTheDocument()
  })

  it("assigns and reconciles a parent category as the exact target", async () => {
    setupRpc()
    const user = await enterAssignmentAndOpenPreview(
      ["TB-001"],
      /^Chọn danh mục G1: Nhóm chẩn đoán hình ảnh\b/
    )

    await user.click(screen.getByRole("button", { name: "Xác nhận phân loại" }))

    await waitFor(() => {
      expect(mockCallRpc).toHaveBeenCalledWith({
        fn: "dinh_muc_thiet_bi_link",
        args: {
          p_thiet_bi_ids: [101],
          p_nhom_id: 1,
          p_don_vi: 1,
        },
      })
      expect(mockCallRpc).toHaveBeenCalledWith({
        fn: "dinh_muc_thiet_bi_by_nhom",
        args: {
          p_nhom_id: 1,
          p_don_vi: 1,
        },
      })
    })
  })

  it("stays in assignment mode and reports zero affected equipment without reconciling stale detail", async () => {
    setupRpc({ linkResult: 0 })
    const user = await enterAssignmentAndOpenPreview()

    await user.click(screen.getByRole("button", { name: "Xác nhận phân loại" }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        variant: "destructive",
        title: "Chưa gán được thiết bị",
        description: "Không có thiết bị nào được gán. Vui lòng kiểm tra và thử lại.",
      })
    })
    expect(screen.getByText("Thiết bị chưa phân loại")).toBeInTheDocument()
    expect(screen.getByText("Chọn tất cả trang này (1/1)")).toBeInTheDocument()
    expect(screen.queryByTestId("device-quota-category-detail-pane")).not.toBeInTheDocument()
    expect(
      mockCallRpc.mock.calls.filter(
        ([request]) => (request as RpcRequest).fn === "dinh_muc_thiet_bi_by_nhom"
      )
    ).toHaveLength(1)
  })

  it("keeps the current assignment selection when the link RPC fails", async () => {
    setupRpc({ linkError: new Error("RPC unavailable") })
    const user = await enterAssignmentAndOpenPreview()

    await user.click(screen.getByRole("button", { name: "Xác nhận phân loại" }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        variant: "destructive",
        title: "Lỗi gán thiết bị",
        description: "RPC unavailable",
      })
    })
    expect(screen.getByText("Thiết bị chưa phân loại")).toBeInTheDocument()
    expect(screen.getByText("Chọn tất cả trang này (1/1)")).toBeInTheDocument()
  })
})
