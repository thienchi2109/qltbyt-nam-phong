import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  useSession: vi.fn(),
}))

vi.mock("next-auth/react", () => ({
  useSession: () => mocks.useSession(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
  }),
}))

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: (props: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="maintenance-page-skeleton" {...props} />
  ),
}))

vi.mock("../_components/MaintenanceContext", () => ({
  MaintenanceProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="maintenance-provider">{children}</div>
  ),
}))

vi.mock("../_components/MaintenancePageClient", () => ({
  MaintenancePageClient: () => <div data-testid="maintenance-page-client">Maintenance Page Client</div>,
}))

import MaintenancePage from "../page"

describe("MaintenancePage auth wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("keeps the loading fallback visible without redirecting unauthenticated users", () => {
    mocks.useSession.mockReturnValue({
      status: "unauthenticated",
      data: null,
    })

    render(<MaintenancePage />)

    expect(screen.getAllByTestId("maintenance-page-skeleton").length).toBeGreaterThan(0)
    expect(screen.queryByTestId("maintenance-provider")).not.toBeInTheDocument()
    expect(screen.queryByTestId("maintenance-page-client")).not.toBeInTheDocument()
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it("mounts the maintenance wrapper once the session is authenticated", () => {
    mocks.useSession.mockReturnValue({
      status: "authenticated",
      data: { user: { id: "user-1", role: "to_qltb" } },
    })

    render(<MaintenancePage />)

    expect(screen.getByTestId("maintenance-provider")).toBeInTheDocument()
    expect(screen.getByTestId("maintenance-page-client")).toBeInTheDocument()
    expect(screen.queryByTestId("maintenance-page-skeleton")).not.toBeInTheDocument()
    expect(mocks.push).not.toHaveBeenCalled()
  })
})
