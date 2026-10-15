import { act, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"
import * as React from "react"

const { mockUseSession } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
}))

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}))

import { EquipmentDialogProvider } from "../_components/EquipmentDialogContext"
import { useEquipmentContext } from "../_hooks/useEquipmentContext"

function createWrapper(onDataMutationSuccess: (datasets?: string | string[]) => void) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <EquipmentDialogProvider
          effectiveTenantKey="5"
          onDataMutationSuccess={onDataMutationSuccess}
        >
          {children}
        </EquipmentDialogProvider>
      </QueryClientProvider>
    )
  }
}

describe("EquipmentDialogContext dataset invalidation", () => {
  it("delegates dataset-aware invalidation to the page data hook", () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: 1, role: "admin", don_vi: 5, name: "Test User" } },
      status: "authenticated",
    })
    const onDataMutationSuccess = vi.fn()
    const { result } = renderHook(() => useEquipmentContext(), {
      wrapper: createWrapper(onDataMutationSuccess),
    })

    act(() => result.current.onDataMutationSuccess(["regular", "placed"]))

    expect(onDataMutationSuccess).toHaveBeenCalledWith(["regular", "placed"])
  })
})
