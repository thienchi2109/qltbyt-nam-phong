import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"

import { DeviceQuotaCategoryTree } from "../_components/DeviceQuotaCategoryTree"
import { useDeviceQuotaMappingContext } from "../_hooks/useDeviceQuotaMappingContext"
import type { ListFilterSearchCardProps } from "@/components/shared/ListFilterSearchCard"

vi.mock("../_hooks/useDeviceQuotaMappingContext", () => ({
  useDeviceQuotaMappingContext: vi.fn(),
}))

vi.mock("@/components/shared/ListFilterSearchCard", () => ({
  ListFilterSearchCard: ({
    title,
    description,
    searchValue,
    onSearchChange,
    searchPlaceholder,
  }: ListFilterSearchCardProps) => (
    <section data-testid="shared-category-filter-card">
      <h2>{title}</h2>
      <p>{description}</p>
      {typeof searchPlaceholder === "string" && typeof onSearchChange === "function" ? (
        <input
          aria-label={searchPlaceholder}
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      ) : null}
    </section>
  ),
}))

const mockUseContext = vi.mocked(useDeviceQuotaMappingContext)
type MappingContext = ReturnType<typeof useDeviceQuotaMappingContext>

const makeContext = (overrides: Partial<MappingContext> = {}): MappingContext => ({
  user: null,
  donViId: 1,
  isFacilitySelected: true,
  unassignedEquipment: [],
  totalEquipmentCount: 0,
  categories: [],
  allCategories: [],
  selectedEquipmentIds: new Set<number>(),
  selectedCategoryId: null,
  toggleEquipmentSelection: vi.fn(),
  selectAllEquipment: vi.fn(),
  deselectPageEquipment: vi.fn(),
  clearEquipmentSelection: vi.fn(),
  setSelectedCategory: vi.fn(),
  filters: {} as unknown as MappingContext["filters"],
  filterOptions: {
    departments: [],
    users: [],
    locations: [],
    fundingSources: [],
  },
  pagination: {} as unknown as MappingContext["pagination"],
  categorySearchTerm: "",
  setCategorySearchTerm: vi.fn(),
  linkEquipment: {} as unknown as MappingContext["linkEquipment"],
  isLoading: false,
  isLinking: false,
  refetch: vi.fn(),
  ...overrides,
})

describe("DeviceQuotaCategoryTree (mapping)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("links empty state CTA to categories page", () => {
    mockUseContext.mockReturnValue(makeContext())

    render(<DeviceQuotaCategoryTree />)

    const link = screen.getByRole("link", { name: "Tạo danh mục" })
    expect(link).toHaveAttribute("href", "/device-quota/categories")
  })

  it("shows no-results state when search has no matching categories", () => {
    mockUseContext.mockReturnValue(
      makeContext({
        allCategories: [
          {
            id: 1,
            parent_id: null,
            ma_nhom: "A",
            ten_nhom: "Alpha",
            phan_loai: null,
            level: 1,
            so_luong_hien_co: 0,
          },
        ],
        categories: [],
        categorySearchTerm: "zzzzz",
      })
    )

    render(<DeviceQuotaCategoryTree />)

    expect(screen.getByText("Không tìm thấy danh mục phù hợp")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Tạo danh mục" })).not.toBeInTheDocument()
  })

  it("uses shared search layout and preserves category search callback", () => {
    const setCategorySearchTerm = vi.fn()
    mockUseContext.mockReturnValue(
      makeContext({
        setCategorySearchTerm,
      })
    )

    render(<DeviceQuotaCategoryTree />)

    expect(screen.getByTestId("shared-category-filter-card")).toBeInTheDocument()

    fireEvent.change(screen.getByRole("textbox", { name: "Tìm danh mục..." }), {
      target: { value: "x-quang" },
    })

    expect(setCategorySearchTerm).toHaveBeenCalledWith("x-quang")
  })

  it("allows both parent and leaf categories to be selected as mapping targets", async () => {
    const user = userEvent.setup()
    const setSelectedCategory = vi.fn()
    const categories = [
      {
        id: 1,
        parent_id: null,
        ma_nhom: "G1",
        ten_nhom: "Nhóm chẩn đoán hình ảnh",
        phan_loai: "A",
        level: 1,
        so_luong_hien_co: 3,
      },
      {
        id: 2,
        parent_id: 1,
        ma_nhom: "G1.1",
        ten_nhom: "Máy X quang",
        phan_loai: "A",
        level: 2,
        so_luong_hien_co: 1,
      },
    ]
    mockUseContext.mockReturnValue(
      makeContext({
        categories,
        allCategories: categories,
        setSelectedCategory,
      })
    )

    render(<DeviceQuotaCategoryTree />)

    await user.click(screen.getByRole("button", { name: /G1\s*Nhóm chẩn đoán hình ảnh/i }))
    await user.click(screen.getByRole("button", { name: /G1\.1\s*Máy X quang/i }))

    expect(setSelectedCategory).toHaveBeenNthCalledWith(1, 1)
    expect(setSelectedCategory).toHaveBeenNthCalledWith(2, 2)
  })
})
