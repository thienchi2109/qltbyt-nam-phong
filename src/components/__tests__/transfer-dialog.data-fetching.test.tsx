import * as React from "react"
import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AddTransferDialog } from "@/components/add-transfer-dialog"

const mocks = vi.hoisted(() => ({
  callRpc: vi.fn(),
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

vi.mock("@/hooks/use-debounce", () => ({
  useSearchDebounce: (value: string) => value,
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

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
    disabled,
  }: {
    value?: string
    onValueChange?: (value: string) => void
    children: React.ReactNode
    disabled?: boolean
  }) => (
    <select
      disabled={disabled}
      value={value ?? ""}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{typeof children === "string" ? children : value}</option>
  ),
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe("transfer dialog data fetching", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useSession.mockReturnValue({
      data: {
        user: {
          id: "42",
          role: "to_qltb",
        },
      },
      status: "authenticated",
    })
  })

  it("reuses cached departments data across add dialog remounts with the same query client", async () => {
    mocks.callRpc.mockImplementation(async ({ fn }: { fn: string }) => {
      if (fn === "departments_list") {
        return [{ name: "Khoa A" }, { name: "Khoa B" }]
      }

      return []
    })

    const queryClient = createTestQueryClient()
    const wrapper = createWrapper(queryClient)

    const firstRender = render(
      <AddTransferDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />,
      { wrapper },
    )

    await waitFor(() => {
      expect(mocks.callRpc).toHaveBeenCalledTimes(1)
      expect(mocks.callRpc).toHaveBeenCalledWith({
        fn: "departments_list",
        args: {},
      })
    })

    firstRender.unmount()

    render(
      <AddTransferDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />,
      { wrapper },
    )

    await waitFor(() => {
      expect(screen.getByLabelText(/Thiết bị/)).toBeInTheDocument()
    })

    expect(mocks.callRpc).toHaveBeenCalledTimes(1)
  })

})
