"use client"

import * as React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

const pendingSearchParams = new Promise<never>(() => {})

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  useRouter: vi.fn(),
  useQueryClient: vi.fn(),
  useTenantSelection: vi.fn(),
  useTransfersViewMode: vi.fn(),
  useSearchParams: vi.fn(),
}))

vi.mock("lucide-react", async () => {
  const actual = await vi.importActual<typeof import("lucide-react")>("lucide-react")
  return {
    ...actual,
    Loader2: (props: React.SVGProps<SVGSVGElement>) => (
      <svg data-testid="transfer-loading-spinner" {...props} />
    ),
  }
})

vi.mock("next-auth/react", () => ({
  useSession: () => mocks.useSession(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.useRouter(),
  useSearchParams: () => mocks.useSearchParams(),
}))

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => mocks.useQueryClient(),
  useQuery: vi.fn(),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock("@/contexts/TenantSelectionContext", () => ({
  useTenantSelection: () => mocks.useTenantSelection(),
}))

vi.mock("@/components/transfers/TransfersViewToggle", () => ({
  TransfersViewToggle: () => <div data-testid="transfers-view-toggle" />,
  useTransfersViewMode: () => mocks.useTransfersViewMode(),
}))

import TransfersPage from "@/app/(app)/transfers/page"

describe("Transfers page search params boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.useSession.mockReturnValue({
      data: {
        user: {
          id: 1,
          role: "global",
          don_vi: null,
          dia_ban_id: null,
          name: "Global Admin",
        },
      },
      status: "authenticated",
    })

    mocks.useRouter.mockReturnValue({
      push: vi.fn(),
      replace: vi.fn(),
    })

    mocks.useQueryClient.mockReturnValue({
      invalidateQueries: vi.fn(),
    })

    mocks.useTenantSelection.mockReturnValue({
      selectedFacilityId: undefined,
      setSelectedFacilityId: vi.fn(),
      facilities: [],
      showSelector: false,
      shouldFetchData: false,
      isLoading: false,
    })

    mocks.useTransfersViewMode.mockReturnValue(["table", vi.fn()])
    mocks.useSearchParams.mockImplementation(() => {
      throw pendingSearchParams
    })
  })

  it("renders the suspense spinner when transfer tab search params suspend", async () => {
    render(<TransfersPage />)

    expect(await screen.findByTestId("transfer-loading-spinner")).toBeInTheDocument()
  })
})
