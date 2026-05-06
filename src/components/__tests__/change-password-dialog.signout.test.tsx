import * as React from "react"
import "@testing-library/jest-dom"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  useSession: vi.fn(),
  signOut: vi.fn(),
  updateSession: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock("next-auth/react", () => ({
  signOut: (...args: unknown[]) => mocks.signOut(...args),
  useSession: () => mocks.useSession(),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: (...args: unknown[]) => mocks.rpc(...args),
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    type,
    disabled,
  }: {
    children: React.ReactNode
    onClick?: React.MouseEventHandler<HTMLButtonElement>
    type?: "button" | "submit" | "reset"
    disabled?: boolean
  }) => (
    <button type={type} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/input", () => ({
  Input: ({
    id,
    value,
    onChange,
    type,
    disabled,
    placeholder,
  }: {
    id: string
    value?: string
    onChange?: React.ChangeEventHandler<HTMLInputElement>
    type?: string
    disabled?: boolean
    placeholder?: string
  }) => (
    <input
      id={id}
      value={value}
      onChange={onChange}
      type={type}
      disabled={disabled}
      placeholder={placeholder}
    />
  ),
}))

vi.mock("@/components/ui/label", () => ({
  Label: ({
    children,
    htmlFor,
  }: {
    children: React.ReactNode
    htmlFor?: string
  }) => <label htmlFor={htmlFor}>{children}</label>,
}))

import { ChangePasswordDialog } from "../change-password-dialog"

describe("ChangePasswordDialog forced signout", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updateSession.mockResolvedValue(undefined)
    mocks.rpc.mockResolvedValue({
      success: true,
      message: "Đã thay đổi mật khẩu thành công với mã hóa bảo mật.",
    })
    mocks.useSession.mockReturnValue({
      data: {
        user: {
          id: "42",
          username: "tester",
        },
      },
      status: "authenticated",
      update: mocks.updateSession,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("persists the forced password-change signout reason after a successful password change", async () => {
    const onOpenChange = vi.fn()

    render(<ChangePasswordDialog open onOpenChange={onOpenChange} />)

    fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại *"), {
      target: { value: "old-password" },
    })
    fireEvent.change(screen.getByLabelText("Mật khẩu mới *"), {
      target: { value: "new-password" },
    })
    fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu mới *"), {
      target: { value: "new-password" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Thay đổi mật khẩu" }))

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Thành công",
        }),
      )
    })

    expect(mocks.rpc).toHaveBeenCalledWith({
      fn: "change_password",
      args: {
        p_user_id: 42,
        p_old_password: "old-password",
        p_new_password: "new-password",
      },
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(mocks.updateSession).toHaveBeenCalledWith({
      pending_signout_reason: "forced_password_change",
    })
  })

  it("shows a logout-specific error if post-change signout fails after the password update succeeds", async () => {
    vi.useFakeTimers()
    mocks.signOut.mockRejectedValueOnce(new Error("redirect failed"))

    render(<ChangePasswordDialog open onOpenChange={vi.fn()} />)

    fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại *"), {
      target: { value: "old-password" },
    })
    fireEvent.change(screen.getByLabelText("Mật khẩu mới *"), {
      target: { value: "new-password" },
    })
    fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu mới *"), {
      target: { value: "new-password" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Thay đổi mật khẩu" }))

    await Promise.resolve()
    await Promise.resolve()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_500)
    })
    await Promise.resolve()

    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Thành công",
      }),
    )
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        title: "Đăng xuất chưa hoàn tất",
        description: "Mật khẩu đã được thay đổi. Vui lòng đăng xuất thủ công hoặc tải lại trang.",
      }),
    )
  })

  it("preserves message details from non-Error password-change failures", async () => {
    mocks.rpc.mockRejectedValueOnce({
      message: "Supabase RPC failed",
    })

    render(<ChangePasswordDialog open onOpenChange={vi.fn()} />)

    fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại *"), {
      target: { value: "old-password" },
    })
    fireEvent.change(screen.getByLabelText("Mật khẩu mới *"), {
      target: { value: "new-password" },
    })
    fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu mới *"), {
      target: { value: "new-password" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Thay đổi mật khẩu" }))

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          title: "Lỗi",
          description: "Supabase RPC failed",
        }),
      )
    })
  })

  it("fails closed when the password-change RPC is unavailable", async () => {
    const onOpenChange = vi.fn()
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.rpc.mockRejectedValueOnce(new Error("Could not find the function public.change_password"))

    render(<ChangePasswordDialog open onOpenChange={onOpenChange} />)

    fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại *"), {
      target: { value: "old-password" },
    })
    fireEvent.change(screen.getByLabelText("Mật khẩu mới *"), {
      target: { value: "new-password" },
    })
    fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu mới *"), {
      target: { value: "new-password" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Thay đổi mật khẩu" }))

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          title: "Lỗi",
          description: "Dịch vụ đổi mật khẩu tạm thời không khả dụng. Vui lòng thử lại sau.",
        }),
      )
    })

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Password change RPC unavailable:",
      expect.any(Error),
    )
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(mocks.updateSession).not.toHaveBeenCalled()
    expect(mocks.signOut).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })
})
