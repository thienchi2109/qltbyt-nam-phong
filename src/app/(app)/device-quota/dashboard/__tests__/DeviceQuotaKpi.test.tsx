import * as React from "react"
import "@testing-library/jest-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

const mocks = vi.hoisted(() => ({
  deviceQuotaConfigs: [
    { key: "dat", label: "Đạt định mức", tone: "success", icon: null },
    { key: "thieu", label: "Thiếu định mức", tone: "danger", icon: null },
    { key: "vuot", label: "Vượt định mức", tone: "warning", icon: null },
  ],
  useDeviceQuotaDashboardContext: vi.fn(),
  KpiStatusBar: vi.fn(),
}))

vi.mock("@/app/(app)/device-quota/dashboard/_hooks/useDeviceQuotaDashboardContext", () => ({
  useDeviceQuotaDashboardContext: () => mocks.useDeviceQuotaDashboardContext(),
}))

vi.mock("@/components/kpi", () => ({
  DEVICE_QUOTA_CONFIGS: mocks.deviceQuotaConfigs,
  KpiStatusBar: mocks.KpiStatusBar,
}))

import { DeviceQuotaComplianceCards } from "@/app/(app)/device-quota/dashboard/_components/DeviceQuotaComplianceCards"

describe("DeviceQuota KPI", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.useDeviceQuotaDashboardContext.mockReturnValue({
      complianceSummary: {
        total_categories: 42,
        dat_count: 10,
        thieu_count: 12,
        vuot_count: 14,
      },
      isLoading: false,
      isError: false,
    })

    mocks.KpiStatusBar.mockImplementation(
      ({ error }: { error?: boolean }) => (
        <div data-testid={error ? "device-quota-kpi-error" : "device-quota-kpi"} />
      ),
    )
  })

  it("renders KpiStatusBar with device-quota configs", () => {
    render(<DeviceQuotaComplianceCards />)

    expect(screen.getByTestId("device-quota-kpi")).toBeInTheDocument()
    expect(
      mocks.KpiStatusBar.mock.calls.some(([props]) => props?.configs === mocks.deviceQuotaConfigs),
    ).toBe(true)
  })

  it("maps complianceSummary props to counts record", () => {
    render(<DeviceQuotaComplianceCards />)

    expect(mocks.KpiStatusBar.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        counts: {
          dat: 10,
          thieu: 12,
          vuot: 14,
        },
      }),
    )
  })

  it("uses totalOverride for total_categories", () => {
    render(<DeviceQuotaComplianceCards />)

    expect(mocks.KpiStatusBar.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        showTotal: true,
        totalLabel: "Tổng danh mục",
        totalOverride: 42,
      }),
    )
  })

  it("shows error fallback when isError=true", () => {
    mocks.useDeviceQuotaDashboardContext.mockReturnValue({
      complianceSummary: null,
      isLoading: false,
      isError: true,
    })

    render(<DeviceQuotaComplianceCards />)

    expect(screen.getByTestId("device-quota-kpi-error")).toBeInTheDocument()
    expect(mocks.KpiStatusBar.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        error: true,
      }),
    )
  })

  it("handles null complianceSummary", () => {
    mocks.useDeviceQuotaDashboardContext.mockReturnValue({
      complianceSummary: null,
      isLoading: false,
      isError: false,
    })

    render(<DeviceQuotaComplianceCards />)

    expect(mocks.KpiStatusBar.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        counts: undefined,
        totalOverride: undefined,
      }),
    )
  })
})
