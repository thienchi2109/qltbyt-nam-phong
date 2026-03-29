import * as React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  callRpc: vi.fn(),
  toast: vi.fn(),
  useRouter: vi.fn(),
  useSession: vi.fn(),
  useSearchDebounce: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.useRouter(),
}))

vi.mock("next-auth/react", () => ({
  useSession: () => mocks.useSession(),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}))

vi.mock("@/hooks/use-debounce", () => ({
  useSearchDebounce: (value: string) => mocks.useSearchDebounce(value),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: mocks.callRpc,
}))

vi.mock("@/components/add-tenant-dialog", () => ({
  AddTenantDialog: () => null,
}))

vi.mock("@/components/edit-tenant-dialog", () => ({
  EditTenantDialog: () => null,
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}))

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => <div className={className} />,
}))

vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AvatarFallback: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("lucide-react", () => ({
  ChevronDown: () => null,
}))

import { TenantsManagement } from "../tenants-management"

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

describe("TenantsManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useRouter.mockReturnValue({ push: vi.fn() })
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
    mocks.useSearchDebounce.mockImplementation((value: string) => value)
    mocks.callRpc.mockResolvedValue([
      {
        tenant_id: 1,
        tenant_code: "TEN-001",
        tenant_name: "Đơn vị thử nghiệm",
        tenant_active: true,
        membership_quota: null,
        logo_url: null,
        used_count: 0,
        users: [],
      },
    ])
  })

  it("surfaces plain-object toggle failures in the destructive toast", async () => {
    mocks.callRpc
      .mockResolvedValueOnce([
        {
          tenant_id: 1,
          tenant_code: "TEN-001",
          tenant_name: "Đơn vị thử nghiệm",
          tenant_active: true,
          membership_quota: null,
          logo_url: null,
          used_count: 0,
          users: [],
        },
      ])
      .mockRejectedValueOnce({ message: "Permission denied" })

    render(<TenantsManagement />, { wrapper: createWrapper() })

    fireEvent.click(await screen.findByRole("button", { name: "Tạm dừng" }))

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          title: "Lỗi",
          description: "Permission denied",
        }),
      )
    })
  })
})
