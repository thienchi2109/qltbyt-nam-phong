import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  callRpc: vi.fn(),
}))

vi.mock("next-auth/react", () => ({
  useSession: () => mocks.useSession(),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: (...args: unknown[]) => mocks.callRpc(...args),
}))

import { TenantSelectionProvider, useTenantSelection } from "@/contexts/TenantSelectionContext"

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function TenantSelectionProbe() {
  const { showSelector, shouldFetchData, selectedFacilityId } = useTenantSelection()

  return (
    <>
      <div data-testid="show-selector">{String(showSelector)}</div>
      <div data-testid="should-fetch-data">{String(shouldFetchData)}</div>
      <div data-testid="selected-facility-id">{String(selectedFacilityId)}</div>
    </>
  )
}

describe("TenantSelectionProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    mocks.callRpc.mockResolvedValue([])
    mocks.useSession.mockReturnValue({
      data: { user: { id: "u1", role: "user" } },
      status: "authenticated",
    })
  })

  it("blocks data bootstrap while the session is still loading for non-privileged users", () => {
    mocks.useSession.mockReturnValue({
      data: { user: { id: "u1", role: "user" } },
      status: "loading",
    })

    render(
      <TenantSelectionProvider>
        <TenantSelectionProbe />
      </TenantSelectionProvider>,
      { wrapper: createWrapper() }
    )

    expect(screen.getByTestId("show-selector")).toHaveTextContent("false")
    expect(screen.getByTestId("should-fetch-data")).toHaveTextContent("false")
  })

  it("unblocks data bootstrap once a non-privileged session is authenticated", () => {
    render(
      <TenantSelectionProvider>
        <TenantSelectionProbe />
      </TenantSelectionProvider>,
      { wrapper: createWrapper() }
    )

    expect(screen.getByTestId("show-selector")).toHaveTextContent("false")
    expect(screen.getByTestId("should-fetch-data")).toHaveTextContent("true")
  })

  it("keeps privileged users blocked until facility selection is resolved", () => {
    mocks.useSession.mockReturnValue({
      data: { user: { id: "u1", role: "global" } },
      status: "authenticated",
    })

    render(
      <TenantSelectionProvider>
        <TenantSelectionProbe />
      </TenantSelectionProvider>,
      { wrapper: createWrapper() }
    )

    expect(screen.getByTestId("show-selector")).toHaveTextContent("true")
    expect(screen.getByTestId("selected-facility-id")).toHaveTextContent("undefined")
    expect(screen.getByTestId("should-fetch-data")).toHaveTextContent("false")
  })
})
