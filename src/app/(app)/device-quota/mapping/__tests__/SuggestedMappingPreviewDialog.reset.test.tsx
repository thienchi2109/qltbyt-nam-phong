import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import type { SuggestMappingResult, SuggestedGroup } from "../_hooks/useSuggestMapping"
import { SuggestedMappingPreviewDialog } from "../_components/SuggestedMappingPreviewDialog"

beforeAll(() => {
    Object.defineProperty(globalThis, "matchMedia", {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    })
})

const mockUseSuggestMapping = vi.fn()
vi.mock("../_hooks/useSuggestMapping", () => ({
    useSuggestMapping: (...args: unknown[]) => mockUseSuggestMapping(...args),
}))

const mockToast = vi.hoisted(() => vi.fn())
vi.mock("@/hooks/use-toast", () => ({
    useToast: () => ({ toast: mockToast }),
}))

const GROUP_A: SuggestedGroup = {
    nhom_id: 10,
    nhom_label: "Máy thở chức năng cao",
    nhom_code: "A.01",
    phan_loai: "Loại B",
    rrf_score: 0.95,
    device_names: ["Máy thở Drager", "Máy thở Hamilton"],
    device_ids: [1, 2, 3, 4, 5],
    device_name_to_ids: {
        "Máy thở Drager": [1, 2, 3],
        "Máy thở Hamilton": [4, 5],
    },
}

const GROUP_B: SuggestedGroup = {
    nhom_id: 20,
    nhom_label: "Bơm tiêm điện tự động",
    nhom_code: "B.02",
    phan_loai: "Loại C",
    rrf_score: 0.88,
    device_names: ["Bơm tiêm điện"],
    device_ids: [6, 7],
    device_name_to_ids: {
        "Bơm tiêm điện": [6, 7],
    },
}

const DONE_RESULT: SuggestMappingResult = {
    groups: [GROUP_A, GROUP_B],
    unmatched: [],
    totalDevices: 7,
    matchedDevices: 7,
}

function setupHook() {
    mockUseSuggestMapping.mockReturnValue({
        status: "done",
        result: DONE_RESULT,
        error: null,
        canRetry: false,
        progress: 100,
        processedUniqueNames: 3,
        retryFailedJob: vi.fn(),
        reset: vi.fn(),
        saveBatch: vi.fn(),
        saveStatus: "idle",
        saveResult: null,
        saveError: null,
        totalUniqueNames: 3,
    })
}

function renderDialog(open: boolean, queryClient: QueryClient) {
    return (
        <QueryClientProvider client={queryClient}>
            <SuggestedMappingPreviewDialog
                open={open}
                onOpenChange={vi.fn()}
                donViId={1}
                userRole="admin"
            />
        </QueryClientProvider>
    )
}

describe("SuggestedMappingPreviewDialog reset behavior", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockToast.mockClear()
        setupHook()
    })

    it("resets excluded suggestions after the dialog is closed and reopened", () => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
        const { rerender } = render(renderDialog(true, queryClient))

        fireEvent.click(screen.getAllByRole("button", { name: "Loại bỏ" })[2])
        expect(screen.getByRole("button", { name: /áp dụng 1 gợi ý/i })).toBeEnabled()

        rerender(renderDialog(false, queryClient))
        rerender(renderDialog(true, queryClient))

        expect(screen.getByRole("button", { name: /áp dụng 2 gợi ý/i })).toBeEnabled()
    })
})
