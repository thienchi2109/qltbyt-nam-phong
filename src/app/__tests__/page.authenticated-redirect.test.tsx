import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`)
  }),
  loginForm: vi.fn(() => <div data-testid="login-form">login form</div>),
}))

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mocks.getServerSession(...args),
}))

vi.mock("next/navigation", () => ({
  redirect: (path: string) => mocks.redirect(path),
}))

vi.mock("@/app/_components/LoginForm", () => ({
  LoginForm: () => mocks.loginForm(),
}))

import LoginPage from "@/app/page"
import { authOptions } from "@/auth/config"

describe("LoginPage authenticated redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    ["global", "/dashboard"],
    ["admin", "/dashboard"],
    ["regional_leader", "/dashboard"],
    ["to_qltb", "/dashboard"],
    ["technician", "/dashboard"],
    ["qltb_khoa", "/dashboard"],
    ["user", "/dashboard"],
    ["chuyen_gia", "/technical-configurations"],
  ])("redirects authenticated %s visitors to %s", async (role, destination) => {
    mocks.getServerSession.mockResolvedValue({
      user: {
        id: "1",
        username: "auth-user",
        role,
        full_name: "Authenticated User",
      },
    })

    await expect(LoginPage()).rejects.toThrow(`NEXT_REDIRECT:${destination}`)

    expect(mocks.getServerSession).toHaveBeenCalledWith(authOptions)
    expect(mocks.redirect).toHaveBeenCalledWith(destination)
    expect(mocks.loginForm).not.toHaveBeenCalled()
  })

  it("renders the login form when there is no session", async () => {
    mocks.getServerSession.mockResolvedValue(null)

    render(await LoginPage())

    expect(mocks.getServerSession).toHaveBeenCalledWith(authOptions)
    expect(mocks.redirect).not.toHaveBeenCalled()
    expect(screen.getByTestId("login-form")).toBeInTheDocument()
  })

  it("renders the login form when the session has no user", async () => {
    mocks.getServerSession.mockResolvedValue({})

    render(await LoginPage())

    expect(mocks.redirect).not.toHaveBeenCalled()
    expect(screen.getByTestId("login-form")).toBeInTheDocument()
  })

  it("renders the login form when the session user is missing an id", async () => {
    mocks.getServerSession.mockResolvedValue({
      user: {
        username: "",
        role: "",
      },
    })

    render(await LoginPage())

    expect(mocks.redirect).not.toHaveBeenCalled()
    expect(screen.getByTestId("login-form")).toBeInTheDocument()
  })
})
