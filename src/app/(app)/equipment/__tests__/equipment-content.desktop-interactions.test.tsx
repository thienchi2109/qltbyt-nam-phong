import * as React from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { describe, expect, it, vi } from "vitest"

import { createEquipmentColumns } from "@/components/equipment/equipment-table-columns"
import type { Equipment } from "@/types/database"
import { EquipmentContent } from "../equipment-content"

vi.mock("@/components/ui/tooltip", async () => {
  const { tooltipMockModule } = await import("@/test-utils/tooltip-mock")
  return tooltipMockModule
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
