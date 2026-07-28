import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { MaintenanceForm } from "@/components/maintenance-form"

const mockUseTenantBranding = vi.hoisted(() => vi.fn())

vi.mock("@/hooks/use-tenant-branding", () => ({
  useTenantBranding: mockUseTenantBranding,
}))

vi.mock("@/components/form-branding-header", () => ({
  FormBrandingHeader: () => <div data-testid="form-branding-header" />,
}))

function brandingResult(printLocation?: string | null, isPlaceholderData = false) {
  return {
    data: {
      id: 7,
      name: "Tenant test",
      logo_url: null,
      ...(printLocation === undefined ? {} : { print_location: printLocation }),
    },
    isPlaceholderData,
  }
}

describe("MaintenanceForm print location", () => {
  beforeEach(() => {
    mockUseTenantBranding.mockReset()
    mockUseTenantBranding.mockReturnValue(brandingResult())
  })

  it("uses the form tenant branding location in an editable input before the date text", () => {
    mockUseTenantBranding.mockReturnValue(brandingResult("Hà Nội"))

    render(<MaintenanceForm tenantId={7} />)

    expect(mockUseTenantBranding).toHaveBeenCalledWith({
      formTenantId: 7,
      useFormContext: true,
    })

    const locationInput = screen.getByRole("textbox", { name: "Địa điểm lập biểu mẫu" })
    expect(locationInput).toHaveValue("Hà Nội")
    expect(locationInput).toBeEnabled()
    expect(locationInput).not.toHaveAttribute("readonly")
    expect(locationInput.nextSibling?.textContent).toBe(", ngày ")
  })

  it("renders an empty editable location input when print_location is missing or null", () => {
    const missingLocationRender = render(<MaintenanceForm tenantId={7} />)

    const missingLocationInput = screen.getByRole("textbox", {
      name: "Địa điểm lập biểu mẫu",
    })
    expect(missingLocationInput).toHaveValue("")
    expect(missingLocationInput).toBeEnabled()
    expect(missingLocationInput).not.toHaveAttribute("readonly")

    missingLocationRender.unmount()
    mockUseTenantBranding.mockReturnValue(brandingResult(null))
    render(<MaintenanceForm tenantId={7} />)

    const nullLocationInput = screen.getByRole("textbox", {
      name: "Địa điểm lập biểu mẫu",
    })
    expect(nullLocationInput).toHaveValue("")
    expect(nullLocationInput).toBeEnabled()
    expect(nullLocationInput).not.toHaveAttribute("readonly")
  })

  it("uses session branding context when tenantId is omitted", () => {
    render(<MaintenanceForm />)

    expect(mockUseTenantBranding).toHaveBeenCalledWith({
      formTenantId: null,
      useFormContext: false,
    })
  })

  it("updates the editable location when branding resolves after mount", () => {
    mockUseTenantBranding.mockReturnValue({
      data: undefined,
      isPlaceholderData: false,
    })
    const { rerender } = render(<MaintenanceForm tenantId={7} />)

    expect(screen.getByRole("textbox", { name: "Địa điểm lập biểu mẫu" })).toHaveValue("")

    mockUseTenantBranding.mockReturnValue(brandingResult("An Giang"))
    rerender(<MaintenanceForm tenantId={7} />)

    expect(screen.getByRole("textbox", { name: "Địa điểm lập biểu mẫu" })).toHaveValue("An Giang")
  })

  it("clears placeholder branding while switching form tenants", () => {
    mockUseTenantBranding.mockReturnValue(brandingResult("An Giang"))
    const { rerender } = render(<MaintenanceForm tenantId={7} />)
    fireEvent.change(screen.getByRole("textbox", { name: "Địa điểm lập biểu mẫu" }), {
      target: { value: "Địa điểm tenant cũ" },
    })

    mockUseTenantBranding.mockReturnValue(brandingResult("An Giang", true))
    rerender(<MaintenanceForm tenantId={8} />)

    expect(screen.getByRole("textbox", { name: "Địa điểm lập biểu mẫu" })).toHaveValue("")

    mockUseTenantBranding.mockReturnValue(brandingResult("Hà Nội"))
    rerender(<MaintenanceForm tenantId={8} />)

    expect(screen.getByRole("textbox", { name: "Địa điểm lập biểu mẫu" })).toHaveValue("Hà Nội")
  })

  it("preserves manual edits while branding for the same tenant stays unchanged", () => {
    mockUseTenantBranding.mockReturnValue(brandingResult("An Giang"))
    const { rerender } = render(<MaintenanceForm tenantId={7} />)
    const locationInput = screen.getByRole("textbox", { name: "Địa điểm lập biểu mẫu" })

    fireEvent.change(locationInput, { target: { value: "Địa điểm nhập tay" } })
    rerender(<MaintenanceForm tenantId={7} />)

    expect(screen.getByRole("textbox", { name: "Địa điểm lập biểu mẫu" })).toHaveValue(
      "Địa điểm nhập tay"
    )
  })

  it('does not render the hardcoded text "Cần Thơ, ngày"', () => {
    const { container } = render(<MaintenanceForm tenantId={7} />)

    expect(container).not.toHaveTextContent("Cần Thơ, ngày")
  })
})
