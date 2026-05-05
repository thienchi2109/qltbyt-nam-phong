import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockCallRpc = vi.fn()
const mockUseSession = vi.fn()

vi.mock("@/lib/rpc-client", () => ({
  callRpc: (...args: unknown[]) => mockCallRpc(...args),
}))

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}))

import { KPICards } from "@/components/dashboard/kpi-cards"

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe("KPICards", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("React", React)
    mockUseSession.mockReturnValue({
      data: { user: { id: "42", role: "global", dia_ban_id: null } },
      status: "authenticated",
    })
    mockCallRpc.mockResolvedValue({
      totalEquipment: 12,
      maintenanceCount: 3,
      repairRequests: {
        total: 2,
        pending: 1,
        approved: 1,
        completed: 5,
      },
      maintenancePlans: {
        total: 4,
        draft: 2,
        approved: 2,
        plans: [],
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("loads all KPI cards through one dashboard summary RPC", async () => {
    render(<KPICards />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByLabelText("12 thiết bị")).toBeInTheDocument()
      expect(screen.getByLabelText("3 thiết bị cần bảo trì")).toBeInTheDocument()
      expect(screen.getByLabelText("2 yêu cầu sửa chữa")).toBeInTheDocument()
      expect(screen.getByLabelText("4 kế hoạch bảo trì, hiệu chuẩn, kiểm định")).toBeInTheDocument()
    })

    expect(mockCallRpc).toHaveBeenCalledTimes(1)
    expect(mockCallRpc).toHaveBeenCalledWith({
      fn: "dashboard_kpi_summary",
    })
  })

  it("waits for an authenticated session before bootstrapping the shared dashboard summary RPC", async () => {
    const sessionState = {
      data: { user: { id: 1, role: "global" } },
      status: "loading",
    }
    mockUseSession.mockImplementation(() => sessionState)
    mockCallRpc.mockResolvedValue({
      totalEquipment: 12,
      maintenanceCount: 3,
      repairRequests: { total: 2, pending: 1, approved: 1, completed: 0 },
      maintenancePlans: {
        total: 4,
        draft: 2,
        approved: 2,
        plans: [],
      },
    })

    const { rerender } = render(<KPICards />, { wrapper: createWrapper() })

    expect(mockCallRpc).not.toHaveBeenCalled()

    sessionState.status = "authenticated"
    rerender(<KPICards />)

    await waitFor(() => {
      expect(mockCallRpc).toHaveBeenCalledTimes(1)
    })
    expect(mockCallRpc).toHaveBeenCalledWith({
      fn: "dashboard_kpi_summary",
    })
  })
})
