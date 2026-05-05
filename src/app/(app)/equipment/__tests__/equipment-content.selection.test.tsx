/**
 * Regression-lock test: multi-selection invariants ở Equipment data grid
 * khi `canBulkSelect=true` (áp dụng cho role admin/global/to_qltb).
 *
 * Bug báo cáo (prod): Với role admin/global, user không tick chọn được từng
 * hàng; click nhiều lần thì data grid "tự chọn tất cả" trong page scope.
 * Role to_qltb thì tick chọn bình thường.
 *
 * Các invariant cần giữ (áp dụng cho mọi role khi canBulkSelect=true):
 *   1. Click checkbox của 1 row → CHỈ row đó được chọn/bỏ chọn; KHÔNG
 *      trigger select-all page.
 *   2. Click liên tiếp vào cùng 1 checkbox → selection chỉ toggle row đó
 *      (0 ↔ 1), không "drift" sang các row khác.
 *   3. Click checkbox row không được gọi `onShowDetails` (stopPropagation).
 *   4. Khi parent container re-render với prop đổi (mô phỏng luồng
 *      global/admin, nơi isFetching/data/selectedFacilityId hay đổi giữa
 *      các click), rowSelection đã chọn PHẢI được bảo toàn.
 *
 * Các scenario 1–3 là ràng buộc căn bản. Scenario 4 đặc biệt nhắm đến cơ
 * chế reset selection trong `useEquipmentTable` (reset theo
 * pageIndex/pageSize/sorting/filterKey) có thể kích hoạt sai trong luồng
 * global/admin.
 */

import * as React from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type RowSelectionState,
} from "@tanstack/react-table"
import { describe, expect, it, vi } from "vitest"

import { LinkedRequestProvider } from "@/components/equipment-linked-request"
import { createEquipmentColumns } from "@/components/equipment/equipment-table-columns"
import type { Equipment } from "@/types/database"
import { EquipmentContent } from "../equipment-content"

vi.mock("@/components/ui/tooltip", async () => {
  const { tooltipMockModule } = await import("@/test-utils/tooltip-mock")
  return tooltipMockModule
})

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

function makeEquipment(id: number, overrides: Partial<Equipment> = {}): Equipment {
  return {
    id,
    ma_thiet_bi: `TB-${id}`,
    ten_thiet_bi: `Thiết bị ${id}`,
    tinh_trang_hien_tai: "Hoạt động",
    ...overrides,
  }
}

interface HarnessProps {
  data: Equipment[]
  onShowDetails?: (equipment: Equipment) => void
  /**
   * Mô phỏng parent re-render đổi ref giữa các lần click (luồng
   * global/admin: selectedFacilityId/isFetching/... thay đổi). Tăng giá
   * trị này giữa các assertion để kích hoạt parent re-render.
   */
  externalTick?: number
  /**
   * Emulate `canBulkSelect=true` (role admin/global/to_qltb).
   */
  canBulkSelect?: boolean
}

function EquipmentSelectionHarness({
  data,
  onShowDetails = vi.fn(),
  externalTick = 0,
  canBulkSelect = true,
}: HarnessProps) {
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  const columns = React.useMemo(
    () =>
      createEquipmentColumns({
        renderActions: () => null,
        canBulkSelect,
      }),
    [canBulkSelect],
  )

  const table = useReactTable({
    data,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    getRowId: (row) => String(row.id),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <LinkedRequestProvider>
      {/* externalTick được render để ép parent re-render khi prop đổi */}
      <span data-testid="external-tick" hidden>
        {externalTick}
      </span>
      <EquipmentContent
        isGlobal={true}
        isRegionalLeader={false}
        shouldFetchEquipment={true}
        isLoading={false}
        isFetching={externalTick % 2 === 1}
        isCardView={false}
        table={table}
        columns={columns}
        onShowDetails={onShowDetails}
      />
      <output data-testid="selected-ids">
        {table
          .getFilteredSelectedRowModel()
          .rows.map((row) => row.original.id)
          .join(",")}
      </output>
      <output data-testid="selected-count">
        {table.getFilteredSelectedRowModel().rows.length}
      </output>
    </LinkedRequestProvider>
  )
}

function getRowCheckbox(rowId: number) {
  const row = screen.getByRole("row", { name: new RegExp(`TB-${rowId}`) })
  return within(row).getByRole("checkbox", { name: "Chọn dòng" })
}

describe("EquipmentContent multi-selection (canBulkSelect=true / admin+global)", () => {
  it("toggling a single row checkbox only affects that row", () => {
    const data = [makeEquipment(101), makeEquipment(202), makeEquipment(303)]
    render(<EquipmentSelectionHarness data={data} />)

    fireEvent.click(getRowCheckbox(202))

    expect(screen.getByTestId("selected-ids")).toHaveTextContent("202")
    expect(screen.getByTestId("selected-count")).toHaveTextContent("1")
  })

  it("clicking the same row checkbox repeatedly never auto-selects other rows", () => {
    const data = [makeEquipment(101), makeEquipment(202), makeEquipment(303)]
    render(<EquipmentSelectionHarness data={data} />)

    const checkbox = getRowCheckbox(101)

    fireEvent.click(checkbox) // select
    expect(screen.getByTestId("selected-ids")).toHaveTextContent("101")
    expect(screen.getByTestId("selected-count")).toHaveTextContent("1")

    fireEvent.click(checkbox) // deselect
    expect(screen.getByTestId("selected-ids")).toHaveTextContent("")
    expect(screen.getByTestId("selected-count")).toHaveTextContent("0")

    fireEvent.click(checkbox) // select
    fireEvent.click(checkbox) // deselect
    fireEvent.click(checkbox) // select

    // After odd number of clicks on the SAME row: exactly that row selected.
    // Bug repro target: "click nhiều lần tự chọn tất cả" would set count to 3.
    expect(screen.getByTestId("selected-ids")).toHaveTextContent("101")
    expect(screen.getByTestId("selected-count")).toHaveTextContent("1")
  })

  it("row checkbox click does not bubble to row onClick (no detail dialog)", () => {
    const data = [makeEquipment(101)]
    const onShowDetails = vi.fn()
    render(
      <EquipmentSelectionHarness data={data} onShowDetails={onShowDetails} />,
    )

    fireEvent.click(getRowCheckbox(101))

    expect(onShowDetails).not.toHaveBeenCalled()
    expect(screen.getByTestId("selected-count")).toHaveTextContent("1")
  })

  it("selection is preserved across admin-like parent re-renders", () => {
    const data = [makeEquipment(101), makeEquipment(202), makeEquipment(303)]

    const { rerender } = render(
      <EquipmentSelectionHarness data={data} externalTick={0} />,
    )

    fireEvent.click(getRowCheckbox(202))
    expect(screen.getByTestId("selected-ids")).toHaveTextContent("202")

    // Simulate admin-only re-renders (e.g. isFetching toggling from
    // background refetch, or selectedFacilityId reference churn).
    for (let tick = 1; tick <= 4; tick++) {
      rerender(<EquipmentSelectionHarness data={data} externalTick={tick} />)
    }

    // Selection must survive purely presentational parent re-renders.
    expect(screen.getByTestId("selected-ids")).toHaveTextContent("202")
    expect(screen.getByTestId("selected-count")).toHaveTextContent("1")
  })

  it("selecting multiple distinct rows keeps only those rows selected", () => {
    const data = [
      makeEquipment(101),
      makeEquipment(202),
      makeEquipment(303),
      makeEquipment(404),
    ]
    render(<EquipmentSelectionHarness data={data} />)

    fireEvent.click(getRowCheckbox(101))
    fireEvent.click(getRowCheckbox(303))

    const selected = screen.getByTestId("selected-ids").textContent ?? ""
    expect(selected.split(",").sort()).toEqual(["101", "303"])
    expect(screen.getByTestId("selected-count")).toHaveTextContent("2")
  })
})
