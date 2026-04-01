import * as React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import type { ColumnDef } from "@tanstack/react-table"
import { describe, expect, it, vi } from "vitest"

import { createEquipmentColumns } from "@/components/equipment/equipment-table-columns"
import type { Equipment } from "@/types/database"

vi.mock("@/components/ui/tooltip", () => {
  const TooltipContext = React.createContext<
    { open: boolean; setOpen: (open: boolean) => void } | null
  >(null)

  const TooltipProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>

  const Tooltip = ({ children }: { children: React.ReactNode }) => {
    const [open, setOpen] = React.useState(false)

    return <TooltipContext.Provider value={{ open, setOpen }}>{children}</TooltipContext.Provider>
  }

  const TooltipTrigger = React.forwardRef<
    HTMLSpanElement,
    React.HTMLAttributes<HTMLSpanElement> & { asChild?: boolean }
  >(({ asChild, children, onBlur, onFocus, onMouseEnter, onMouseLeave, ...props }, ref) => {
    const context = React.useContext(TooltipContext)
    const child = React.Children.only(children) as React.ReactElement

    const handleOpen = (handler?: React.EventHandler<React.SyntheticEvent>) => {
      return (event: React.SyntheticEvent) => {
        handler?.(event)
        context?.setOpen(true)
      }
    }

    const handleClose = (handler?: React.EventHandler<React.SyntheticEvent>) => {
      return (event: React.SyntheticEvent) => {
        handler?.(event)
        context?.setOpen(false)
      }
    }

    const triggerProps = {
      ...props,
      ref,
      "data-tooltip-trigger": true,
      onMouseEnter: handleOpen(onMouseEnter),
      onFocus: handleOpen(onFocus),
      onMouseLeave: handleClose(onMouseLeave),
      onBlur: handleClose(onBlur),
    }

    if (asChild && React.isValidElement(child)) {
      return React.cloneElement(child, triggerProps)
    }

    return <span {...triggerProps}>{children}</span>
  })

  const TooltipContent = ({ children }: { children: React.ReactNode }) => {
    const context = React.useContext(TooltipContext)
    if (!context?.open) return null

    return <div role="tooltip">{children}</div>
  }

  return {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  }
})

describe("createEquipmentColumns bulk selection config", () => {
  const renderActions = vi.fn((_equipment: Equipment) => null)
  type EquipmentCellContext = Parameters<NonNullable<ColumnDef<Equipment>["cell"]>>[0]

  function renderCell(columnKey: keyof Equipment, value: string) {
    const columns = createEquipmentColumns({
      renderActions,
    })

    const column = columns.find((candidate) => candidate.accessorKey === columnKey)
    expect(column).toBeDefined()
    const cell = (column as NonNullable<typeof column>).cell
    expect(cell).toBeDefined()

    const node = cell?.({
      row: {
        getValue: (key: keyof Equipment) => (key === columnKey ? value : undefined),
      },
    } as EquipmentCellContext)

    return render(<div data-testid="equipment-cell">{node}</div>)
  }

  it("prepends selection column when canBulkSelect=true", () => {
    const columns = createEquipmentColumns({
      renderActions,
      canBulkSelect: true,
    })

    expect(columns[0]?.id).toBe("select")
    expect(columns[1]?.accessorKey).toBe("id")
    expect(columns[columns.length - 1]?.id).toBe("actions")
  })

  it("keeps data columns first when canBulkSelect is omitted", () => {
    const columns = createEquipmentColumns({
      renderActions,
    })

    expect(columns[0]?.id).not.toBe("select")
    expect(columns[0]?.accessorKey).toBe("id")
    expect(columns[columns.length - 1]?.id).toBe("actions")
  })

  it("formats ngay_ngung_su_dung as DD/MM/YYYY", () => {
    renderCell("ngay_ngung_su_dung", "2024-12-31")
    expect(screen.getByText("31/12/2024")).toBeInTheDocument()
  })

  it.each([
    {
      columnKey: "ma_thiet_bi" as const,
      value: "TB-2024-ALPHA-9000-EXTREMELY-LONG-CODE",
      expectedWidthClass: "max-w-[10rem]",
    },
    {
      columnKey: "ten_thiet_bi" as const,
      value: "Máy X-quang KTS Discovery XR656 với bộ mô tả rất dài",
      expectedWidthClass: "max-w-[18rem]",
    },
  ])(
    "renders $columnKey as single-line truncated text with explicit tooltip support",
    ({ columnKey, value, expectedWidthClass }) => {
      renderCell(columnKey, value)
      const text = screen.getAllByText(value)[0] as HTMLElement

      expect(text.className).toContain("block")
      expect(text.className).toContain("truncate")
      expect(text.className).toContain("cursor-default")
      expect(text.className).toContain(expectedWidthClass)
      expect(text).toHaveAttribute("tabindex", "0")

      fireEvent.mouseEnter(text)
      fireEvent.focus(text)

      expect(screen.getByRole("tooltip")).toHaveTextContent(value)
    }
  )
})
