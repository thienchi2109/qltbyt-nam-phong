import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { DeviceQuotaSuggestedMappingAction } from "../DeviceQuotaSuggestedMappingAction"

vi.mock("../SuggestedMappingPreviewDialog", () => ({
  SuggestedMappingPreviewDialog: ({
    open,
    donViId,
    userRole,
  }: {
    open: boolean
    donViId: number | null
    userRole: string | null
  }) =>
    open ? (
      <div data-testid="suggested-mapping-dialog">
        {donViId}:{userRole}
      </div>
    ) : null,
}))

describe("DeviceQuotaSuggestedMappingAction", () => {
  it.each(["global", "admin", "to_qltb", "regional_leader"])(
    "opens the existing facility-wide dialog for %s",
    async (userRole) => {
      const user = userEvent.setup()

      render(<DeviceQuotaSuggestedMappingAction donViId={7} userRole={userRole} />)

      await user.click(screen.getByRole("button", { name: /gợi ý phân loại/i }))

      expect(screen.getByTestId("suggested-mapping-dialog")).toHaveTextContent(`7:${userRole}`)
    }
  )

  it.each(["technician", "qltb_khoa", "user", null])(
    "does not expose suggestions to %s",
    (userRole) => {
      render(<DeviceQuotaSuggestedMappingAction donViId={7} userRole={userRole} />)

      expect(screen.queryByRole("button", { name: /gợi ý phân loại/i })).not.toBeInTheDocument()
    }
  )

  it("does not expose suggestions before a facility is selected", () => {
    render(<DeviceQuotaSuggestedMappingAction donViId={null} userRole="admin" />)

    expect(screen.queryByRole("button", { name: /gợi ý phân loại/i })).not.toBeInTheDocument()
  })
})
