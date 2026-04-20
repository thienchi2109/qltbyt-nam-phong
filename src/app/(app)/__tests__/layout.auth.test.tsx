import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`)
  }),
  shell: vi.fn(
    ({
      user,
      children,
    }: {
      user: { full_name?: string | null; username?: string | null }
      children: React.ReactNode
    }) => (
      <div>
        <div data-testid="shell-user">{user.full_name ?? user.username}</div>
        <div data-testid="shell-children">{children}</div>
      </div>
    )
  ),
}))

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mocks.getServerSession(...args),
}))

vi.mock("next/navigation", () => ({
  redirect: (path: string) => mocks.redirect(path),
}))

vi.mock("@/app/(app)/_components/AppLayoutShell", () => ({
  AppLayoutShell: (props: {
    user: { full_name?: string | null; username?: string | null }
    children: React.ReactNode
  }) => mocks.shell(props),
}))

import AppLayout from "@/app/(app)/layout"
import { authOptions } from "@/auth/config"

describe("AppLayout auth gate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("redirects unauthenticated requests to the login page", async () => {
    mocks.getServerSession.mockResolvedValue(null)

    await expect(AppLayout({ children: <div>Child</div> })).rejects.toThrow("NEXT_REDIRECT:/")

    expect(mocks.getServerSession).toHaveBeenCalledWith(authOptions)
    expect(mocks.redirect).toHaveBeenCalledWith("/")
    expect(mocks.shell).not.toHaveBeenCalled()
  })

  it("renders the app shell for authenticated users", async () => {
    mocks.getServerSession.mockResolvedValue({
      user: {
        role: "global",
        full_name: "Authenticated User",
        username: "auth-user",
        khoa_phong: "IT",
      },
    })

    render(await AppLayout({ children: <div>Protected Child</div> }))

    expect(mocks.getServerSession).toHaveBeenCalledWith(authOptions)
    expect(mocks.redirect).not.toHaveBeenCalled()
    expect(screen.getByTestId("shell-user")).toHaveTextContent("Authenticated User")
    expect(screen.getByTestId("shell-children")).toHaveTextContent("Protected Child")
  })
})
