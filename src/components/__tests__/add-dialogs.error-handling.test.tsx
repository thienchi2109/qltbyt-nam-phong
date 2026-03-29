import * as React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  callRpc: vi.fn(),
  fetchTenantList: vi.fn(),
  findCurrentTenant: vi.fn(),
  toast: vi.fn(),
  useSession: vi.fn(),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: mocks.callRpc,
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}))

vi.mock("next-auth/react", () => ({
  useSession: () => mocks.useSession(),
}))

vi.mock("../add-equipment-dialog.queries", () => ({
  fetchTenantList: mocks.fetchTenantList,
  findCurrentTenant: mocks.findCurrentTenant,
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

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string
    onValueChange?: (value: string) => void
    children: React.ReactNode
  }) => (
    <select value={value ?? ""} onChange={(event) => onValueChange?.(event.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}))

import { AddMaintenancePlanDialog } from "../add-maintenance-plan-dialog"
import { AddUserDialog } from "../add-user-dialog"

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe("dialog unknown-error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findCurrentTenant.mockReturnValue(null)
  })

  it("surfaces plain-object tenant fetch errors in AddUserDialog", async () => {
    mocks.fetchTenantList.mockRejectedValueOnce({ message: "Permission denied" })

    render(<AddUserDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />)

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          title: "Lỗi tải danh sách đơn vị",
          description: "Permission denied",
        }),
      )
    })
  })

  it("surfaces plain-object create-plan errors in AddMaintenancePlanDialog", async () => {
    mocks.useSession.mockReturnValue({
      data: {
        user: {
          role: "global",
          username: "global_user",
          full_name: "Global User",
        },
      },
      status: "authenticated",
    })
    mocks.callRpc.mockRejectedValueOnce({ message: "Permission denied" })

    render(
      <AddMaintenancePlanDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />,
      { wrapper: createWrapper() },
    )

    fireEvent.change(screen.getByLabelText("Tên kế hoạch"), {
      target: { value: "Kế hoạch bảo trì năm 2026" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Lưu kế hoạch" }))

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          title: "Lỗi",
          description: "Không thể tạo kế hoạch. Permission denied",
        }),
      )
    })
  })

  it("falls back to the base create-plan error message when the rejection has no message", async () => {
    mocks.useSession.mockReturnValue({
      data: {
        user: {
          role: "global",
          username: "global_user",
          full_name: "Global User",
        },
      },
      status: "authenticated",
    })
    mocks.callRpc.mockRejectedValueOnce({ detail: "ignored" })

    render(
      <AddMaintenancePlanDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />,
      { wrapper: createWrapper() },
    )

    fireEvent.change(screen.getByLabelText("Tên kế hoạch"), {
      target: { value: "Kế hoạch bảo trì năm 2026" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Lưu kế hoạch" }))

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          title: "Lỗi",
          description: "Không thể tạo kế hoạch.",
        }),
      )
    })
  })
})
