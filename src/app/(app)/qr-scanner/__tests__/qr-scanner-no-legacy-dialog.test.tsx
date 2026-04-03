/**
 * qr-scanner-no-legacy-dialog.test.tsx
 *
 * TDD RED/GREEN: Asserts QR Scanner page no longer mounts the legacy
 * EditEquipmentDialog and instead navigates to /equipment?highlight={id}
 * for the 'update-status' action.
 */

import "@testing-library/jest-dom"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import * as React from "react"

// ============================================
// Mocks
// ============================================

const mockPush = vi.fn()
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mockPush }),
}))

// Intercept next/dynamic to render components synchronously
vi.mock("next/dynamic", () => ({
    __esModule: true,
    default: (
        loader: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>,
        _opts?: Record<string, unknown>
    ) => {
        // Return a wrapper that lazily resolves the real component
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

// Mock QRActionSheet: always render action buttons for testing
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
        </div>
    ),
}))

vi.mock("@/lib/repair-request-create-intent", () => ({
    buildRepairRequestCreateIntentHref: (id?: number) =>
        `/repair-requests?equipmentId=${id}`,
}))

// ============================================
// Import after mocks
// ============================================

import QRScannerPage from "../page"

// ============================================
// Tests
// ============================================

describe("QR Scanner: no legacy EditEquipmentDialog", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubGlobal("navigator", {
            mediaDevices: {
                getUserMedia: vi.fn(),
            },
        })
    })

    it("navigates to /equipment?highlight={id} on update-status action", async () => {
        render(<QRScannerPage />)

        fireEvent.click(screen.getByRole("button", { name: /bắt đầu quét/i }))
        fireEvent.click(await screen.findByTestId("qr-camera"))
        fireEvent.click(await screen.findByTestId("trigger-update-status"))

        await waitFor(() => {
            expect(mockPush).toHaveBeenCalledWith("/equipment?highlight=42")
        })
    })
})
