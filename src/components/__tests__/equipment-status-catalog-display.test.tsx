import * as React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Table } from "@tanstack/react-table"
import type { Equipment } from "@/types/database"

const mocks = vi.hoisted(() => ({ catalog: vi.fn(), retry: vi.fn() }))
vi.mock("@/hooks/use-equipment-status-catalog", () => ({
  useEquipmentStatusCatalog: () => mocks.catalog(),
}))
vi.mock("@/components/equipment-linked-request", () => ({ LinkedRequestRowIndicator: () => null }))
vi.mock("@/components/equipment/useEquipmentQRScanner", () => ({
  useQRScanner: () => ({ isCameraActive: false, isQRActionSheetOpen: false }),
}))
vi.mock("@/components/equipment/equipment-toolbar-layout", () => ({
  EquipmentToolbarDesktopFilters: () => null,
}))
vi.mock("@/components/ui/heroui/HeroActionDropdown", () => ({
  HeroActionDropdown: ({
    items,
  }: {
    items: Array<{ id: string; label: string; isDisabled?: boolean; onAction?: () => void }>
  }) => (
    <>
      {items.map((item) => (
        <button key={item.id} disabled={item.isDisabled} onClick={item.onAction}>
          {item.label}
        </button>
      ))}
    </>
  ),
}))
vi.mock("@/components/shared/ListFilterSearchCard", () => ({
  ListFilterSearchCard: ({ actions }: { actions?: React.ReactNode }) => <>{actions}</>,
}))
import { createEquipmentColumns, getStatusVariant } from "../equipment/equipment-table-columns"
import { EquipmentToolbar } from "../equipment/equipment-toolbar"
import { EquipmentDetailDetailsTab } from "@/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailDetailsTab"

function TableStatus({ status }: { status: string }) {
  const columns = createEquipmentColumns({ renderActions: () => null })
  const column = columns.find(
    (value) => "accessorKey" in value && value.accessorKey === "tinh_trang_hien_tai"
  )!
  const cell = column.cell as (context: {
    row: { getValue: () => string; original: Equipment }
  }) => React.ReactNode
  return cell({
    row: { getValue: () => status, original: { id: 1, tinh_trang_hien_tai: status } as Equipment },
  })
}
function Toolbar() {
  return (
    <EquipmentToolbar
      table={{} as Table<Equipment>}
      title="Thiết bị"
      description=""
      searchTerm=""
      onSearchChange={vi.fn()}
      columnFilters={[]}
      statuses={[]}
      departments={[]}
      users={[]}
      classifications={[]}
      fundingSources={[]}
      filterMode="faceted"
      filterState={{ isFiltered: false, hasFacilityFilter: false }}
      actionState={{ canCreateEquipment: true }}
      onOpenFilterSheet={vi.fn()}
      onOpenColumnsDialog={vi.fn()}
      onDownloadTemplate={vi.fn()}
      onExportData={vi.fn()}
      onAddEquipment={vi.fn()}
      onImportEquipment={vi.fn()}
    />
  )
}
describe("catalog status display", () => {
  beforeEach(() => {
    mocks.catalog.mockReturnValue({ canWrite: false, activeValues: [], refetch: mocks.retry })
  })
  it("shows the approved liquidation badge in dark gray with white text in the table", () => {
    render(<TableStatus status="Thanh lý nội bộ" />)
    expect(screen.getByText("Thanh lý nội bộ")).toHaveClass("bg-gray-800", "text-white")
  })
  it("shows the same liquidation presentation in equipment details", () => {
    render(
      <EquipmentDetailDetailsTab
        displayEquipment={{ id: 1, tinh_trang_hien_tai: "Thanh lý nội bộ" } as Equipment}
        isEditing={false}
      />
    )
    expect(screen.getByText("Thanh lý nội bộ")).toHaveClass("bg-gray-800", "text-white")
  })
  it("preserves all six legacy variants and raw unknown neutral display", () => {
    const expected = ["default", "destructive", "secondary", "secondary", "muted", "outline"]
    const labels = [
      "Hoạt động",
      "Chờ sửa chữa",
      "Chờ bảo trì",
      "Chờ hiệu chuẩn/kiểm định",
      "Ngưng sử dụng",
      "Chưa có nhu cầu sử dụng",
    ]
    expect(labels.map((label) => getStatusVariant(label))).toEqual(expected)
    render(<TableStatus status="  Giá trị lịch sử  " />)
    expect(screen.getByText("Giá trị lịch sử")).not.toHaveClass("bg-gray-800")
    expect(screen.getByText("Giá trị lịch sử").textContent).toBe("  Giá trị lịch sử  ")
  })
  it("disables template download and exposes retry without blocking historical export", () => {
    render(<Toolbar />)
    expect(screen.getByRole("button", { name: "Tải Excel mẫu" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Tải về dữ liệu" })).toBeEnabled()
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }))
    expect(mocks.retry).toHaveBeenCalledOnce()
  })
})
