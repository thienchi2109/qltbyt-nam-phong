import React from "react"
import { render, act } from "@testing-library/react"
import "@testing-library/jest-dom"
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest"

import { DeviceQuotaCategoryImportDialog } from "../_components/DeviceQuotaCategoryImportDialog"
import { useDeviceQuotaCategoryContext } from "../_hooks/useDeviceQuotaCategoryContext"

let capturedMutationOptions: {
  onSuccess?: (result: {
    success: boolean
    inserted: number
    failed: number
    total: number
    details: Array<{ ma_nhom: string; success: boolean; error?: string }>
  }) => Promise<void> | void
} | null = null

const mockInvalidateQueries = vi.fn()

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query")

  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
    useMutation: (options: typeof capturedMutationOptions) => {
      capturedMutationOptions = options
      return {
        mutate: vi.fn(),
        isPending: false,
      }
    },
  }
})

vi.mock("../_hooks/useDeviceQuotaCategoryContext", () => ({
  useDeviceQuotaCategoryContext: vi.fn(),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

const mockUseContext = vi.mocked(useDeviceQuotaCategoryContext)

describe("DeviceQuotaCategoryImportDialog", () => {
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

  beforeEach(() => {
    vi.clearAllMocks()
    capturedMutationOptions = null

    mockUseContext.mockReturnValue({
      isImportDialogOpen: true,
      closeImportDialog: vi.fn(),
      categories: [],
      donViId: 1,
    } as any)
  })

  it("invalidates paginated and legacy category queries after successful import", async () => {
    render(<DeviceQuotaCategoryImportDialog />)

    expect(capturedMutationOptions?.onSuccess).toBeTypeOf("function")

    await act(async () => {
      await capturedMutationOptions?.onSuccess?.({
        success: true,
        inserted: 1,
        failed: 0,
        total: 1,
        details: [],
      })
    })

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["dinh_muc_nhom_list_paginated"] })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["dinh_muc_nhom_list"] })
  })
})
