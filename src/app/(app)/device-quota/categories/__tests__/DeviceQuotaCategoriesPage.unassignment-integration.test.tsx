import * as React from "react"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import type { EquipmentPreviewItem } from "@/app/(app)/device-quota/_components/mapping-preview/MappingPreviewPrimitives"
import { callRpc } from "@/lib/rpc-client"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"
import { buildAggregatedCounts } from "../_components/category-tree-utils"
import type { CategoryListItem } from "../_types/categories"
import DeviceQuotaCategoriesPage from "../page"

const mockToast = vi.fn()
const mockUseSession = vi.fn()
const mockUseTenantSelection = vi.fn()

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}))

vi.mock("@/contexts/TenantSelectionContext", () => ({
  useTenantSelection: () => mockUseTenantSelection(),
}))

vi.mock("@/components/shared/TenantSelector", () => ({
  TenantSelector: () => <button type="button">Chọn đơn vị</button>,
}))

vi.mock("../../_components/suggested-mapping/SuggestedMappingPreviewDialog", () => ({
  SuggestedMappingPreviewDialog: () => null,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: vi.fn(),
}))

const mockCallRpc = vi.mocked(callRpc)

const categories: CategoryListItem[] = [
  {
    id: 1,
    parent_id: null,
    ma_nhom: "G1",
    ten_nhom: "Nhóm chẩn đoán hình ảnh",
    phan_loai: "A",
    don_vi_tinh: null,
    thu_tu_hien_thi: 1,
    level: 1,
    so_luong_hien_co: 1,
    so_luong_toi_da: 10,
    so_luong_toi_thieu: 1,
    mo_ta: null,
  },
  {
    id: 2,
    parent_id: 1,
    ma_nhom: "G1.1",
    ten_nhom: "Nhóm máy chẩn đoán",
    phan_loai: "A",
    don_vi_tinh: null,
    thu_tu_hien_thi: 2,
    level: 2,
    so_luong_hien_co: 2,
    so_luong_toi_da: 6,
    so_luong_toi_thieu: 1,
    mo_ta: null,
  },
  {
    id: 3,
    parent_id: 2,
    ma_nhom: "G1.1.1",
    ten_nhom: "Máy X quang",
    phan_loai: "A",
    don_vi_tinh: "Cái",
    thu_tu_hien_thi: 3,
    level: 3,
    so_luong_hien_co: 1,
    so_luong_toi_da: 4,
    so_luong_toi_thieu: 1,
    mo_ta: null,
  },
]

const leafEquipment: EquipmentPreviewItem = {
  id: 101,
  ma_thiet_bi: "TB-001",
  ten_thiet_bi: "Máy X quang GE OEC",
  model: "OEC 9900",
  serial: "SN12345",
  hang_san_xuat: "GE Healthcare",
  khoa_phong_quan_ly: "Khoa CĐHA",
  tinh_trang: "Hoạt động",
}

const parentEquipment: EquipmentPreviewItem = {
  id: 102,
  ma_thiet_bi: "TB-PARENT",
  ten_thiet_bi: "Thiết bị gán trực tiếp cho nhóm cha",
  model: null,
  serial: null,
  hang_san_xuat: null,
  khoa_phong_quan_ly: "Khoa CĐHA",
  tinh_trang: "Hoạt động",
}

function renderPage() {
  const queryClient = createTestQueryClient()
  render(<DeviceQuotaCategoriesPage />, {
    wrapper: createReactQueryWrapper(queryClient),
  })
  return queryClient
}

function getRpcCalls(fn: string) {
  return mockCallRpc.mock.calls.filter(([request]) => request.fn === fn)
}

async function confirmVisibleUnassignment() {
  const user = userEvent.setup()
  const detailPane = screen.getByTestId("device-quota-category-detail-pane")
  const row = await within(detailPane).findByTestId("assigned-equipment-row")

  await user.click(within(row).getByRole("button", { name: "Bỏ khỏi danh mục" }))
  const dialog = screen.getByRole("alertdialog")
  await user.click(within(dialog).getByRole("button", { name: "Bỏ khỏi danh mục" }))

  return { detailPane, row, user }
}

describe("DeviceQuotaCategoriesPage unassignment integration", () => {
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
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSession.mockReturnValue({
      data: { user: { role: "admin", don_vi: "1" } },
      status: "authenticated",
    })
    mockUseTenantSelection.mockReturnValue({
      selectedFacilityId: null,
      showSelector: false,
    })
  })

  it("confirms a leaf unlink, removes the row, updates the count, and allows under-minimum state", async () => {
    mockCallRpc
      .mockResolvedValueOnce(categories)
      .mockResolvedValueOnce([leafEquipment])
      .mockResolvedValueOnce(1)

    const queryClient = renderPage()

    const categoryHeading = await screen.findByRole("heading", {
      level: 2,
      name: "Máy X quang",
    })
    const detailPane = screen.getByTestId("device-quota-category-detail-pane")
    expect(within(detailPane).getByText("1/4")).toBeInTheDocument()
    expect(await within(detailPane).findByText("TB-001")).toBeInTheDocument()

    await confirmVisibleUnassignment()

    await waitFor(() => {
      expect(within(detailPane).queryByText("TB-001")).not.toBeInTheDocument()
      expect(within(detailPane).getByText("0/4")).toBeInTheDocument()
      expect(categoryHeading).toHaveFocus()
    })

    const cachedCategories = queryClient.getQueryData<CategoryListItem[]>([
      "dinh_muc_nhom_list",
      { donViId: 1 },
    ])
    expect(cachedCategories?.find((category) => category.id === 3)).toMatchObject({
      so_luong_hien_co: 0,
      so_luong_toi_thieu: 1,
    })
    expect(getRpcCalls("dinh_muc_thiet_bi_unlink")).toHaveLength(1)
    expect(getRpcCalls("dinh_muc_nhom_list")).toHaveLength(1)
    expect(getRpcCalls("dinh_muc_thiet_bi_by_nhom")).toHaveLength(1)
    expect(mockCallRpc).toHaveBeenCalledTimes(3)
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Đã bỏ khỏi danh mục",
      })
    )
  })

  it("decrements a parent direct count and its aggregate total exactly once", async () => {
    mockCallRpc
      .mockResolvedValueOnce(categories)
      .mockResolvedValueOnce([leafEquipment])
      .mockResolvedValueOnce([parentEquipment])
      .mockResolvedValueOnce(1)

    const queryClient = renderPage()
    const user = userEvent.setup()

    await screen.findByRole("heading", { level: 2, name: "Máy X quang" })
    const navigationPane = screen.getByTestId("device-quota-category-nav-pane")
    await user.click(
      within(navigationPane).getByRole("button", {
        name: /^Chọn danh mục G1\.1: Nhóm máy chẩn đoán\b/,
      })
    )

    const detailPane = screen.getByTestId("device-quota-category-detail-pane")
    expect(await within(detailPane).findByText("TB-PARENT")).toBeInTheDocument()
    expect(within(detailPane).getByText("3/10")).toBeInTheDocument()

    await confirmVisibleUnassignment()

    await waitFor(() => {
      expect(within(detailPane).queryByText("TB-PARENT")).not.toBeInTheDocument()
      expect(within(detailPane).getByText("2/10")).toBeInTheDocument()
    })

    const cachedCategories = queryClient.getQueryData<CategoryListItem[]>([
      "dinh_muc_nhom_list",
      { donViId: 1 },
    ])
    expect(cachedCategories?.find((category) => category.id === 2)?.so_luong_hien_co).toBe(1)
    expect(cachedCategories?.find((category) => category.id === 1)?.so_luong_hien_co).toBe(1)
    expect(buildAggregatedCounts(cachedCategories ?? []).get(1)).toBe(3)
    expect(getRpcCalls("dinh_muc_thiet_bi_unlink")).toHaveLength(1)
    expect(getRpcCalls("dinh_muc_nhom_list")).toHaveLength(1)
    expect(getRpcCalls("dinh_muc_thiet_bi_by_nhom")).toHaveLength(2)
    expect(mockCallRpc).toHaveBeenCalledTimes(4)
  })
})
