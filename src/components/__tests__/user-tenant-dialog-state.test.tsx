import * as React from "react"
import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"

import type { UserSummary } from "@/types/database"
import { EditTenantDialog, type TenantRow } from "../edit-tenant-dialog"
import { EditUserDialog } from "../edit-user-dialog"

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: vi.fn(),
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    disabled,
    onClick,
    type,
  }: {
    children: React.ReactNode
    disabled?: boolean
    onClick?: React.MouseEventHandler<HTMLButtonElement>
    type?: "button" | "submit" | "reset"
  }) => (
    <button disabled={disabled} onClick={onClick} type={type}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/input", () => ({
  Input: ({
    disabled,
    id,
    onChange,
    placeholder,
    type,
    value,
  }: {
    disabled?: boolean
    id: string
    onChange?: React.ChangeEventHandler<HTMLInputElement>
    placeholder?: string
    type?: string
    value?: string
  }) => (
    <input
      disabled={disabled}
      id={id}
      onChange={onChange}
      placeholder={placeholder}
      type={type}
      value={value}
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

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    disabled,
    id,
    onCheckedChange,
  }: {
    checked?: boolean
    disabled?: boolean
    id?: string
    onCheckedChange?: (checked: boolean) => void
  }) => (
    <input
      checked={checked}
      disabled={disabled}
      id={id}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
      type="checkbox"
    />
  ),
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}))

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
}

const user: UserSummary = {
  id: 7,
  username: "nva",
  full_name: "Nguyen Van A",
  role: "user",
  khoa_phong: "Khoa A",
  created_at: "2026-05-28T00:00:00Z",
}

const tenant: TenantRow = {
  id: 3,
  code: "BV-A",
  name: "Bệnh viện A",
  active: true,
  membership_quota: 10,
  logo_url: null,
  google_drive_folder_url: null,
  used_count: 1,
}

describe("shared edit dialogs preserve in-progress drafts", () => {
  it("does not overwrite an edited user draft when the same user prop refreshes", () => {
    const { rerender } = renderWithQueryClient(
      <EditUserDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} user={user} />
    )

    fireEvent.change(screen.getByLabelText("Tên đăng nhập *"), {
      target: { value: "draft-username" },
    })

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <EditUserDialog
          open
          onOpenChange={vi.fn()}
          onSuccess={vi.fn()}
          user={{ ...user, full_name: "Nguyen Van A refreshed" }}
        />
      </QueryClientProvider>
    )

    expect(screen.getByLabelText("Tên đăng nhập *")).toHaveValue("draft-username")
  })

  it("does not overwrite an edited tenant draft when the same tenant prop refreshes", () => {
    const { rerender } = renderWithQueryClient(
      <EditTenantDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} tenant={tenant} />
    )

    fireEvent.change(screen.getByLabelText("Tên đơn vị *"), {
      target: { value: "Tên đơn vị đang nhập" },
    })

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <EditTenantDialog
          open
          onOpenChange={vi.fn()}
          onSuccess={vi.fn()}
          tenant={{ ...tenant, code: "BV-A-REFRESH" }}
        />
      </QueryClientProvider>
    )

    expect(screen.getByLabelText("Tên đơn vị *")).toHaveValue("Tên đơn vị đang nhập")
  })
})
