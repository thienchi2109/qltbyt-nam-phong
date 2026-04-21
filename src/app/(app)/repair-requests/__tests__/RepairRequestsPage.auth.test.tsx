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

vi.mock("../_components/RepairRequestsPageClient", () => ({
  default: () => <div data-testid="repair-requests-page-client">Repair requests</div>,
}))

import RepairRequestsPage from "../page"

describe("RepairRequestsPage auth wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows the skeleton fallback without redirecting unauthenticated users", () => {
    mocks.useSession.mockReturnValue({
      status: "unauthenticated",
      data: null,
    })

    render(<RepairRequestsPage />)

    expect(screen.getByTestId("authenticated-page-skeleton-fallback")).toBeInTheDocument()
    expect(screen.queryByTestId("repair-requests-page-client")).not.toBeInTheDocument()
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it("renders the repair requests client once the session is authenticated", () => {
    mocks.useSession.mockReturnValue({
      status: "authenticated",
      data: {
        user: {
          id: "user-1",
          username: "repair-user",
          role: "global",
        },
      },
    })

    render(<RepairRequestsPage />)

    expect(screen.getByTestId("repair-requests-page-client")).toHaveTextContent(
      "Repair requests"
    )
    expect(mocks.push).not.toHaveBeenCalled()
  })
})
