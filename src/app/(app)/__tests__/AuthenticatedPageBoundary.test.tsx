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

import { AuthenticatedPageBoundary } from "@/app/(app)/_components/AuthenticatedPageBoundary"

describe("AuthenticatedPageBoundary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders the fallback while the session is loading", () => {
    mocks.useSession.mockReturnValue({
      status: "loading",
      data: null,
    })

    const children = vi.fn(() => <div data-testid="protected-content">Protected</div>)

    render(
      <AuthenticatedPageBoundary fallback={<div data-testid="boundary-fallback">Loading</div>}>
        {children}
      </AuthenticatedPageBoundary>
    )

    expect(screen.getByTestId("boundary-fallback")).toBeInTheDocument()
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument()
    expect(children).not.toHaveBeenCalled()
  })

  it("renders the fallback without invoking children when the user is unauthenticated", () => {
    mocks.useSession.mockReturnValue({
      status: "unauthenticated",
      data: null,
    })

    const children = vi.fn(() => <div data-testid="protected-content">Protected</div>)

    render(
      <AuthenticatedPageBoundary fallback={<div data-testid="boundary-fallback">Loading</div>}>
        {children}
      </AuthenticatedPageBoundary>
    )

    expect(screen.getByTestId("boundary-fallback")).toBeInTheDocument()
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument()
    expect(children).not.toHaveBeenCalled()
  })

  it("renders children with the authenticated session user", () => {
    const user = {
      id: "user-1",
      role: "to_qltb",
      username: "tester",
    }

    mocks.useSession.mockReturnValue({
      status: "authenticated",
      data: { user },
    })

    const children = vi.fn((sessionUser: typeof user) => (
      <div data-testid="protected-content">{sessionUser.username}</div>
    ))

    render(
      <AuthenticatedPageBoundary fallback={<div data-testid="boundary-fallback">Loading</div>}>
        {children}
      </AuthenticatedPageBoundary>
    )

    expect(screen.queryByTestId("boundary-fallback")).not.toBeInTheDocument()
    expect(screen.getByTestId("protected-content")).toHaveTextContent("tester")
    expect(children).toHaveBeenCalledWith(user)
  })
})
