import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/app/(app)/device-quota/dashboard/_hooks/useDeviceQuotaDashboardContext", () => ({
  useDeviceQuotaDashboardContext: () => ({
    complianceSummary: { unassigned_equipment: 3 },
    donViId: 1,
  }),
}))

import { DeviceQuotaUnassignedAlert } from "@/app/(app)/device-quota/dashboard/_components/DeviceQuotaUnassignedAlert"

describe("DeviceQuotaUnassignedAlert", () => {
  it("opens the canonical Categories workspace for unassigned equipment", () => {
    render(<DeviceQuotaUnassignedAlert />)

    expect(screen.getByRole("link", { name: "Phân loại ngay" })).toHaveAttribute(
      "href",
      "/device-quota/categories"
    )
  })
})
