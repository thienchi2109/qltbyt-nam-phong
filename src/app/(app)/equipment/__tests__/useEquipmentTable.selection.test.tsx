import * as React from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ColumnDef } from "@tanstack/react-table"
import { describe, expect, it, vi } from "vitest"

import { useEquipmentTable } from "../_hooks/useEquipmentTable"
import type { Equipment } from "@/types/database"

const MEDIA_QUERIES = {
  mediumScreen: "(min-width: 768px) and (max-width: 1800px)",
}

const mediaQueryState = vi.hoisted(() => ({
  responses: {} as Record<string, boolean>,
  useMediaQuery: vi.fn((query: string) => false),
  useIsMobile: vi.fn(() => false),
}))

vi.mock("@/hooks/use-media-query", () => ({
  useMediaQuery: (query: string) => mediaQueryState.useMediaQuery(query),
}))

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mediaQueryState.useIsMobile(),
}))

beforeEach(() => {
  mediaQueryState.responses = {}
  mediaQueryState.useMediaQuery.mockImplementation(
    (query: string) => mediaQueryState.responses[query] ?? false
  )
  mediaQueryState.useIsMobile.mockReturnValue(false)
})

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

function setMediaQueryResponses(responses: Record<string, boolean>) {
  mediaQueryState.responses = responses
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

  it("hides ngay_ngung_su_dung by default", () => {
    const { result } = renderSelectionHook()

    expect(result.current.columnVisibility.ngay_ngung_su_dung).toBe(false)
  })
})

describe("useEquipmentTable responsive visibility", () => {
  it("auto-hides the desktop-only columns on 768px-1800px screens", async () => {
    setMediaQueryResponses({
      [MEDIA_QUERIES.mediumScreen]: true,
    })

    const { result } = renderSelectionHook()

    await waitFor(() => {
      expect(result.current.columnVisibility.serial).toBe(false)
      expect(result.current.columnVisibility.phan_loai_theo_nd98).toBe(false)
      expect(result.current.columnVisibility.so_luu_hanh).toBe(false)
    })
  })

  it("restores prior visibility after leaving the 768px-1800px range", async () => {
    setMediaQueryResponses({})

    const { result, rerender } = renderSelectionHook()

    act(() => {
      result.current.setColumnVisibility((prev) => ({
        ...prev,
        serial: false,
        phan_loai_theo_nd98: true,
        so_luu_hanh: false,
      }))
    })

    act(() => {
      setMediaQueryResponses({
        [MEDIA_QUERIES.mediumScreen]: true,
      })
      rerender()
    })

    await waitFor(() => {
      expect(result.current.columnVisibility.serial).toBe(false)
      expect(result.current.columnVisibility.phan_loai_theo_nd98).toBe(false)
      expect(result.current.columnVisibility.so_luu_hanh).toBe(false)
    })

    act(() => {
      setMediaQueryResponses({})
      rerender()
    })

    await waitFor(() => {
      expect(result.current.columnVisibility.serial).toBe(false)
      expect(result.current.columnVisibility.phan_loai_theo_nd98).toBe(true)
      expect(result.current.columnVisibility.so_luu_hanh).toBe(false)
    })
  })
})
