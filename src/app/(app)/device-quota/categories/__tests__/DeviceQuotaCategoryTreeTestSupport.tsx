import React from "react"
import { render } from "@testing-library/react"
import { vi } from "vitest"

import { DeviceQuotaCategoryTree as DeviceQuotaCategoryTreeImpl } from "../_components/DeviceQuotaCategoryTree"
import { useDeviceQuotaCategoryContext } from "../_hooks/useDeviceQuotaCategoryContext"

vi.mock("../_hooks/useDeviceQuotaCategoryContext", () => ({
  useDeviceQuotaCategoryContext: vi.fn(),
}))

vi.mock("../_hooks/useDeviceQuotaCategoryAssignment", () => ({
  useDeviceQuotaCategoryUnassignment: () => ({ mutateAsync: vi.fn() }),
}))

vi.mock("../_components/DeviceQuotaCategoryAssignedEquipment", () => ({
  DeviceQuotaCategoryAssignedEquipment: ({
    nhomId,
    variant,
  }: {
    nhomId: number
    variant?: string
  }) => (
    <div data-testid={`assigned-equipment-panel-${nhomId}`} data-variant={variant}>
      Equipment panel
    </div>
  ),
}))

export function DeviceQuotaCategoryTree(
  props: React.ComponentProps<typeof DeviceQuotaCategoryTreeImpl>
) {
  return <DeviceQuotaCategoryTreeImpl {...props} />
}

export const mockUseContext = vi.mocked(useDeviceQuotaCategoryContext)
export type MockCategoryContextValue = ReturnType<typeof useDeviceQuotaCategoryContext>

export const basePagination = {
  pagination: { pageIndex: 0, pageSize: 20 },
  setPagination: vi.fn(),
  pageCount: 0,
  displayPage: 1,
  resetToFirstPage: vi.fn(),
  setPageSize: vi.fn(),
  goToPage: vi.fn(),
  canPreviousPage: false,
  canNextPage: false,
}

export const managerContextAccess = {
  isFacilitySelected: true,
  canManageCategories: true,
  canInspectCategoryDetail: true,
  canAssignManually: true,
}

export const threeLevelTree = [
  {
    id: 1,
    parent_id: null,
    ma_nhom: "I",
    ten_nhom: "Root",
    level: 1,
    so_luong_hien_co: 0,
    so_luong_toi_da: null,
  },
  {
    id: 2,
    parent_id: 1,
    ma_nhom: "01",
    ten_nhom: "Intermediate",
    level: 2,
    so_luong_hien_co: 0,
    so_luong_toi_da: 10,
  },
  {
    id: 4,
    parent_id: 2,
    ma_nhom: "01.01",
    ten_nhom: "Leaf A",
    level: 3,
    so_luong_hien_co: 2,
    so_luong_toi_da: 5,
  },
  {
    id: 5,
    parent_id: 2,
    ma_nhom: "01.02",
    ten_nhom: "Leaf B",
    level: 3,
    so_luong_hien_co: 3,
    so_luong_toi_da: 5,
  },
  {
    id: 3,
    parent_id: 1,
    ma_nhom: "02",
    ten_nhom: "Empty Intermediate",
    level: 2,
    so_luong_hien_co: 0,
    so_luong_toi_da: null,
  },
  {
    id: 6,
    parent_id: 3,
    ma_nhom: "02.01",
    ten_nhom: "Empty Leaf A",
    level: 3,
    so_luong_hien_co: 0,
    so_luong_toi_da: 4,
  },
  {
    id: 7,
    parent_id: 3,
    ma_nhom: "02.02",
    ten_nhom: "Empty Leaf B",
    level: 3,
    so_luong_hien_co: 0,
    so_luong_toi_da: 4,
  },
  {
    id: 8,
    parent_id: 3,
    ma_nhom: "02.03",
    ten_nhom: "Empty Leaf C",
    level: 3,
    so_luong_hien_co: 0,
    so_luong_toi_da: 3,
  },
]

export function renderWithThreeLevelTree() {
  mockUseContext.mockReturnValue({
    categories: threeLevelTree,
    allCategories: threeLevelTree,
    ...managerContextAccess,
    donViId: 1,
    isLoading: false,
    totalRootCount: 1,
    searchTerm: "",
    pagination: basePagination,
    openCreateDialog: vi.fn(),
    openEditDialog: vi.fn(),
    openDeleteDialog: vi.fn(),
    mutatingCategoryId: null,
  } as unknown as MockCategoryContextValue)

  return render(<DeviceQuotaCategoryTree />)
}
