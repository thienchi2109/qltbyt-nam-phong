import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { LoginForm } from "@/app/_components/LoginForm"
import { LanguageProvider } from "@/contexts/language-context"

const mocks = vi.hoisted(() => ({
  routerReplace: vi.fn(),
  signIn: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.routerReplace,
  }),
}))

vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => mocks.signIn(...args),
}))

vi.mock("@/components/icons", () => ({
  Logo: () => "Logo",
}))

vi.mock("@/app/_components/LoginIllustrationPanel", () => ({
  LoginIllustrationPanel: () => null,
}))

function renderLoginForm(): ReturnType<typeof render> {
  return render(
    <LanguageProvider>
      <LoginForm />
    </LanguageProvider>,
  )
}

describe("LoginForm", () => {
  beforeEach(() => {
    mocks.routerReplace.mockReset()
    mocks.signIn.mockReset()
  })

  it("blocks empty credentials with localized validation messages", async () => {
    const user = userEvent.setup()
    renderLoginForm()

    await user.click(screen.getByRole("button", { name: /đăng nhập/i }))

    expect(mocks.signIn).not.toHaveBeenCalled()
    expect(await screen.findByText("Vui lòng nhập tên đăng nhập")).toBeInTheDocument()
    expect(screen.getByText("Vui lòng nhập mật khẩu")).toBeInTheDocument()
  })

  it("surfaces distinct server credential errors in an accessible alert", async () => {
    const user = userEvent.setup()
    mocks.signIn.mockResolvedValueOnce({ error: "tenant_inactive" })
    renderLoginForm()

    await user.type(screen.getByLabelText(/tên đăng nhập/i), "to-qltb")
    await user.type(screen.getByLabelText(/mật khẩu/i), "secret")
    await user.click(screen.getByRole("button", { name: /đăng nhập/i }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveAttribute("aria-live", "polite")
    expect(alert).toHaveTextContent("Đơn vị đang tạm ngưng đăng nhập")
  })

  it("maps rpc and invalid credential errors without collapsing them into one string", async () => {
    const user = userEvent.setup()
    mocks.signIn
      .mockResolvedValueOnce({ error: "rpc_error" })
      .mockResolvedValueOnce({ error: "invalid_credentials" })
    renderLoginForm()

    await user.type(screen.getByLabelText(/tên đăng nhập/i), "to-qltb")
    await user.type(screen.getByLabelText(/mật khẩu/i), "secret")
    await user.click(screen.getByRole("button", { name: /đăng nhập/i }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không thể xác thực lúc này. Vui lòng thử lại sau.",
    )

    await user.click(screen.getByRole("button", { name: /đăng nhập/i }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Tên đăng nhập hoặc mật khẩu không đúng",
    )
  })

  it("maps rate-limited credentials to temporary lockout guidance", async () => {
    const user = userEvent.setup()
    mocks.signIn.mockResolvedValueOnce({ error: "rate_limited" })
    renderLoginForm()

    await user.type(screen.getByLabelText(/tên đăng nhập/i), "to-qltb")
    await user.type(screen.getByLabelText(/mật khẩu/i), "secret")
    await user.click(screen.getByRole("button", { name: /đăng nhập/i }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Đăng nhập tạm khóa do nhập sai quá nhiều lần. Vui lòng thử lại sau 30 phút hoặc liên hệ quản trị viên để reset mật khẩu.",
    )
  })

  it("maps unexpected signIn failures to the system error message", async () => {
    const user = userEvent.setup()
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    mocks.signIn.mockRejectedValueOnce(new Error("network unavailable"))
    renderLoginForm()

    await user.type(screen.getByLabelText(/tên đăng nhập/i), "to-qltb")
    await user.type(screen.getByLabelText(/mật khẩu/i), "secret")
    await user.click(screen.getByRole("button", { name: /đăng nhập/i }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không thể xác thực lúc này. Vui lòng thử lại sau.",
    )
    consoleErrorSpy.mockRestore()
  })

  it("submits valid credentials through NextAuth and keeps password manager hints", async () => {
    const user = userEvent.setup()
    mocks.signIn.mockResolvedValueOnce({ ok: true, error: null })
    renderLoginForm()

    const usernameInput = screen.getByLabelText(/tên đăng nhập/i)
    const passwordInput = screen.getByLabelText(/mật khẩu/i)

    expect(usernameInput).toHaveAttribute("autocomplete", "username")
    expect(passwordInput).toHaveAttribute("autocomplete", "current-password")

    await user.type(usernameInput, "to-qltb")
    await user.type(passwordInput, "secret")
    await user.click(screen.getByRole("button", { name: /đăng nhập/i }))

    await waitFor(() => {
      expect(mocks.signIn).toHaveBeenCalledWith("credentials", {
        username: "to-qltb",
        password: "secret",
        redirect: false,
      })
    })
    expect(mocks.routerReplace).toHaveBeenCalledWith("/dashboard")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("keeps login controls unavailable after successful credentials while dashboard redirect is pending", async () => {
    const user = userEvent.setup()
    let resolveSignIn: (value: { ok: boolean; error: null }) => void = () => undefined
    mocks.signIn.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSignIn = resolve
      }),
    )
    renderLoginForm()

    await user.type(screen.getByLabelText(/tên đăng nhập/i), "to-qltb")
    await user.type(screen.getByLabelText(/mật khẩu/i), "secret")
    await user.click(screen.getByRole("button", { name: /đăng nhập/i }))

    expect(screen.getByRole("button", { name: /đang xác thực/i })).toBeDisabled()

    resolveSignIn({ ok: true, error: null })

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /đang xác thực/i })).toBeDisabled()
    })
    expect(mocks.routerReplace).toHaveBeenCalledWith("/dashboard")
    expect(screen.queryByRole("button", { name: /^đăng nhập/i })).not.toBeInTheDocument()
  })
})
