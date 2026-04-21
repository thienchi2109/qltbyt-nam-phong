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

vi.mock("../_components/TransfersPageContent", () => ({
  TransfersPageContent: ({ user }: { user: { username?: string | null } }) => (
    <div data-testid="transfers-page-content">{user.username ?? "missing-user"}</div>
  ),
}))

import TransfersPage from "../page"

describe("TransfersPage auth wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows the loading spinner without redirecting unauthenticated users", () => {
    mocks.useSession.mockReturnValue({
      status: "unauthenticated",
      data: null,
    })

    render(<TransfersPage />)

    expect(screen.getByTestId("authenticated-page-spinner-fallback")).toBeInTheDocument()
    expect(screen.queryByTestId("transfers-page-content")).not.toBeInTheDocument()
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it("renders the transfers content once the session is authenticated", () => {
    mocks.useSession.mockReturnValue({
      status: "authenticated",
      data: {
        user: {
          id: "user-1",
          username: "transfers-user",
          role: "global",
        },
      },
    })

    render(<TransfersPage />)

    expect(screen.getByTestId("transfers-page-content")).toHaveTextContent("transfers-user")
    expect(mocks.push).not.toHaveBeenCalled()
  })
})
