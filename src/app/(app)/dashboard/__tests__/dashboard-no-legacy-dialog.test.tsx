/**
 * dashboard-no-legacy-dialog.test.tsx
 *
 * TDD RED: Asserts Dashboard page no longer mounts the legacy
 * EditEquipmentDialog and instead navigates to /equipment?highlight={id}
 * for the 'update-status' action.
 */

import "@testing-library/jest-dom"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import * as React from "react"

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
        loader: () => Promise<{ default: React.ComponentType<any> }>,
        _opts?: any
    ) => {
        const LazyWrapper = React.lazy(
            () => loader() as Promise<{ default: React.ComponentType<any> }>
        )
        const DynamicStub = (props: any) => (
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
    QRScannerCamera: () => <div data-testid="qr-camera" />,
}))

vi.mock("@/components/qr-action-sheet", () => ({
    QRActionSheet: () => <div data-testid="qr-action-sheet" />,
}))

vi.mock("@/components/edit-equipment-dialog", () => ({
    EditEquipmentDialog: () => <div data-testid="legacy-edit-dialog" />,
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

vi.mock("@/lib/repair-request-create-intent", () => ({
    buildRepairRequestCreateIntentHref: (id?: number) =>
        `/repair-requests?equipmentId=${id}`,
}))

vi.mock("@/lib/rbac", () => ({
    isRegionalLeaderRole: () => false,
}))

// ============================================
// Import after mocks
// ============================================

import Dashboard from "../page"

// ============================================
// Tests
// ============================================

describe("Dashboard: no legacy EditEquipmentDialog", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("does not render EditEquipmentDialog component", async () => {
        await act(async () => {
            render(<Dashboard />)
        })

        expect(screen.queryByTestId("legacy-edit-dialog")).not.toBeInTheDocument()
    })

    it("source does not import EditEquipmentDialog and uses router.push for update-status", async () => {
        const fs = await import("fs")
        const path = await import("path")
        const pageSource = fs.readFileSync(
            path.resolve(__dirname, "../page.tsx"),
            "utf-8"
        )

        // Must NOT call setEditingEquipment
        expect(pageSource).not.toContain("setEditingEquipment")

        // Must NOT import EditEquipmentDialog
        expect(pageSource).not.toContain("edit-equipment-dialog")

        // Must navigate via router.push for update-status
        expect(pageSource).toContain("router.push(`/equipment?highlight=")
    })
})
