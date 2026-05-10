import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
}))

vi.mock("next-auth/react", () => ({
  useSession: () => mocks.useSession(),
}))

vi.mock("../_components/UsersPageContent", () => ({
  UsersPageContent: ({ user }: { user: { username?: string | null } }) => (
    <div data-testid="users-page-content">{user.username ?? "missing-user"}</div>
  ),
}))

import UsersPage from "../page"

describe("UsersPage auth wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows the shared fallback until the session is authenticated", () => {
    mocks.useSession.mockReturnValue({
      status: "unauthenticated",
      data: null,
    })

    render(<UsersPage />)

    expect(screen.getByTestId("authenticated-page-skeleton-fallback")).toBeInTheDocument()
    expect(screen.queryByTestId("users-page-content")).not.toBeInTheDocument()
  })

  it("renders users content once the session is authenticated", () => {
    mocks.useSession.mockReturnValue({
      status: "authenticated",
      data: {
        user: {
          id: "user-1",
          username: "users-admin",
          role: "global",
        },
      },
    })

    render(<UsersPage />)

    expect(screen.getByTestId("users-page-content")).toHaveTextContent("users-admin")
  })
})
