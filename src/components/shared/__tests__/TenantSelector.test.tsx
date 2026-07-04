import * as React from "react"
import { describe, expect, it, vi } from "vitest"
import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"

import { useTenantSelection } from "@/contexts/TenantSelectionContext"
import { TenantSelector } from "../TenantSelector"

vi.mock("@/contexts/TenantSelectionContext", () => ({
  useTenantSelection: vi.fn(),
}))

vi.mock("../TenantSelectorSheet", () => ({
  TenantSelectorSheet: ({ open }: { open: boolean }) =>
    open ? <div data-testid="tenant-selector-sheet" /> : null,
}))

const mockUseTenantSelection = vi.mocked(useTenantSelection)

describe("TenantSelector", () => {
  it("renders the command variant as a compact filter token with inline clear", () => {
    const setSelectedFacilityId = vi.fn()
    mockUseTenantSelection.mockReturnValue({
      selectedFacilityId: 7,
      setSelectedFacilityId,
      facilities: [{ id: 7, name: "Bệnh viện Đa khoa thành phố", count: 12 }],
      showSelector: true,
      isLoading: false,
      shouldFetchData: true,
    })

    render(<TenantSelector variant="command" />)

    const trigger = screen.getByText("Cơ sở").closest("button")
    expect(trigger).not.toBeNull()
    expect(trigger).toHaveAttribute("data-trigger-variant", "command")
    expect(trigger).toHaveTextContent("Cơ sở")
    expect(trigger).toHaveTextContent("1")
    expect(trigger).not.toHaveTextContent("Bệnh viện Đa khoa thành phố")
    expect(trigger).toHaveAttribute("title", "Bệnh viện Đa khoa thành phố")

    fireEvent.click(screen.getByRole("button", { name: "Xóa lọc cơ sở" }))
    expect(setSelectedFacilityId).toHaveBeenCalledWith(null)
  })

  it("treats non-null facility ids as active command selections", () => {
    const setSelectedFacilityId = vi.fn()
    mockUseTenantSelection.mockReturnValue({
      selectedFacilityId: "facility-7" as unknown as number,
      setSelectedFacilityId,
      facilities: [
        { id: "facility-7" as unknown as number, name: "Cơ sở ngoài hệ thống", count: 4 },
      ],
      showSelector: true,
      isLoading: false,
      shouldFetchData: true,
    })

    render(<TenantSelector variant="command" />)

    const trigger = screen.getByText("Cơ sở").closest("button")
    expect(trigger).not.toBeNull()
    expect(trigger).toHaveTextContent("1")
    expect(trigger).toHaveAttribute("title", "Cơ sở ngoài hệ thống")

    fireEvent.click(screen.getByRole("button", { name: "Xóa lọc cơ sở" }))
    expect(setSelectedFacilityId).toHaveBeenCalledWith(null)
  })

  it("labels the command trigger as unselected when all facilities are hidden", () => {
    mockUseTenantSelection.mockReturnValue({
      selectedFacilityId: null,
      setSelectedFacilityId: vi.fn(),
      facilities: [{ id: 7, name: "Bệnh viện Đa khoa thành phố", count: 12 }],
      showSelector: true,
      isLoading: false,
      shouldFetchData: true,
    })

    render(<TenantSelector variant="command" hideAllOption />)

    const trigger = screen.getByRole("button", { name: "Cơ sở: Chọn cơ sở..." })
    expect(trigger).toHaveAttribute("title", "Chọn cơ sở...")
    expect(screen.queryByRole("button", { name: "Xóa lọc cơ sở" })).not.toBeInTheDocument()
  })
})
