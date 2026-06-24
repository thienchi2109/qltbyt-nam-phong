import * as React from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { describe, expect, it, vi } from "vitest"

import { LinkedRequestProvider } from "@/components/equipment-linked-request"
import { createEquipmentColumns } from "@/components/equipment/equipment-table-columns"
import type { DepartmentColorClasses } from "@/components/equipment/equipment-department-grouping"
import type { Equipment } from "@/types/database"
import { EquipmentContent } from "../equipment-content"

vi.mock("@/components/ui/tooltip", async () => {
  const { tooltipMockModule } = await import("@/test-utils/tooltip-mock-module")
  return tooltipMockModule
})

function EquipmentContentHarness({
  equipment,
  onShowDetails,
  departmentColorClassByLabel,
}: {
  equipment: Equipment
  onShowDetails: (equipment: Equipment) => void
  departmentColorClassByLabel?: Record<string, DepartmentColorClasses>
}) {
  const columns = React.useMemo(
    () =>
      createEquipmentColumns({
        renderActions: () => null,
        departmentColorClassByLabel,
      }),
    [departmentColorClassByLabel]
  )

  const rowColorClassByLabel = React.useMemo(
    () =>
      Object.fromEntries(
        Object.entries(departmentColorClassByLabel ?? {}).map(([label, colors]) => [
          label,
          colors.rowClassName,
        ])
      ),
    [departmentColorClassByLabel]
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
        departmentColorClassByLabel={rowColorClassByLabel}
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

  it("applies subtle department color classes to desktop rows", () => {
    const equipment: Equipment = {
      id: 303,
      ma_thiet_bi: "TB-303",
      ten_thiet_bi: "Bơm tiêm điện",
      khoa_phong_quan_ly: "Khoa Ngoại",
      tinh_trang_hien_tai: "Hoạt động",
    }

    render(
      <EquipmentContentHarness
        equipment={equipment}
        onShowDetails={vi.fn()}
        departmentColorClassByLabel={{
          "Khoa Ngoại": {
            rowClassName: "bg-sky-50/60 hover:bg-sky-50",
            chipClassName: "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100",
            badgeClassName: "border-sky-200 bg-sky-100 text-sky-800",
          },
        }}
      />
    )

    expect(screen.getByRole("row", { name: /TB-303/ })).toHaveClass("bg-sky-50/60")
  })

  it("renders missing managing departments with the normalized department badge", () => {
    const equipment: Equipment = {
      id: 304,
      ma_thiet_bi: "TB-304",
      ten_thiet_bi: "Máy thở",
      khoa_phong_quan_ly: "",
      tinh_trang_hien_tai: "Hoạt động",
    }

    render(
      <EquipmentContentHarness
        equipment={equipment}
        onShowDetails={vi.fn()}
        departmentColorClassByLabel={{
          "Chưa cập nhật": {
            rowClassName: "bg-slate-50/70 hover:bg-slate-100/70",
            chipClassName: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
            badgeClassName: "border-slate-200 bg-slate-100 text-slate-700",
          },
        }}
      />
    )

    expect(screen.getByText("Chưa cập nhật")).toHaveClass("border-slate-200")
  })
})
