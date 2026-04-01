import * as React from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { describe, expect, it, vi } from "vitest"

import { createEquipmentColumns } from "@/components/equipment/equipment-table-columns"
import type { Equipment } from "@/types/database"
import { EquipmentContent } from "../equipment-content"

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

function EquipmentContentHarness({
  equipment,
  onShowDetails,
}: {
  equipment: Equipment
  onShowDetails: (equipment: Equipment) => void
}) {
  const columns = React.useMemo(
    () =>
      createEquipmentColumns({
        renderActions: () => null,
      }),
    []
  )

  const table = useReactTable({
    data: [equipment],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <EquipmentContent
      isGlobal={false}
      isRegionalLeader={false}
      shouldFetchEquipment={true}
      isLoading={false}
      isFetching={false}
      isCardView={false}
      table={table}
      columns={columns}
      onShowDetails={onShowDetails}
    />
  )
}

describe("EquipmentContent desktop interactions", () => {
  it("keeps row clicks working from truncated text while exposing tooltip text on hover and focus", () => {
    const equipment: Equipment = {
      id: 101,
      ma_thiet_bi: "TB-2024-ALPHA-9000-EXTREMELY-LONG-CODE",
      ten_thiet_bi: "Máy X-quang KTS Discovery XR656 với bộ mô tả rất dài",
      tinh_trang_hien_tai: "Hoạt động",
    }
    const onShowDetails = vi.fn()

    render(<EquipmentContentHarness equipment={equipment} onShowDetails={onShowDetails} />)

    const table = screen.getByRole("table")
    const codeCell = within(table).getByText(equipment.ma_thiet_bi) as HTMLElement
    const nameCell = within(table).getByText(equipment.ten_thiet_bi) as HTMLElement

    expect(codeCell).toHaveAttribute("tabindex", "0")
    expect(nameCell).toHaveAttribute("tabindex", "0")

    fireEvent.click(codeCell)
    expect(onShowDetails).toHaveBeenCalledTimes(1)
    expect(onShowDetails).toHaveBeenCalledWith(equipment)

    fireEvent.mouseEnter(codeCell)
    fireEvent.focus(codeCell)
    expect(screen.getByRole("tooltip")).toHaveTextContent(equipment.ma_thiet_bi)

    fireEvent.mouseLeave(codeCell)
    fireEvent.blur(codeCell)

    fireEvent.mouseEnter(nameCell)
    fireEvent.focus(nameCell)
    expect(screen.getByRole("tooltip")).toHaveTextContent(equipment.ten_thiet_bi)
  })
})
