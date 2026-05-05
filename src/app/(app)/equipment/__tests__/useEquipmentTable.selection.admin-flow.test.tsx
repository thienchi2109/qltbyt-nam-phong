/**
 * Regression-lock test: multi-selection invariants ở `useEquipmentTable`
 * hook khi chạy trong luồng admin/global (có `selectedFacilityId`).
 *
 * Bug báo cáo (prod):
 *   - Role admin/global: tick chọn không phản hồi; click nhiều lần → tự
 *     chọn tất cả trong page.
 *   - Role to_qltb: tick chọn bình thường.
 *
 * Khác biệt giữa 2 role ở tầng này:
 *   - to_qltb: `selectedFacilityId === undefined` cố định, `selectedDonVi`
 *     cố định → `filterKey` trong useEquipmentTable ổn định → effect
 *     `setRowSelection({})` không re-fire ngoài ý muốn.
 *   - admin/global: `selectedFacilityId` đổi theo TenantSelector. Nếu bất
 *     kỳ re-render admin-only nào làm ref của filterKey deps nhích →
 *     selection bị reset ngay sau khi user tick.
 *
 * Các invariant cần giữ (áp dụng cho admin/global):
 *   1. Click 1 row checkbox với `selectedFacilityId=number` ổn định → row
 *      đó được chọn, tổng selection = 1, KHÔNG select-all page.
 *   2. Parent re-render (isFetching toggle, data ref đổi) giữa các click
 *      không làm mất selection đã chọn trước đó.
 *   3. Khi admin chuyển facility (`selectedFacilityId` đổi value), việc
 *      reset selection là mong muốn. Nhưng nếu `selectedFacilityId` giữ
 *      nguyên value (chỉ ref đổi), selection phải được giữ.
 */

import * as React from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import type { ColumnDef } from "@tanstack/react-table"
import { flexRender } from "@tanstack/react-table"
import { describe, expect, it, vi } from "vitest"

import { useEquipmentTable } from "../_hooks/useEquipmentTable"
import { createSelectionColumn } from "@/components/ui/data-table-selection"
import type { Equipment } from "@/types/database"

vi.mock("@/hooks/use-media-query", () => ({
  useMediaQuery: () => false,
}))

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}))

function makeEquipment(id: number): Equipment {
  return {
    id,
    ma_thiet_bi: `TB-${id}`,
    ten_thiet_bi: `Thiết bị ${id}`,
    tinh_trang_hien_tai: "Hoạt động",
  }
}

const ROWS: Equipment[] = [
  makeEquipment(101),
  makeEquipment(202),
  makeEquipment(303),
]

interface HarnessProps {
  /**
   * Admin/global: number (facility đã chọn).
   * to_qltb: undefined (không đổi).
   */
  selectedFacilityId: number | null | undefined
  /**
   * Mô phỏng parent re-render giữa các click (admin thường gặp:
   * isFetching toggle, activeUsageLogs refetch, branding load xong).
   */
  tick: number
}

function AdminTableHarness({ selectedFacilityId, tick }: HarnessProps) {
  // Parent state do `useEquipmentPage` giữ
  const [sorting, setSorting] = React.useState([])
  const [columnFilters, setColumnFilters] = React.useState([])
  const [searchTerm, setSearchTerm] = React.useState("")
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 20 })

  // Columns: chỉ cần selection + 1 data column cho test
  const columns = React.useMemo<ColumnDef<Equipment>[]>(
    () => [
      createSelectionColumn<Equipment>(),
      {
        accessorKey: "ma_thiet_bi",
        header: "Mã TB",
        cell: ({ row }) => <span>{row.original.ma_thiet_bi}</span>,
      },
    ],
    [],
  )

  // Admin scenario: selectedDonVi === selectedFacilityId khi showSelector
  const selectedDonVi =
    typeof selectedFacilityId === "number" ? selectedFacilityId : null

  const { table } = useEquipmentTable({
    data: ROWS,
    total: ROWS.length,
    columns,
    sorting,
    setSorting,
    columnFilters,
    setColumnFilters,
    debouncedSearch: searchTerm,
    setSearchTerm,
    pagination,
    setPagination,
    selectedDonVi,
    selectedFacilityId,
  })

  return (
    <div>
      <span data-testid="tick" hidden>
        {tick}
      </span>
      <table>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id}>
                  {h.isPlaceholder
                    ? null
                    : flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              aria-label={row.original.ma_thiet_bi}
              onClick={() => {
                // mimic EquipmentContent: open detail on row click
              }}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <output data-testid="selected-ids">
        {table
          .getFilteredSelectedRowModel()
          .rows.map((r) => r.original.id)
          .join(",")}
      </output>
      <output data-testid="selected-count">
        {table.getFilteredSelectedRowModel().rows.length}
      </output>
    </div>
  )
}

function getRowCheckbox(code: string) {
  const row = screen.getByRole("row", { name: code })
  return within(row).getByRole("checkbox", { name: "Chọn dòng" })
}

describe("useEquipmentTable selection with admin/global facility flow", () => {
  it("click 1 row checkbox with stable facility selection → only that row is selected", () => {
    render(<AdminTableHarness selectedFacilityId={5} tick={0} />)

    fireEvent.click(getRowCheckbox("TB-202"))

    expect(screen.getByTestId("selected-ids")).toHaveTextContent("202")
    expect(screen.getByTestId("selected-count")).toHaveTextContent("1")
  })

  it("same row checkbox clicked repeatedly never drifts to select-all", () => {
    render(<AdminTableHarness selectedFacilityId={5} tick={0} />)
    const cb = getRowCheckbox("TB-101")

    for (let i = 0; i < 5; i++) {
      fireEvent.click(cb)
    }

    // Odd number of toggles = that single row selected; NOT all 3 rows.
    expect(screen.getByTestId("selected-count")).toHaveTextContent("1")
    expect(screen.getByTestId("selected-ids")).toHaveTextContent("101")
  })

  it("parent re-renders between clicks do not wipe selection (admin-like)", () => {
    const { rerender } = render(
      <AdminTableHarness selectedFacilityId={5} tick={0} />,
    )

    fireEvent.click(getRowCheckbox("TB-202"))
    expect(screen.getByTestId("selected-ids")).toHaveTextContent("202")

    // Simulate admin-only parent re-renders (isFetching toggle, branding
    // ref change, activeUsageLogs refetch) with SAME facility selection.
    for (let tick = 1; tick <= 5; tick++) {
      rerender(<AdminTableHarness selectedFacilityId={5} tick={tick} />)
    }

    expect(screen.getByTestId("selected-ids")).toHaveTextContent("202")
    expect(screen.getByTestId("selected-count")).toHaveTextContent("1")

    // Then click another row → should ADD to selection (2), not reset.
    fireEvent.click(getRowCheckbox("TB-303"))
    const ids = (screen.getByTestId("selected-ids").textContent ?? "").split(
      ",",
    )
    expect(ids.sort()).toEqual(["202", "303"])
    expect(screen.getByTestId("selected-count")).toHaveTextContent("2")
  })

  it("selecting 2 distinct rows in admin flow keeps only those rows selected", () => {
    render(<AdminTableHarness selectedFacilityId={5} tick={0} />)

    fireEvent.click(getRowCheckbox("TB-101"))
    fireEvent.click(getRowCheckbox("TB-303"))

    const ids = (screen.getByTestId("selected-ids").textContent ?? "").split(
      ",",
    )
    expect(ids.sort()).toEqual(["101", "303"])
    expect(screen.getByTestId("selected-count")).toHaveTextContent("2")
  })
})
