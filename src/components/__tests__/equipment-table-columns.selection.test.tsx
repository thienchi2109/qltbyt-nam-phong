import * as React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import type { ColumnDef } from "@tanstack/react-table"
import { describe, expect, it, vi } from "vitest"

import { createEquipmentColumns } from "@/components/equipment/equipment-table-columns"
import { TooltipTestProvider } from "@/test-utils/tooltip-mock"
import type { Equipment } from "@/types/database"

vi.mock("@/components/ui/tooltip", async () => {
  const { tooltipMockModule } = await import("@/test-utils/tooltip-mock")
  return tooltipMockModule
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

    return render(
      <TooltipTestProvider>
        <div data-testid="equipment-cell">{node}</div>
      </TooltipTestProvider>
    )
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
