import * as React from "react"
import { describe, expect, it, vi } from "vitest"
import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"
import type { Table } from "@tanstack/react-table"

import type { Equipment } from "@/types/database"
import { EquipmentToolbar } from "../equipment-toolbar"

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

function createMockTable() {
  const table = {
    getColumn: vi.fn(() => ({
      getFilterValue: vi.fn(),
      setFilterValue: vi.fn(),
    })),
    resetColumnFilters: vi.fn(),
    getHeaderGroups: () => [],
    getRowModel: () => ({ rows: [] }),
    getAllColumns: () => [],
    getState: () => ({ columnFilters: [] }),
  }

  return table as unknown as Table<Equipment>
}

function createBaseProps() {
  return {
    table: createMockTable(),
    searchTerm: "",
    onSearchChange: vi.fn(),
    columnFilters: [],
    statuses: ["Hoạt động", "Hỏng"],
    departments: ["ICU", "Surgery"],
    users: ["User A"],
    classifications: ["Loại A"],
    fundingSources: ["Ngân sách"],
    filterMode: "faceted" as const,
    filterState: {
      isFiltered: false,
      hasFacilityFilter: false,
    },
    actionState: {
      canCreateEquipment: true,
      isExporting: false,
    },
    onOpenFilterSheet: vi.fn(),
    onOpenColumnsDialog: vi.fn(),
    onDownloadTemplate: vi.fn(),
    onExportData: vi.fn(),
    onAddEquipment: vi.fn(),
    onImportEquipment: vi.fn(),
  }
}

describe("EquipmentToolbar HeroUI top controls", () => {
  it("renders the desktop shell and search through the Equipments HeroUI pilot", () => {
    render(<EquipmentToolbar {...createBaseProps()} />)

    const shell = screen.getByTestId("equipment-heroui-top-controls-shell")
    const searchControl = screen.getByTestId("equipment-heroui-search-control")
    const search = screen.getByRole("searchbox", { name: "Tìm kiếm chung..." })

    expect(shell).toContainElement(searchControl)
    expect(searchControl).toContainElement(search)
    expect(search).toHaveAttribute("type", "search")
  })

  it("keeps desktop options actions wired through the HeroUI dropdown", async () => {
    const onOpenColumnsDialog = vi.fn()
    const onDownloadTemplate = vi.fn()
    const onExportData = vi.fn()

    render(
      <EquipmentToolbar
        {...createBaseProps()}
        onOpenColumnsDialog={onOpenColumnsDialog}
        onDownloadTemplate={onDownloadTemplate}
        onExportData={onExportData}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /Tùy chọn/i }))
    expect(await screen.findByRole("menu", { name: "Tùy chọn" })).toBeInTheDocument()
    fireEvent.click(await screen.findByText("Hiện/ẩn cột"))
    fireEvent.click(screen.getByRole("button", { name: /Tùy chọn/i }))
    fireEvent.click(await screen.findByText("Tải Excel mẫu"))
    fireEvent.click(screen.getByRole("button", { name: /Tùy chọn/i }))
    fireEvent.click(await screen.findByText("Tải về dữ liệu"))

    expect(onOpenColumnsDialog).toHaveBeenCalledTimes(1)
    expect(onDownloadTemplate).toHaveBeenCalledTimes(1)
    expect(onExportData).toHaveBeenCalledTimes(1)
  })

  it("keeps desktop add actions wired through the HeroUI dropdown", async () => {
    const onAddEquipment = vi.fn()
    const onImportEquipment = vi.fn()

    render(
      <EquipmentToolbar
        {...createBaseProps()}
        onAddEquipment={onAddEquipment}
        onImportEquipment={onImportEquipment}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /Thêm thiết bị/i }))
    expect(await screen.findByRole("menu", { name: "Thêm thiết bị" })).toBeInTheDocument()
    fireEvent.click(await screen.findByText("Thêm thủ công"))
    fireEvent.click(screen.getByRole("button", { name: /Thêm thiết bị/i }))
    fireEvent.click(await screen.findByText("Nhập từ Excel"))

    expect(onAddEquipment).toHaveBeenCalledTimes(1)
    expect(onImportEquipment).toHaveBeenCalledTimes(1)
  })
})
