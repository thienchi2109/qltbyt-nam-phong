import * as React from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ColumnDef } from "@tanstack/react-table"
import { describe, expect, it, vi } from "vitest"

import { useEquipmentTable } from "../_hooks/useEquipmentTable"
import type { Equipment } from "@/types/database"

vi.mock("@/hooks/use-media-query", () => ({
  useMediaQuery: () => false,
}))

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}))

function createEquipment(id: number): Equipment {
  return {
    id,
    ma_thiet_bi: `TB-${id}`,
    ten_thiet_bi: `Thiết bị ${id}`,
  }
}

const data = [createEquipment(101), createEquipment(202), createEquipment(303)]

const columns: ColumnDef<Equipment>[] = [
  {
    accessorKey: "ma_thiet_bi",
    header: "Mã thiết bị",
  },
]

function renderSelectionHook() {
  return renderHook(() => {
    const [sorting, setSorting] = React.useState([])
    const [columnFilters, setColumnFilters] = React.useState([])
    const [searchTerm, setSearchTerm] = React.useState("")
    const [pagination, setPagination] = React.useState({
      pageIndex: 0,
      pageSize: 20,
    })

    return useEquipmentTable({
      data,
      total: 60,
      columns,
      sorting,
      setSorting,
      columnFilters,
      setColumnFilters,
      debouncedSearch: searchTerm,
      setSearchTerm,
      pagination,
      setPagination,
      selectedDonVi: 5,
      selectedFacilityId: 5,
    })
  })
}

describe("useEquipmentTable row selection", () => {
  it("uses equipment.id as row id via getRowId", () => {
    const { result } = renderSelectionHook()

    const rowIds = result.current.table.getRowModel().rows.map((row) => row.id)
    expect(rowIds).toEqual(["101", "202", "303"])
  })

  it("clears row selection on filter changes", async () => {
    const { result } = renderSelectionHook()

    act(() => {
      result.current.table.toggleAllPageRowsSelected(true)
    })
    expect(result.current.table.getFilteredSelectedRowModel().rows).toHaveLength(3)

    act(() => {
      result.current.table.setColumnFilters([{ id: "ma_thiet_bi", value: ["TB-101"] }])
    })

    await waitFor(() => {
      expect(result.current.table.getState().rowSelection).toEqual({})
    })
  })

  it("clears row selection on page index changes", async () => {
    const { result } = renderSelectionHook()

    act(() => {
      result.current.table.toggleAllPageRowsSelected(true)
    })
    expect(result.current.table.getFilteredSelectedRowModel().rows).toHaveLength(3)

    act(() => {
      result.current.table.setPageIndex(1)
    })

    await waitFor(() => {
      expect(result.current.table.getState().rowSelection).toEqual({})
    })
  })

  it("clears row selection on sorting changes", async () => {
    const { result } = renderSelectionHook()

    act(() => {
      result.current.table.toggleAllPageRowsSelected(true)
    })
    expect(result.current.table.getFilteredSelectedRowModel().rows).toHaveLength(3)

    act(() => {
      result.current.table.setSorting([{ id: "ma_thiet_bi", desc: true }])
    })

    await waitFor(() => {
      expect(result.current.table.getState().rowSelection).toEqual({})
    })
  })

  it("clears row selection on page size changes", async () => {
    const { result } = renderSelectionHook()

    act(() => {
      result.current.table.toggleAllPageRowsSelected(true)
    })
    expect(result.current.table.getFilteredSelectedRowModel().rows).toHaveLength(3)

    act(() => {
      result.current.table.setPageSize(10)
    })

    await waitFor(() => {
      expect(result.current.table.getState().rowSelection).toEqual({})
    })
  })
})
