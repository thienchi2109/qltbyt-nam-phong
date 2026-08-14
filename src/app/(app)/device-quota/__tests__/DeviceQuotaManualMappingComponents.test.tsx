import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { DeviceQuotaManualMappingEquipmentList } from "../_components/manual-mapping/DeviceQuotaManualMappingEquipmentList"
import { DeviceQuotaManualMappingPreviewTrigger } from "../_components/manual-mapping/DeviceQuotaManualMappingPreviewTrigger"
import type { ListFilterSearchCardProps } from "@/components/shared/ListFilterSearchCard"
import type { FacetedMultiSelectFilterProps } from "@/components/shared/table-filters/FacetedMultiSelectFilter"

vi.mock("@/components/shared/ListFilterSearchCard", () => ({
  ListFilterSearchCard: ({
    searchValue,
    onSearchChange,
    searchPlaceholder,
    searchDisabled,
    filterControls,
  }: ListFilterSearchCardProps) => (
    <section>
      {typeof searchPlaceholder === "string" && typeof onSearchChange === "function" ? (
        <input
          aria-label={searchPlaceholder}
          defaultValue={searchValue}
          disabled={searchDisabled}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      ) : null}
      {filterControls}
    </section>
  ),
}))

vi.mock("@/components/shared/table-filters/FacetedMultiSelectFilter", () => ({
  FacetedMultiSelectFilter: <TData, TValue>({
    title,
    options,
    value,
    onChange,
  }: FacetedMultiSelectFilterProps<TData, TValue>) => (
    <button
      type="button"
      onClick={() => onChange([...(value ?? []), options[0]?.value as TValue].filter(Boolean))}
    >
      {title}
    </button>
  ),
}))

vi.mock("@/components/shared/DataTablePagination/DataTablePaginationSizeSelector", () => ({
  DataTablePaginationSizeSelector: ({
    onPageSizeChange,
  }: {
    onPageSizeChange: (size: number) => void
  }) => (
    <button type="button" onClick={() => onPageSizeChange(50)}>
      Hiển thị 50
    </button>
  ),
}))

vi.mock("@/components/shared/DataTablePagination/DataTablePaginationNavigation", () => ({
  DataTablePaginationNavigation: ({ onNextPage }: { onNextPage: () => void }) => (
    <button type="button" onClick={onNextPage}>
      Trang sau
    </button>
  ),
}))

const equipment = [
  {
    id: 10,
    ma_thiet_bi: "TB-010",
    ten_thiet_bi: "Máy thở",
    model: "MT-01",
    serial: "SER-01",
    hang_san_xuat: null,
    khoa_phong_quan_ly: "Khoa hồi sức",
    tinh_trang: null,
  },
  {
    id: 11,
    ma_thiet_bi: "TB-011",
    ten_thiet_bi: "Máy monitor",
    model: "MM-01",
    serial: "SER-02",
    hang_san_xuat: null,
    khoa_phong_quan_ly: "Khoa hồi sức",
    tinh_trang: null,
  },
]

type EquipmentListProps = React.ComponentProps<typeof DeviceQuotaManualMappingEquipmentList>

function createEquipmentListProps(overrides: Partial<EquipmentListProps> = {}): EquipmentListProps {
  return {
    unassignedEquipment: equipment,
    totalEquipmentCount: 40,
    selectedEquipmentIds: new Set([10]),
    toggleEquipmentSelection: vi.fn(),
    selectAllEquipment: vi.fn(),
    deselectPageEquipment: vi.fn(),
    filters: {
      searchTerm: "",
      setSearchTerm: vi.fn(),
      debouncedSearch: "",
      selectedDepartments: [],
      setSelectedDepartments: vi.fn(),
      selectedUsers: [],
      setSelectedUsers: vi.fn(),
      selectedLocations: [],
      setSelectedLocations: vi.fn(),
      selectedFundingSources: [],
      setSelectedFundingSources: vi.fn(),
      activeFilterCount: 0,
      hasActiveFilters: false,
      resetAllFilters: vi.fn(),
    },
    filterOptions: {
      departments: ["Khoa hồi sức"],
      users: [],
      locations: [],
      fundingSources: [],
    },
    pagination: {
      pagination: { pageIndex: 0, pageSize: 20 },
      pageCount: 2,
      canPreviousPage: false,
      canNextPage: true,
      setPagination: vi.fn(),
    },
    isLoading: false,
    isFacilitySelected: true,
    ...overrides,
  }
}

describe("route-agnostic manual mapping components", () => {
  it("drives filters, pagination, row selection, and page-only selection through props", async () => {
    const user = userEvent.setup()
    const setSearchTerm = vi.fn()
    const setSelectedDepartments = vi.fn()
    const toggleEquipmentSelection = vi.fn()
    const selectAllEquipment = vi.fn()
    const deselectPageEquipment = vi.fn()
    const setPagination = vi.fn()

    const props = createEquipmentListProps({
      toggleEquipmentSelection,
      selectAllEquipment,
      deselectPageEquipment,
      filters: {
        ...createEquipmentListProps().filters,
        setSearchTerm,
        setSelectedDepartments,
      },
      pagination: {
        ...createEquipmentListProps().pagination,
        setPagination,
      },
    })

    const { rerender } = render(<DeviceQuotaManualMappingEquipmentList {...props} />)

    await user.type(screen.getByRole("textbox", { name: "Tìm kiếm thiết bị..." }), "máy thở")
    await user.click(screen.getByRole("button", { name: "Khoa/Phòng" }))
    await user.click(screen.getByRole("button", { name: /Máy monitor/i }))
    await user.click(screen.getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: "Trang sau" }))
    await user.click(screen.getByRole("button", { name: "Hiển thị 50" }))

    expect(setSearchTerm).toHaveBeenLastCalledWith("máy thở")
    expect(setSelectedDepartments).toHaveBeenCalledWith(["Khoa hồi sức"])
    expect(toggleEquipmentSelection).toHaveBeenCalledWith(11)
    expect(selectAllEquipment).toHaveBeenCalledTimes(1)
    expect(setPagination).toHaveBeenCalledWith(expect.any(Function))
    expect(setPagination).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 50 })

    rerender(
      <DeviceQuotaManualMappingEquipmentList {...props} selectedEquipmentIds={new Set([10, 11])} />
    )
    await user.click(screen.getByRole("checkbox"))

    expect(deselectPageEquipment).toHaveBeenCalledTimes(1)
  })

  it("shows the facility-selection state and disables search until a facility is selected", () => {
    render(
      <DeviceQuotaManualMappingEquipmentList
        {...createEquipmentListProps({
          unassignedEquipment: [],
          totalEquipmentCount: 0,
          isFacilitySelected: false,
        })}
      />
    )

    expect(screen.getByRole("textbox", { name: "Chọn cơ sở để tìm kiếm..." })).toBeDisabled()
    expect(screen.getByText("Chọn cơ sở")).toBeInTheDocument()
    expect(
      screen.queryByText("Tất cả thiết bị đã được phân loại vào các nhóm định mức.")
    ).not.toBeInTheDocument()
  })

  it("distinguishes filtered-empty results from the completed assignment state", () => {
    const { rerender } = render(
      <DeviceQuotaManualMappingEquipmentList
        {...createEquipmentListProps({
          unassignedEquipment: [],
          totalEquipmentCount: 0,
          filters: {
            ...createEquipmentListProps().filters,
            debouncedSearch: "zzz",
          },
        })}
      />
    )

    expect(screen.getByText("Không có kết quả phù hợp")).toBeInTheDocument()
    expect(screen.queryByText("Hoàn thành phân loại")).not.toBeInTheDocument()

    rerender(
      <DeviceQuotaManualMappingEquipmentList
        {...createEquipmentListProps({
          unassignedEquipment: [],
          totalEquipmentCount: 0,
        })}
      />
    )

    expect(screen.getByText("Hoàn thành phân loại")).toBeInTheDocument()
  })

  it("exposes each equipment row as one keyboard-toggle button", async () => {
    const user = userEvent.setup()
    const toggleEquipmentSelection = vi.fn()

    render(
      <DeviceQuotaManualMappingEquipmentList
        {...createEquipmentListProps({
          unassignedEquipment: [equipment[0]],
          totalEquipmentCount: 1,
          selectedEquipmentIds: new Set(),
          toggleEquipmentSelection,
        })}
      />
    )

    const rowButton = screen.getByRole("button", { name: /Máy thở/i })
    expect(rowButton).toHaveAttribute("aria-pressed", "false")
    expect(screen.getAllByRole("checkbox")).toHaveLength(1)

    await user.click(rowButton)

    expect(toggleEquipmentSelection).toHaveBeenCalledWith(10)
  })

  it("opens the manual preview through an explicit callback", async () => {
    const user = userEvent.setup()
    const onOpenPreview = vi.fn()

    render(
      <DeviceQuotaManualMappingPreviewTrigger
        canOpenPreview
        isLinking={false}
        onOpenPreview={onOpenPreview}
      />
    )

    await user.click(screen.getByRole("button", { name: "Phân loại" }))

    expect(onOpenPreview).toHaveBeenCalledTimes(1)
  })
})
