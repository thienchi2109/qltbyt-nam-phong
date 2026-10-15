import * as React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const mockUseQuery = vi.fn()
const mockCallRpc = vi.fn()

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: (...args: unknown[]) => mockCallRpc(...args),
}))

import { DeviceQuotaComplianceReport } from "../DeviceQuotaComplianceReport"

describe("DeviceQuotaComplianceReport", () => {
  it("requests compliance detail from the regular equipment dataset", async () => {
    let queryOptions: { queryFn: () => Promise<unknown> } | undefined
    mockUseQuery.mockImplementation((options: typeof queryOptions) => {
      queryOptions = options
      return { data: [], isLoading: false, isError: false }
    })
    mockCallRpc.mockResolvedValue([])

    render(
      <DeviceQuotaComplianceReport
        decisionId={123}
        facilityName="Bệnh viện Đa khoa Trung ương"
        decisionNumber="123/QĐ-BYT"
      />
    )

    await queryOptions?.queryFn()
    expect(mockCallRpc).toHaveBeenCalledWith({
      fn: "dinh_muc_compliance_detail",
      args: {
        p_quyet_dinh_id: 123,
        p_don_vi: null,
        p_equipment_dataset: "regular",
      },
    })
  })

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
      />
    )

    expect(screen.getByText("Không thể tải báo cáo: RPC denied")).toBeInTheDocument()
  })
})
