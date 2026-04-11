/**
 * Tests for RecentActivitiesCard dashboard widget.
 * Covers loading, empty, populated states and the adapter logic.
 * @module components/dashboard/__tests__/RecentActivitiesCard.test
 */
import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock next-auth session
vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { role: "global", don_vi: null } },
    status: "authenticated",
  }),
}))

// Mock RPC client — controls what data the hook returns
const mockCallRpc = vi.fn()
const mockToast = vi.fn()
vi.mock("@/lib/rpc-client", () => ({
  callRpc: (...args: unknown[]) => mockCallRpc(...args),
}))
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

import { RecentActivitiesCard } from "@/components/dashboard/RecentActivitiesCard"
import type { RecentActivity } from "@/hooks/use-recent-activities"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

const sampleActivities: RecentActivity[] = [
  {
    activity_id: 101,
    action_type: "repair_request_create",
    action_label: "Tạo yêu cầu sửa chữa",
    entity_type: "repair_request",
    entity_label: "YCSC-20260410-001",
    actor_name: "Nguyễn Văn A",
    facility_name: "Bệnh viện Quận 1",
    occurred_at: new Date(Date.now() - 10 * 60_000).toISOString(),
  },
  {
    activity_id: 102,
    action_type: "transfer_request_complete",
    action_label: "Hoàn thành luân chuyển",
    entity_type: "transfer_request",
    entity_label: "YCLC-20260409-122",
    actor_name: "Trần Văn B",
    facility_name: null,
    occurred_at: new Date(Date.now() - 60 * 60_000).toISOString(),
  },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RecentActivitiesCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockToast.mockReset()
  })

  it("renders card header with title", async () => {
    mockCallRpc.mockResolvedValue([])
    render(<RecentActivitiesCard />, { wrapper: createWrapper() })

    expect(screen.getByText("Hoạt động gần đây")).toBeInTheDocument()
    expect(
      screen.getByText(/các thao tác đáng chú ý/i)
    ).toBeInTheDocument()
  })

  it("renders empty state when no activities", async () => {
    mockCallRpc.mockResolvedValue([])
    render(<RecentActivitiesCard />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText(/chưa có lịch sử/i)).toBeInTheDocument()
    })
  })

  it("renders timeline entries with action labels and actor names", async () => {
    mockCallRpc.mockResolvedValue(sampleActivities)
    render(<RecentActivitiesCard />, { wrapper: createWrapper() })

    await waitFor(() => {
      // Action labels (with emoji prefix from adapter)
      expect(
        screen.getByText(/Tạo yêu cầu sửa chữa/)
      ).toBeInTheDocument()
      expect(
        screen.getByText(/Hoàn thành luân chuyển/)
      ).toBeInTheDocument()
    })

    // Actor names
    expect(screen.getByText("Nguyễn Văn A")).toBeInTheDocument()
    expect(screen.getByText("Trần Văn B")).toBeInTheDocument()
  })

  it("renders entity labels in detail rows", async () => {
    mockCallRpc.mockResolvedValue(sampleActivities)
    render(<RecentActivitiesCard />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText("YCSC-20260410-001")).toBeInTheDocument()
      expect(screen.getByText("YCLC-20260409-122")).toBeInTheDocument()
    })
  })

  it("renders facility name for multi-tenant entries", async () => {
    mockCallRpc.mockResolvedValue(sampleActivities)
    render(<RecentActivitiesCard />, { wrapper: createWrapper() })

    await waitFor(() => {
      // First entry has facility_name
      expect(screen.getByText("Bệnh viện Quận 1")).toBeInTheDocument()
    })
  })

  it("uses relative time format (feeds show '... trước')", async () => {
    mockCallRpc.mockResolvedValue(sampleActivities)
    render(<RecentActivitiesCard />, { wrapper: createWrapper() })

    await waitFor(() => {
      // At least one relative timestamp should render
      const relativeTimestamps = screen.getAllByText(/trước/i)
      expect(relativeTimestamps.length).toBeGreaterThanOrEqual(1)
    })
  })

  it("shows an error state and toast when the RPC fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockCallRpc.mockRejectedValue(new Error("RPC failed"))

    render(<RecentActivitiesCard />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          title: "Lỗi tải dữ liệu",
          description: "RPC failed",
        }),
      )
    })

    expect(screen.getByText(/không thể tải hoạt động gần đây/i)).toBeInTheDocument()
    expect(screen.queryByText(/chưa có lịch sử/i)).not.toBeInTheDocument()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "RecentActivitiesCard: failed to load recent activities",
      expect.any(Error),
    )

    consoleErrorSpy.mockRestore()
  })
})
