/**
 * dashboard-no-legacy-dialog.test.tsx
 *
 * TDD RED: Asserts Dashboard page no longer mounts the legacy
 * EditEquipmentDialog and instead navigates to /equipment?highlight={id}
 * for the 'update-status' action.
 */

import * as React from "react"
import "@testing-library/jest-dom"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"

// ============================================
// Mocks
// ============================================

const mockPush = vi.fn()
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mockPush }),
}))

vi.mock("next-auth/react", () => ({
    useSession: () => ({
        data: {
            user: {
                id: 1,
                username: "admin",
                full_name: "Admin User",
                role: "admin",
            },
        },
        status: "authenticated",
    }),
}))

vi.mock("next/dynamic", () => ({
    __esModule: true,
    default: (
        loader: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>,
        _opts?: Record<string, unknown>
    ) => {
        const LazyWrapper = React.lazy(
            () => loader() as Promise<{ default: React.ComponentType<Record<string, unknown>> }>
        )
        const DynamicStub = (props: Record<string, unknown>) => (
            <React.Suspense fallback={null}>
                <LazyWrapper {...props} />
            </React.Suspense>
        )
        return DynamicStub
    },
}))

vi.mock("@/hooks/use-toast", () => ({
    useToast: () => ({ toast: vi.fn() }),
}))

vi.mock("@/components/qr-scanner-error-boundary", () => ({
    QRScannerErrorBoundary: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
}))

vi.mock("@/components/qr-scanner-camera", () => ({
    QRScannerCamera: ({
        onScanSuccess,
    }: {
        onScanSuccess: (value: string) => void
    }) => (
        <button
            data-testid="qr-camera"
            onClick={() => onScanSuccess("TB-001")}
        >
            Simulate scan success
        </button>
    ),
}))

vi.mock("@/components/qr-action-sheet", () => ({
    QRActionSheet: ({
        onAction,
    }: {
        onAction: (action: string, equipment?: Record<string, unknown>) => void
    }) => (
        <div data-testid="qr-action-sheet">
            <button
                data-testid="trigger-update-status"
                onClick={() =>
                    onAction("update-status", { id: 42, ten_thiet_bi: "Test Device" })
                }
            >
                Update Status
            </button>
            <button
                data-testid="trigger-update-status-missing"
                onClick={() => onAction("update-status")}
            >
                Missing Equipment
            </button>
        </div>
    ),
}))

vi.mock("@/components/ui/calendar-widget", () => ({
    CalendarWidget: () => <div data-testid="calendar-widget" />,
}))

vi.mock("@/components/dashboard/kpi-cards", () => ({
    KPICards: () => <div data-testid="kpi-cards" />,
}))

vi.mock("@/components/dashboard/dashboard-tabs", () => ({
    DashboardTabs: () => <div data-testid="dashboard-tabs" />,
}))

vi.mock("@/components/dashboard/RecentActivitiesCard", () => ({
    RecentActivitiesCard: () => <div data-testid="recent-activities-card" />,
}))

vi.mock("@/lib/repair-request-deep-link", () => ({
    buildRepairRequestCreateIntentHref: (id?: number) =>
        `/repair-requests?equipmentId=${id}`,
}))

vi.mock("@/lib/rbac", () => ({
    isRegionalLeaderRole: () => false,
}))

// ============================================
// Import after mocks
// ============================================

import Dashboard from "@/app/(app)/dashboard/page"

// ============================================
// Tests
// ============================================

describe("Dashboard: no legacy EditEquipmentDialog", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubGlobal("navigator", {
            mediaDevices: {
                getUserMedia: vi.fn(),
            },
        })
    })

    it("navigates to /equipment?highlight={id} on update-status action", async () => {
        render(<Dashboard />)

        fireEvent.click(screen.getByRole("button", { name: /quét mã qr/i }))
        fireEvent.click(await screen.findByTestId("qr-camera"))
        fireEvent.click(await screen.findByTestId("trigger-update-status"))

        await waitFor(() => {
            expect(mockPush).toHaveBeenCalledWith("/equipment?highlight=42")
        })
    })

    it("renders recent activities card alongside the calendar widget", () => {
        render(<Dashboard />)

        expect(screen.getByTestId("calendar-widget")).toBeInTheDocument()
        expect(screen.getByTestId("recent-activities-card")).toBeInTheDocument()
    })

    it("does not navigate when update-status is triggered without equipment", async () => {
        render(<Dashboard />)

        fireEvent.click(screen.getByRole("button", { name: /quét mã qr/i }))
        fireEvent.click(await screen.findByTestId("qr-camera"))
        fireEvent.click(await screen.findByTestId("trigger-update-status-missing"))

        await waitFor(() => {
            expect(mockPush).not.toHaveBeenCalled()
        })
    })
})
