import * as React from "react"
import { describe, expect, it, vi } from "vitest"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { FacilityOption } from "@/types/tenant"
import { useTenantSelection } from "@/contexts/TenantSelectionContext"
import { TenantSelectorSheet } from "../TenantSelectorSheet"

vi.mock("@/contexts/TenantSelectionContext", () => ({
  useTenantSelection: vi.fn(),
}))

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, children }: { open: boolean; children: React.ReactNode }) => (
    open ? <div data-testid="tenant-selector-sheet">{children}</div> : null
  ),
  SheetContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

const mockUseTenantSelection = vi.mocked(useTenantSelection)

const FACILITIES: FacilityOption[] = [
  { id: 1, name: "Bệnh viện Đa khoa An Giang", count: 4 },
  { id: 2, name: "Bệnh viện Đa khoa Cần Thơ", count: 7 },
]

function renderSheet() {
  mockUseTenantSelection.mockReturnValue({
    selectedFacilityId: undefined,
    setSelectedFacilityId: vi.fn(),
    facilities: FACILITIES,
    showSelector: true,
    isLoading: false,
    shouldFetchData: false,
  })

  render(<TenantSelectorSheet open onOpenChange={vi.fn()} />)
}

describe("TenantSelectorSheet", () => {
  it("matches facility search without accents or case sensitivity", async () => {
    const user = userEvent.setup()
    renderSheet()

    await user.type(screen.getByPlaceholderText("Tìm kiếm cơ sở..."), "can tho")

    expect(screen.getByRole("button", { name: /Bệnh viện Đa khoa Cần Thơ/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Bệnh viện Đa khoa An Giang/ })).not.toBeInTheDocument()
  })

  it("matches composed facility names with decomposed Unicode input", async () => {
    const user = userEvent.setup()
    renderSheet()

    await user.type(screen.getByPlaceholderText("Tìm kiếm cơ sở..."), "Ca\u0302\u0300n tho")

    expect(screen.getByRole("button", { name: /Bệnh viện Đa khoa Cần Thơ/ })).toBeInTheDocument()
  })
})
