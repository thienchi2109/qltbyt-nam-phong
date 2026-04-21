import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  useSession: vi.fn(),
}))

vi.mock("next-auth/react", () => ({
  useSession: () => mocks.useSession(),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => "/repair-requests",
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace,
  }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-classname={className} data-testid="repair-requests-client-skeleton" />
  ),
}))

import RepairRequestsPageClient from "../_components/RepairRequestsPageClient"

describe("RepairRequestsPageClient auth handling", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("does not redirect unauthenticated users from the feature client", () => {
    mocks.useSession.mockReturnValue({
      status: "unauthenticated",
      data: null,
    })

    render(<RepairRequestsPageClient />)

    expect(screen.getAllByTestId("repair-requests-client-skeleton")).toHaveLength(2)
    expect(mocks.push).not.toHaveBeenCalled()
  })
})
