import * as React from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ColumnDef } from "@tanstack/react-table"
import { beforeEach, describe, expect, it, vi } from "vitest"

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
  window.localStorage.clear()
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

function columnVisibilityStorageKey(userId: string) {
  return `equipment:columnVisibility:v1:user:${userId}`
}

function readStoredColumnVisibility(userId: string) {
  const value = window.localStorage.getItem(columnVisibilityStorageKey(userId))
  return value ? JSON.parse(value) : null
}

function renderPersistedHook(userId = "user-5") {
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
      columnVisibilityUserId: userId,
    })
  })
}

function renderHookWithUserId(initialUserId?: string) {
  return renderHook(() => {
    const [userId, setUserId] = React.useState<string | undefined>(initialUserId)
    const [sorting, setSorting] = React.useState([])
    const [columnFilters, setColumnFilters] = React.useState([])
    const [searchTerm, setSearchTerm] = React.useState("")
    const [pagination, setPagination] = React.useState({
      pageIndex: 0,
      pageSize: 20,
    })

    return {
      table: useEquipmentTable({
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
        columnVisibilityUserId: userId,
      }),
      setUserId,
    }
  })
}

function setMediaQueryResponses(responses: Record<string, boolean>) {
  mediaQueryState.responses = responses
}

describe("useEquipmentTable column visibility persistence", () => {
  it("hydrates column visibility from localStorage for the current user", () => {
    window.localStorage.setItem(
      columnVisibilityStorageKey("user-5"),
      JSON.stringify({ model: true, serial: false })
    )

    const { result } = renderPersistedHook("user-5")

    expect(result.current.columnVisibility.model).toBe(true)
    expect(result.current.columnVisibility.serial).toBe(false)
    expect(result.current.columnVisibility.ngay_ngung_su_dung).toBe(false)
  })

  it("persists manual column visibility changes to localStorage", async () => {
    const { result } = renderPersistedHook("user-5")

    act(() => {
      result.current.setColumnVisibility((prev) => ({
        ...prev,
        model: true,
        serial: false,
      }))
    })

    await waitFor(() => {
      expect(readStoredColumnVisibility("user-5")).toEqual({
        model: true,
        serial: false,
      })
    })
  })

  it("uses a separate localStorage value for each user", () => {
    window.localStorage.setItem(
      columnVisibilityStorageKey("user-1"),
      JSON.stringify({ model: true, serial: true })
    )
    window.localStorage.setItem(
      columnVisibilityStorageKey("user-2"),
      JSON.stringify({ model: false, serial: false })
    )

    const { result } = renderPersistedHook("user-2")

    expect(result.current.columnVisibility.model).toBe(false)
    expect(result.current.columnVisibility.serial).toBe(false)
  })

  it("falls back to default visibility when localStorage is corrupt", () => {
    window.localStorage.setItem(columnVisibilityStorageKey("user-5"), "{bad-json")

    const { result } = renderPersistedHook("user-5")

    expect(result.current.columnVisibility.model).toBe(false)
    expect(result.current.columnVisibility.serial).toBe(true)
    expect(result.current.columnVisibility.ngay_ngung_su_dung).toBe(false)
  })

  it("does not persist responsive auto-hide as the saved user preference", async () => {
    window.localStorage.setItem(
      columnVisibilityStorageKey("user-5"),
      JSON.stringify({
        serial: true,
        phan_loai_theo_nd98: true,
        so_luu_hanh: true,
      })
    )
    setMediaQueryResponses({
      [MEDIA_QUERIES.mediumScreen]: true,
    })

    const { result } = renderPersistedHook("user-5")

    await waitFor(() => {
      expect(result.current.columnVisibility.serial).toBe(false)
      expect(result.current.columnVisibility.phan_loai_theo_nd98).toBe(false)
      expect(result.current.columnVisibility.so_luu_hanh).toBe(false)
    })
    expect(readStoredColumnVisibility("user-5")).toMatchObject({
      serial: true,
      phan_loai_theo_nd98: true,
      so_luu_hanh: true,
    })
  })

  it("persists manual changes on medium screens without saving responsive forced hides", async () => {
    window.localStorage.setItem(
      columnVisibilityStorageKey("user-5"),
      JSON.stringify({
        model: false,
        serial: true,
        phan_loai_theo_nd98: true,
        so_luu_hanh: true,
      })
    )
    setMediaQueryResponses({
      [MEDIA_QUERIES.mediumScreen]: true,
    })

    const { result } = renderPersistedHook("user-5")

    await waitFor(() => {
      expect(result.current.columnVisibility.serial).toBe(false)
    })

    act(() => {
      result.current.setColumnVisibility((prev) => ({
        ...prev,
        model: true,
      }))
    })

    await waitFor(() => {
      expect(readStoredColumnVisibility("user-5")).toEqual({
        model: true,
      })
    })
  })

  it("applies responsive auto-hide when auth resolves on a medium screen", async () => {
    window.localStorage.setItem(
      columnVisibilityStorageKey("user-5"),
      JSON.stringify({
        serial: true,
        phan_loai_theo_nd98: true,
        so_luu_hanh: true,
      })
    )
    setMediaQueryResponses({
      [MEDIA_QUERIES.mediumScreen]: true,
    })

    const { result } = renderHookWithUserId(undefined)

    await waitFor(() => {
      expect(result.current.table.columnVisibility.serial).toBe(false)
    })

    act(() => {
      result.current.setUserId("user-5")
    })

    await waitFor(() => {
      expect(result.current.table.columnVisibility.serial).toBe(false)
      expect(result.current.table.columnVisibility.phan_loai_theo_nd98).toBe(false)
      expect(result.current.table.columnVisibility.so_luu_hanh).toBe(false)
    })
  })
})
