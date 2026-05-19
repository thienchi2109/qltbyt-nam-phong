import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
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

import type { SuggestMappingStatus, SaveStatus } from "../_hooks/useSuggestMapping"
import { SuggestedMappingPreviewDialog } from "../_components/SuggestedMappingPreviewDialog"

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    React.createElement(QueryClientProvider, { client: queryClient }, ui),
  )
}

function setupHook(overrides: {
  canRetry?: boolean
  error?: string | null
  processedUniqueNames?: number
  progress?: number
  retryFailedJob?: () => void
  saveStatus?: SaveStatus
  status?: SuggestMappingStatus
  totalUniqueNames?: number
} = {}) {
  const reset = vi.fn()
  const saveBatch = vi.fn()
  mockUseSuggestMapping.mockReturnValue({
    canRetry: false,
    error: null,
    processedUniqueNames: 0,
    progress: 0,
    reset,
    result: null,
    retryFailedJob: vi.fn(),
    saveBatch,
    saveError: null,
    saveResult: null,
    saveStatus: "idle",
    status: "starting-job",
    totalUniqueNames: 0,
    ...overrides,
  })
}

describe("SuggestedMappingPreviewDialog async job UX", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockToast.mockClear()
  })

  it("shows immediate loading progress while starting async job", () => {
    setupHook({ status: "starting-job" })

    renderWithQueryClient(
      <SuggestedMappingPreviewDialog
        open={true}
        onOpenChange={() => { }}
        donViId={1}
        userRole="admin"
      />,
    )

    expect(screen.getByText(/đang chuẩn bị gợi ý/i)).toBeInTheDocument()
    expect(screen.getByText(/chỉ tiếp tục khi hộp thoại/i)).toBeInTheDocument()
  })

  it("shows unique-name progress while processing async job", () => {
    setupHook({
      processedUniqueNames: 2,
      progress: 40,
      status: "processing",
      totalUniqueNames: 5,
    })

    renderWithQueryClient(
      <SuggestedMappingPreviewDialog
        open={true}
        onOpenChange={() => { }}
        donViId={1}
        userRole="admin"
      />,
    )

    expect(screen.getByText(/đang xử lý gợi ý/i)).toBeInTheDocument()
    expect(screen.getByText(/2.*\/.*5.*tên thiết bị/i)).toBeInTheDocument()
  })

  it("shows retry action for failed async jobs", () => {
    const retryFailedJob = vi.fn()
    setupHook({
      canRetry: true,
      error: "VM timeout",
      retryFailedJob,
      status: "error",
    })

    renderWithQueryClient(
      <SuggestedMappingPreviewDialog
        open={true}
        onOpenChange={() => { }}
        donViId={1}
        userRole="admin"
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /thử lại/i }))

    expect(retryFailedJob).toHaveBeenCalledTimes(1)
  })
})
