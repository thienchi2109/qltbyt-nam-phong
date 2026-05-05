/**
 * Proof tests for issue #400 — root cause investigation.
 *
 * Background: Bug báo cáo là multi-selection ở Equipment data grid bị
 * trễ rất lâu cho role admin/global (state cập nhật đúng nhưng UI
 * mất vài giây mới phản hồi). Hypothesis ban đầu: chain memo vỡ ở
 * `useReactTable` → `useEquipmentTable` → `useEquipmentPage` →
 * `React.memo(EquipmentPageContent)` gây full subtree re-render mỗi click.
 *
 * KẾT QUẢ: Hypothesis trên đã được CHỨNG MINH SAI bằng các test bên dưới.
 * `useReactTable` trả về `table` instance có identity ỔN ĐỊNH qua re-render,
 * và `useEquipmentTable` memoize ĐÚNG return object qua selection toggle.
 * → Chain memo từ `useEquipmentTable` không phải root cause.
 *
 * Các test này được giữ lại để:
 *   1. Lock hành vi đúng (memo stability) — tránh regression sau này.
 *   2. Là bằng chứng kiểm chứng được, lưu lại quá trình điều tra.
 *
 * Khi root cause thật được xác định, các test khác cần được viết để khóa
 * mặt khác (vd: data size budget, render cost trong cell, listener leak).
 */

import * as React from "react"
import { act, renderHook } from "@testing-library/react"
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
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

// ============================================================================
// Bằng chứng 1: useReactTable trả về table identity ỔN ĐỊNH qua render
// ============================================================================

describe("[issue #400] useReactTable instance identity is stable", () => {
  it("returns the SAME table reference across no-op re-renders", () => {
    const columns: ColumnDef<Equipment>[] = [
      { accessorKey: "ma_thiet_bi", header: "Mã" },
    ]

    const { result, rerender } = renderHook(() =>
      useReactTable({
        data: ROWS,
        columns,
        getCoreRowModel: getCoreRowModel(),
      }),
    )

    const t1 = result.current
    rerender()
    const t2 = result.current
    rerender()
    const t3 = result.current

    // Khẳng định: table instance từ useReactTable KHÔNG đổi ref qua
    // re-render khi options không đổi. Loại bỏ giả thuyết "table ref churn".
    expect(t2).toBe(t1)
    expect(t3).toBe(t1)
  })
})

// ============================================================================
// Bằng chứng 2: useEquipmentTable memoize return CHÍNH XÁC
// ============================================================================

function renderUseEquipmentTable(selectedFacilityId: number | null = 5) {
  return renderHook(() => {
    const [sorting, setSorting] = React.useState([])
    const [columnFilters, setColumnFilters] = React.useState([])
    const [searchTerm, setSearchTerm] = React.useState("")
    const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 20 })

    const columns = React.useMemo<ColumnDef<Equipment>[]>(
      () => [
        createSelectionColumn<Equipment>(),
        { accessorKey: "ma_thiet_bi", header: "Mã" },
      ],
      [],
    )

    return useEquipmentTable({
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
      selectedDonVi: selectedFacilityId,
      selectedFacilityId,
    })
  })
}

describe("[issue #400] useEquipmentTable return identity is stable", () => {
  it("returns the SAME object across no-op re-renders", () => {
    const { result, rerender } = renderUseEquipmentTable(5)

    const before = result.current
    rerender()
    const after = result.current

    // Khẳng định: re-render không đổi gì → return ref không đổi.
    // Loại bỏ giả thuyết "memo deps churn ngầm".
    expect(after).toBe(before)
  })

  it("preserves the SAME `table` reference across selection toggles", () => {
    const { result } = renderUseEquipmentTable(5)

    const tableBefore = result.current.table
    act(() => {
      result.current.table.toggleAllPageRowsSelected(true)
    })
    const tableAfter = result.current.table

    // Khẳng định: TanStack table instance giữ identity qua state change
    // nội tại (rowSelection). Loại bỏ giả thuyết "selection toggle khiến
    // table ref đổi → trigger downstream re-render".
    expect(tableAfter).toBe(tableBefore)
  })

  it("returns the SAME memo object across selection toggles (selection state is internal)", () => {
    const { result } = renderUseEquipmentTable(5)

    const before = result.current
    act(() => {
      result.current.table.toggleAllPageRowsSelected(true)
    })
    const after = result.current

    // Khẳng định cuối cùng: rowSelection thay đổi KHÔNG làm
    // useEquipmentTable phát object mới ra ngoài. Đây là proof rằng
    // chain memo từ useEquipmentTable đã đúng — root cause của lag
    // KHÔNG nằm ở đây. Cần điều tra layer khác (data size, cell cost,
    // subscriber, listener, hoặc ở tầng useEquipmentPage trở lên).
    expect(after).toBe(before)
  })
})
