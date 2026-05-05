import * as React from "react"
import "@testing-library/jest-dom"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

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

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mocks.rpc(...args),
  },
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
      data: {
        success: true,
        message: "Đã thay đổi mật khẩu thành công với mã hóa bảo mật.",
      },
      error: null,
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

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(mocks.updateSession).toHaveBeenCalledWith({
      pending_signout_reason: "forced_password_change",
    })
  })
})
