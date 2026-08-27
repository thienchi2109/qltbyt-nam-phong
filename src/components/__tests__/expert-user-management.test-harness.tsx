import * as React from "react"
import { render } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import type { UserSummary } from "@/types/database"

export const dialogMocks = {
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}

const SelectContext = React.createContext<{
  disabled?: boolean
  onValueChange?: (value: string) => void
  value?: string
}>({})

export const selectMocks = {
  Select: ({
    children,
    disabled,
    onValueChange,
    value,
  }: {
    children: React.ReactNode
    disabled?: boolean
    onValueChange?: (value: string) => void
    value?: string
  }) => (
    <SelectContext.Provider value={{ disabled, onValueChange, value }}>
      {children}
    </SelectContext.Provider>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => {
    const context = React.useContext(SelectContext)
    return (
      <select
        disabled={context.disabled}
        onChange={(event) => context.onValueChange?.(event.target.value)}
        value={context.value}
      >
        <option value="">Chọn</option>
        {children}
      </select>
    )
  },
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
}

export const scrollAreaMocks = {
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}

export const expertUserManagementTenants = [
  { id: 11, name: "Bệnh viện A", code: "BV-A" },
  { id: 12, name: "Bệnh viện B", code: "BV-B" },
]

export function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

export function makeExpertManagementUser(overrides: Partial<UserSummary> = {}): UserSummary {
  return {
    id: overrides.id ?? 7,
    username: overrides.username ?? "nva",
    full_name: overrides.full_name ?? "Nguyen Van A",
    role: overrides.role ?? "user",
    khoa_phong: overrides.khoa_phong ?? "Khoa A",
    created_at: overrides.created_at ?? "2026-08-25T00:00:00Z",
    ...overrides,
  }
}
