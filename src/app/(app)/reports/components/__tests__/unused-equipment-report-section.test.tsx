import * as React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { UnusedEquipmentReportSection } from "../unused-equipment-report-section"

const mocks = vi.hoisted(() => ({
  useUnusedEquipmentReport: vi.fn(),
}))

vi.mock("../../hooks/use-unused-equipment-report", () => ({
  useUnusedEquipmentReport: mocks.useUnusedEquipmentReport,
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode
    value?: string
    onValueChange?: (value: string) => void
  }) => (
    <select value={value} onChange={(event) => onValueChange?.(event.target.value)}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
}))

describe("UnusedEquipmentReportSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useUnusedEquipmentReport.mockReturnValue({
      data: {
        summary: {
          totalCount: 30,
          deviceTypeCount: 1,
          departmentCount: 1,
          totalOriginalValue: 1000000,
        },
        topDeviceGroups: [],
        departments: [],
        items: [],
        totalCount: 30,
        page: 1,
        pageSize: 10,
      },
      isLoading: false,
      error: null,
    })
  })

  it("resets to the first page when page size changes", () => {
    render(<UnusedEquipmentReportSection selectedDonVi={17} />)

    fireEvent.click(screen.getByRole("button", { name: "Sau" }))
    expect(mocks.useUnusedEquipmentReport).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 2,
        pageSize: 10,
      })
    )

    const pageSizeSelect = screen.getAllByRole("combobox").at(-1)
    expect(pageSizeSelect).toBeDefined()
    fireEvent.change(pageSizeSelect as HTMLElement, { target: { value: "20" } })

    expect(mocks.useUnusedEquipmentReport).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 20,
      })
    )
  })

  it("keeps department filter options independent from the currently selected distribution", () => {
    mocks.useUnusedEquipmentReport.mockReturnValue({
      data: {
        summary: {
          totalCount: 2,
          deviceTypeCount: 1,
          departmentCount: 2,
          totalOriginalValue: 1000000,
        },
        topDeviceGroups: [],
        departments: [
          { departmentName: "Khoa Nội", equipmentCount: 2, totalOriginalValue: 1000000 },
        ],
        departmentOptions: [
          { departmentName: "Khoa Nội", equipmentCount: 2, totalOriginalValue: 1000000 },
          { departmentName: "Khoa Ngoại", equipmentCount: 1, totalOriginalValue: 500000 },
        ],
        items: [],
        totalCount: 2,
        page: 1,
        pageSize: 10,
      },
      isLoading: false,
      error: null,
    })

    render(<UnusedEquipmentReportSection selectedDonVi={17} />)

    expect(screen.getByRole("option", { name: "Khoa Nội" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Khoa Ngoại" })).toBeInTheDocument()
  })
})
