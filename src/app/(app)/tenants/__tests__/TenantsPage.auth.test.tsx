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

vi.mock("@/components/tenants-management", () => ({
  TenantsManagement: () => <div data-testid="tenants-management">Tenants Management</div>,
}))

import TenantsPage from "../page"

describe("TenantsPage auth wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows the auth fallback while the session is loading", () => {
    mocks.useSession.mockReturnValue({
      status: "loading",
      data: null,
    })

    render(<TenantsPage />)

    expect(screen.getByTestId("authenticated-page-skeleton-fallback")).toBeInTheDocument()
    expect(screen.queryByTestId("tenants-management")).not.toBeInTheDocument()
  })

  it("shows the auth fallback without rendering tenants management when unauthenticated", () => {
    mocks.useSession.mockReturnValue({
      status: "unauthenticated",
      data: null,
    })

    render(<TenantsPage />)

    expect(screen.getByTestId("authenticated-page-skeleton-fallback")).toBeInTheDocument()
    expect(screen.queryByTestId("tenants-management")).not.toBeInTheDocument()
  })

  it("renders tenants management once the session is authenticated", () => {
    mocks.useSession.mockReturnValue({
      status: "authenticated",
      data: {
        user: {
          id: "user-1",
          role: "global",
        },
      },
    })

    render(<TenantsPage />)

    expect(screen.getByTestId("tenants-management")).toBeInTheDocument()
    expect(screen.queryByTestId("authenticated-page-skeleton-fallback")).not.toBeInTheDocument()
  })
})
