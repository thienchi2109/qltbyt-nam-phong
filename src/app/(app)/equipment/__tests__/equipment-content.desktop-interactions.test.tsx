import * as React from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { describe, expect, it, vi } from "vitest"

import { LinkedRequestProvider } from "@/components/equipment-linked-request"
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
    <LinkedRequestProvider>
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
    </LinkedRequestProvider>
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

  it("opens the linked request from the wrench icon without opening equipment details", async () => {
    const user = userEvent.setup()
    const equipment: Equipment = {
      id: 102,
      ma_thiet_bi: "TB-102",
      ten_thiet_bi: "Máy siêu âm",
      tinh_trang_hien_tai: "Chờ sửa chữa",
      active_repair_request_id: 9001,
    }
    const onShowDetails = vi.fn()

    render(<EquipmentContentHarness equipment={equipment} onShowDetails={onShowDetails} />)

    await user.click(screen.getByRole("button", {
      name: "Xem yêu cầu sửa chữa hiện tại của thiết bị TB-102",
    }))

    expect(onShowDetails).not.toHaveBeenCalled()

    await user.click(within(screen.getByRole("table")).getByText(equipment.ma_thiet_bi))
    expect(onShowDetails).toHaveBeenCalledWith(equipment)
  })
})
