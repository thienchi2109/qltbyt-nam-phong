/**
 * equipment-toolbar.filters.test.tsx
 *
 * Tests that the equipment toolbar correctly uses the shared FacetedMultiSelectFilter
 * after migration, and that mobile/tablet filter sheet still triggers correctly.
 */

import * as React from "react"
import { describe, it, expect, vi } from "vitest"
import "@testing-library/jest-dom"
import { render, screen, fireEvent } from "@testing-library/react"
import type { Table } from "@tanstack/react-table"
import type { Equipment } from "@/types/database"

type DropdownStateProps = {
  open?: boolean
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>
}

type DropdownChildProps = DropdownStateProps & Record<string, unknown>

type DropdownWithChildrenProps = DropdownStateProps & {
  children: React.ReactNode
}

type PopoverStateProps = {
  open?: boolean
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>
}

type PopoverChildProps = PopoverStateProps & Record<string, unknown>

type PopoverWithChildrenProps = PopoverStateProps & {
  children: React.ReactNode
}

/**
 * Mock dynamic imports (QR scanner components) to avoid SSR issues in tests
 */
vi.mock("next/dynamic", () => ({
  default: () => () => null,
}))

/**
 * Mock radix DropdownMenu to render inline (no portal in jsdom)
 */
vi.mock("@/components/ui/dropdown-menu", () => {
  return {
    DropdownMenu: ({ children }: { children: React.ReactNode }) => {
      const [open, setOpen] = React.useState(false)
      return (
        <div data-testid="dropdown-menu">
          {React.Children.map(children, (child) =>
            React.isValidElement(child)
              ? React.cloneElement(child as React.ReactElement<DropdownChildProps>, {
                  open,
                  setOpen,
                })
              : child
          )}
        </div>
      )
    },
    DropdownMenuTrigger: ({
      children,
      asChild,
      open,
      setOpen,
      ...rest
    }: DropdownWithChildrenProps & { asChild?: boolean }) => {
      const toggleDropdownMenu = () => setOpen?.(!open)
      if (asChild && React.isValidElement(children)) {
        const childElement = children as React.ReactElement<{
          onClick?: (...args: unknown[]) => void
        }>
        return React.cloneElement(childElement, {
          ...rest,
          onClick: (...args: unknown[]) => {
            toggleDropdownMenu()
            childElement.props.onClick?.(...args)
          },
        })
      }
      return (
        <button {...rest} onClick={toggleDropdownMenu}>
          {children}
        </button>
      )
    },
    DropdownMenuContent: ({
      children,
      open,
      setOpen: _setOpen,
      ...rest
    }: DropdownWithChildrenProps) => {
      if (!open) return null
      return (
        <div data-testid="dropdown-content" {...rest}>
          {children}
        </div>
      )
    },
    DropdownMenuItem: ({
      children,
      onSelect,
      ...rest
    }: { children: React.ReactNode; onSelect?: () => void } & Record<string, unknown>) => (
      <button {...rest} onClick={onSelect}>
        {children}
      </button>
    ),
  }
})

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
    onClearFacilityFilter: vi.fn(),
  }

  it("keeps secondary faceted filters available through desktop overflow", () => {
    render(<EquipmentToolbar {...baseProps} />)

    expect(screen.getByText("Tình trạng")).toBeInTheDocument()
    expect(screen.getByText("Khoa/Phòng")).toBeInTheDocument()
    expect(screen.getByText("Phân loại")).toBeInTheDocument()
    expect(screen.queryByText("Người sử dụng")).not.toBeInTheDocument()
    expect(screen.queryByText("Nguồn kinh phí")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Bộ lọc/i }))

    expect(screen.getByText("Người sử dụng")).toBeInTheDocument()
    expect(screen.getByText("Nguồn kinh phí")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Người sử dụng User A/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Nguồn kinh phí Ngân sách/i })).toBeInTheDocument()
  })

  it("applies desktop overflow filter selections inline without nested filter popovers", () => {
    const { table, columns } = createMockTable()
    render(<EquipmentToolbar {...baseProps} table={table} />)

    fireEvent.click(screen.getByRole("button", { name: /Bộ lọc/i }))
    fireEvent.click(screen.getByRole("button", { name: /Người sử dụng User A/i }))

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
    expect(screen.getByRole("button", { name: /Bộ lọc/i })).toBeInTheDocument()

    expect(screen.queryByRole("button", { name: /Người sử dụng/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Nguồn kinh phí/i })).not.toBeInTheDocument()
  })

  it("marks the command filter row as an overflow-safe responsive layout", () => {
    render(<EquipmentToolbar {...baseProps} />)

    const row = screen.getByTestId("equipment-command-filter-row")
    expect(row).toHaveAttribute("data-layout", "command-overflow")
    expect(row.className).toContain("flex-wrap")
    expect(row.className).toContain("min-w-0")
  })

  it("renders mobile filter sheet trigger instead of faceted filters on mobile", () => {
    render(<EquipmentToolbar {...baseProps} filterMode="sheet" />)

    expect(screen.getByText("Lọc")).toBeInTheDocument()
    expect(screen.queryByText("Tình trạng")).not.toBeInTheDocument()
    expect(screen.queryByText("Khoa/Phòng")).not.toBeInTheDocument()
  })

  it("calls onOpenFilterSheet when mobile filter button is clicked", () => {
    const onOpenFilterSheet = vi.fn()
    render(
      <EquipmentToolbar {...baseProps} filterMode="sheet" onOpenFilterSheet={onOpenFilterSheet} />
    )

    fireEvent.click(screen.getByText("Lọc"))
    expect(onOpenFilterSheet).toHaveBeenCalled()
  })

  it("hides compact clear command when filters are inactive", () => {
    render(<EquipmentToolbar {...baseProps} />)

    expect(screen.queryByRole("button", { name: /^Xóa$/i })).not.toBeInTheDocument()
  })

  it("shows a compact clear command when desktop filters are active", () => {
    render(
      <EquipmentToolbar
        {...baseProps}
        filterState={{ ...baseProps.filterState, isFiltered: true }}
      />
    )

    const clearButton = screen.getByRole("button", { name: /^Xóa$/i })
    expect(clearButton).toBeInTheDocument()

    fireEvent.click(clearButton)
    expect(baseProps.table.resetColumnFilters).toHaveBeenCalled()
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
