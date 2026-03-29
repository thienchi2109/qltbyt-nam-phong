import * as React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const mockUseQuery = vi.fn()

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: vi.fn(),
}))

import { DeviceQuotaComplianceReport } from "../DeviceQuotaComplianceReport"

describe("DeviceQuotaComplianceReport", () => {
  it("renders plain-object query errors inline", () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      error: { message: "RPC denied" },
    })

    render(
      <DeviceQuotaComplianceReport
        decisionId={123}
        facilityName="Bệnh viện Đa khoa Trung ương"
        decisionNumber="123/QĐ-BYT"
      />,
    )

    expect(screen.getByText("Không thể tải báo cáo: RPC denied")).toBeInTheDocument()
  })
})
