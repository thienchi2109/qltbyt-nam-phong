/**
 * equipment-toolbar.filters.test.tsx
 *
 * Tests that the equipment toolbar correctly uses the shared FacetedMultiSelectFilter
 * after migration, and that mobile/tablet filter sheet still triggers correctly.
 */

import * as React from "react"
import { beforeAll, describe, it, expect, vi } from "vitest"
import "@testing-library/jest-dom"
import { render, screen, fireEvent, within } from "@testing-library/react"
import type { Table } from "@tanstack/react-table"
import type { Equipment } from "@/types/database"

type PopoverStateProps = {
  open?: boolean
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>
}

type PopoverChildProps = PopoverStateProps & Record<string, unknown>

type PopoverWithChildrenProps = PopoverStateProps & {
  children: React.ReactNode
}

class ResizeObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string): MediaQueryList => {
      return {
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      }
    }),
  })

  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    configurable: true,
    value: ResizeObserverMock,
  })

  Object.defineProperty(globalThis, "ResizeObserver", {
    writable: true,
    configurable: true,
    value: ResizeObserverMock,
  })
})

/**
 * Mock dynamic imports (QR scanner components) to avoid SSR issues in tests
 */
vi.mock("next/dynamic", () => ({
  default: () => () => null,
}))

/**
 * Mock radix Popover so overflow filter content renders inline in jsdom.
 */
vi.mock("@/components/ui/popover", () => {
  return {
    Popover: ({ children }: { children: React.ReactNode }) => {
      const [open, setOpen] = React.useState(false)
      return (
        <div data-testid="popover">
          {React.Children.map(children, (child) =>
            React.isValidElement(child)
              ? React.cloneElement(child as React.ReactElement<PopoverChildProps>, {
                  open,
                  setOpen,
                })
              : child
          )}
        </div>
      )
    },
    PopoverTrigger: ({
      children,
      asChild,
      open,
      setOpen,
      ...rest
    }: PopoverWithChildrenProps & { asChild?: boolean }) => {
      const togglePopover = () => setOpen?.(!open)
      if (asChild && React.isValidElement(children)) {
        const childElement = children as React.ReactElement<{
          onClick?: (...args: unknown[]) => void
        }>
        return React.cloneElement(childElement, {
          ...rest,
          onClick: (...args: unknown[]) => {
            togglePopover()
            childElement.props.onClick?.(...args)
          },
        })
      }
      return (
        <button {...rest} onClick={togglePopover}>
          {children}
        </button>
      )
    },
    PopoverContent: ({
      children,
      open,
      setOpen: _setOpen,
      ...rest
    }: PopoverWithChildrenProps & React.HTMLAttributes<HTMLDivElement>) => {
      if (!open) return null
      return (
        <div data-testid="popover-content" {...rest}>
          {children}
        </div>
      )
    },
  }
})

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

import { EquipmentToolbar } from "../equipment-toolbar"

function createMockTable(initialFilterValues: Record<string, string[] | undefined> = {}) {
  const columns = new Map<
    string,
    {
      getFilterValue: ReturnType<typeof vi.fn>
      setFilterValue: ReturnType<typeof vi.fn>
    }
  >()
  const table = {
    getColumn: vi.fn((id: string) => {
      if (!columns.has(id)) {
        columns.set(id, {
          getFilterValue: vi.fn(() => initialFilterValues[id]),
          setFilterValue: vi.fn(),
        })
      }
      return columns.get(id)
    }),
    resetColumnFilters: vi.fn(),
    getHeaderGroups: () => [],
    getRowModel: () => ({ rows: [] }),
    getAllColumns: () => [],
    getState: () => ({ columnFilters: [] }),
  }
  return {
    table: table as unknown as Table<Equipment>,
    columns,
  }
}

describe("EquipmentToolbar with shared filters", () => {
  const baseProps = {
    table: createMockTable().table,
    searchTerm: "",
    onSearchChange: vi.fn(),
    columnFilters: [],
    statuses: ["Hoạt động", "Hỏng"],
    departments: ["ICU", "Surgery"],
    users: ["User A"],
    classifications: ["Loại A"],
    fundingSources: ["Ngân sách"],
    filterMode: "faceted" as const,
    filterState: {
      isFiltered: false,
      hasFacilityFilter: false,
    },
    actionState: {
      canCreateEquipment: true,
      isExporting: false,
    },
    onOpenFilterSheet: vi.fn(),
    onOpenColumnsDialog: vi.fn(),
    onDownloadTemplate: vi.fn(),
    onExportData: vi.fn(),
    onAddEquipment: vi.fn(),
    onImportEquipment: vi.fn(),
  }

  it("renders all desktop faceted filters as direct command tokens", () => {
    render(<EquipmentToolbar {...baseProps} />)

    for (const label of [
      "Tình trạng",
      "Khoa/Phòng",
      "Phân loại",
      "Người sử dụng",
      "Nguồn kinh phí",
    ]) {
      const trigger = screen.getByRole("button", { name: new RegExp(label, "i") })
      expect(trigger).toHaveAttribute("data-trigger-variant", "command")
      expect(trigger).toHaveClass("hover:text-primary")
    }
    expect(screen.queryByRole("button", { name: /Bộ lọc/i })).not.toBeInTheDocument()
  })

  it("keeps secondary direct filters wired to their column ids", () => {
    const { table, columns } = createMockTable()
    render(<EquipmentToolbar {...baseProps} table={table} />)

    fireEvent.click(screen.getByRole("button", { name: /Người sử dụng/i }))
    fireEvent.click(screen.getByRole("button", { name: /User A/i }))

    expect(columns.get("nguoi_dang_truc_tiep_quan_ly")?.setFilterValue).toHaveBeenCalledWith([
      "User A",
    ])
  })

  it("renders desktop filters as command tokens with progressive overflow", () => {
    render(<EquipmentToolbar {...baseProps} />)

    expect(screen.getByRole("button", { name: /Tình trạng/i })).toHaveAttribute(
      "data-trigger-variant",
      "command"
    )
    expect(screen.getByRole("button", { name: /Khoa\/Phòng/i })).toHaveAttribute(
      "data-trigger-variant",
      "command"
    )
    expect(screen.getByRole("button", { name: /Phân loại/i })).toHaveAttribute(
      "data-trigger-variant",
      "command"
    )
    expect(screen.getByRole("button", { name: /Người sử dụng/i })).toHaveAttribute(
      "data-trigger-variant",
      "command"
    )
    expect(screen.getByRole("button", { name: /Nguồn kinh phí/i })).toHaveAttribute(
      "data-trigger-variant",
      "command"
    )
    expect(screen.queryByRole("button", { name: /Bộ lọc/i })).not.toBeInTheDocument()
  })

  it("marks the command filter row as an overflow-safe responsive layout", () => {
    render(<EquipmentToolbar {...baseProps} />)

    const row = screen.getByTestId("equipment-command-filter-row")
    expect(row).toHaveAttribute("data-layout", "equipment-reference")
    expect(row.className).toContain("grid")
    expect(row.className).toContain("min-w-0")
  })

  it("renders the desktop search and filters in the reference two-row layout", () => {
    render(<EquipmentToolbar {...baseProps} />)

    const layout = screen.getByTestId("equipment-reference-filter-layout")
    const search = screen.getByRole("searchbox", { name: "Tìm kiếm chung..." })

    expect(layout).toContainElement(search)

    for (const label of ["Tình trạng", "Khoa/Phòng", "Người sử dụng", "Phân loại"]) {
      const cell = screen.getByTestId(`equipment-reference-filter-${label}`)
      expect(cell).toHaveTextContent(label)
      expect(cell).toContainElement(screen.getByRole("button", { name: new RegExp(label, "i") }))
    }
  })

  it("places tenant control inside the desktop command filter row", () => {
    render(<EquipmentToolbar {...baseProps} tenantControl={<button type="button">Cơ sở</button>} />)

    const row = screen.getByTestId("equipment-command-filter-row")
    const tenantControl = screen.getByRole("button", { name: "Cơ sở" })
    const statusFilter = screen.getByRole("button", { name: /Tình trạng/i })

    expect(row).toContainElement(tenantControl)
    expect(tenantControl.compareDocumentPosition(statusFilter)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
  })

  it("renders mobile filter sheet trigger instead of faceted filters on mobile", () => {
    render(
      <EquipmentToolbar
        {...baseProps}
        filterMode="sheet"
        columnFilters={[{ id: "tinh_trang_hien_tai", value: ["Hoạt động", "Hỏng"] }]}
        filterState={{ ...baseProps.filterState, isFiltered: true }}
      />
    )

    const compactActions = screen.getByTestId("equipment-compact-filter-actions")
    const filterTrigger = within(compactActions).getByRole("button", { name: /Lọc\s*2/i })

    expect(compactActions).toHaveClass("grid", "w-full", "grid-cols-2", "gap-2")
    expect(filterTrigger).toHaveAttribute("data-testid", "equipment-heroui-compact-filter-trigger")
    expect(filterTrigger).toHaveClass("w-full")
    expect(filterTrigger).toHaveTextContent("2")
    expect(within(compactActions).getByRole("button", { name: /Tùy chọn/i })).toHaveClass("w-full")
    expect(screen.queryByText("Tình trạng")).not.toBeInTheDocument()
    expect(screen.queryByText("Khoa/Phòng")).not.toBeInTheDocument()
  })

  it("renders tenant control once in compact filter mode", () => {
    render(
      <EquipmentToolbar
        {...baseProps}
        filterMode="sheet"
        tenantControl={<button type="button">Cơ sở</button>}
      />
    )

    expect(screen.getAllByRole("button", { name: "Cơ sở" })).toHaveLength(1)
  })

  it("calls onOpenFilterSheet when mobile filter button is clicked", () => {
    const onOpenFilterSheet = vi.fn()
    render(
      <EquipmentToolbar {...baseProps} filterMode="sheet" onOpenFilterSheet={onOpenFilterSheet} />
    )

    fireEvent.click(screen.getByText("Lọc"))
    expect(onOpenFilterSheet).toHaveBeenCalled()
  })

  it("keeps compact options actions wired through the HeroUI dropdown", async () => {
    const onOpenColumnsDialog = vi.fn()
    const onDownloadTemplate = vi.fn()
    const onExportData = vi.fn()

    render(
      <EquipmentToolbar
        {...baseProps}
        filterMode="sheet"
        onOpenColumnsDialog={onOpenColumnsDialog}
        onDownloadTemplate={onDownloadTemplate}
        onExportData={onExportData}
      />
    )

    const compactActions = screen.getByTestId("equipment-compact-filter-actions")
    const openCompactOptions = () =>
      fireEvent.click(within(compactActions).getByRole("button", { name: /Tùy chọn/i }))

    openCompactOptions()
    expect(await screen.findByRole("menu", { name: "Tùy chọn" })).toBeInTheDocument()
    fireEvent.click(await screen.findByText("Hiện/ẩn cột"))
    openCompactOptions()
    fireEvent.click(await screen.findByText("Tải Excel mẫu"))
    openCompactOptions()
    fireEvent.click(await screen.findByText("Tải về dữ liệu"))

    expect(onOpenColumnsDialog).toHaveBeenCalledTimes(1)
    expect(onDownloadTemplate).toHaveBeenCalledTimes(1)
    expect(onExportData).toHaveBeenCalledTimes(1)
  })

  it("hides compact clear command when filters are inactive", () => {
    render(<EquipmentToolbar {...baseProps} />)

    expect(screen.queryByRole("button", { name: /^Xóa bộ lọc$/i })).not.toBeInTheDocument()
  })

  it("shows a simple inline clear command when desktop filters are active", () => {
    render(
      <EquipmentToolbar
        {...baseProps}
        columnFilters={[{ id: "tinh_trang_hien_tai", value: ["Hoạt động"] }]}
        filterState={{ ...baseProps.filterState, isFiltered: true }}
      />
    )

    const row = screen.getByTestId("equipment-command-filter-row")
    const clearButton = screen.getByTestId("equipment-clear-filters-control")

    expect(row).toContainElement(clearButton)
    expect(clearButton).toHaveTextContent("Xóa bộ lọc")
    expect(clearButton).toBeInTheDocument()

    fireEvent.click(clearButton)
    expect(baseProps.table.resetColumnFilters).toHaveBeenCalled()
  })

  it("keeps facility clear out of the desktop toolbar as a separate action", () => {
    render(
      <EquipmentToolbar
        {...baseProps}
        filterState={{ ...baseProps.filterState, hasFacilityFilter: true }}
      />
    )

    expect(screen.queryByRole("button", { name: /^Xóa lọc cơ sở$/i })).not.toBeInTheDocument()
  })

  it("hides add actions when create permission is disabled", () => {
    render(
      <EquipmentToolbar
        {...baseProps}
        actionState={{ ...baseProps.actionState, canCreateEquipment: false }}
      />
    )

    expect(screen.queryByText("Thêm thiết bị")).not.toBeInTheDocument()
  })

  it("places selection actions immediately before the add equipment button", () => {
    render(
      <EquipmentToolbar
        {...baseProps}
        selectionActions={<div data-testid="toolbar-selection-actions">Đã chọn 1 thiết bị</div>}
      />
    )

    const selectionActions = screen.getByTestId("toolbar-selection-actions")
    const addButton = screen.getByRole("button", { name: /Thêm thiết bị/i })

    expect(selectionActions.compareDocumentPosition(addButton)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
  })
})
