import * as React from "react"
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  role: "global" as string | null,
  isMonitoring: false,
  alerts: [] as Array<{
    type: "warning" | "error" | "info"
    message: string
    timestamp: string
  }>,
}))

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: state.role
      ? {
          user: {
            role: state.role,
          },
        }
      : null,
  }),
}))

vi.mock("@/hooks/use-department-performance", () => ({
  useDepartmentPerformance: () => {
    // Keep this mock as a real hook consumer so hook-order regressions surface.
    const [hookMarker] = React.useState(0)
    void hookMarker

    return {
      metrics: {
        avgQueryTime: 100,
        totalQueries: 5,
        slowQueries: 0,
        cacheHitRate: 0.95,
        totalCacheRequests: 10,
        pageLoadTime: 0,
        filterResponseTime: 0,
        departmentItemCount: 12,
        lastUpdateTime: new Date().toISOString(),
      },
      alerts: state.alerts,
      cacheScope: { scope: "department", department: "A" },
      clearAlerts: vi.fn(),
      getPerformanceSummary: () => ({ status: "good", score: 100 }),
      getOptimizationSuggestions: () => [],
      exportPerformanceData: vi.fn(),
      isMonitoring: state.isMonitoring,
    }
  },
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
}))

vi.mock("@/components/ui/progress", () => ({
  Progress: () => <div />,
}))

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { PerformanceDashboard } from "@/components/performance-dashboard"

describe("PerformanceDashboard hook stability", () => {
  it("does not throw when rerendering from monitoring-off to monitoring-on", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    try {
      state.role = "global"
      state.isMonitoring = false

      const { rerender } = render(<PerformanceDashboard />)

      state.isMonitoring = true

      expect(() => {
        rerender(<PerformanceDashboard />)
      }).not.toThrow()

      expect(errorSpy).not.toHaveBeenCalled()
    } finally {
      errorSpy.mockRestore()
    }
  })
})
