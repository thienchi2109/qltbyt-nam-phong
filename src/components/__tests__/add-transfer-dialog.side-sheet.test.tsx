import * as React from "react"
import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

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

vi.mock("@/components/shared/SideSheetShell", () => ({
  SideSheetShell: ({
    open,
    onOpenChange,
    title,
    description,
    contentClassName,
    bodyClassName,
    footerClassName,
    footer,
    children,
  }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    title?: React.ReactNode
    description?: React.ReactNode
    contentClassName?: string
    bodyClassName?: string
    footerClassName?: string
    footer?: React.ReactNode
    children: React.ReactNode
  }) =>
    open ? (
      <section
        aria-label="transfer-create-sheet"
        data-content-class={contentClassName}
        data-body-class={bodyClassName}
        data-footer-class={footerClassName}
      >
        <h2>{title}</h2>
        <p>{description}</p>
        <button type="button" onClick={() => onOpenChange(false)}>
          close add transfer sheet
        </button>
        <div data-testid="sheet-body">{children}</div>
        <div data-testid="sheet-footer">{footer}</div>
      </section>
    ) : null,
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
  SelectItem: ({ value }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{value}</option>
  ),
}))

import { AddTransferDialog } from "@/components/add-transfer-dialog"

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

function AddTransferDialogHarness() {
  const [open, setOpen] = React.useState(true)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        reopen add transfer
      </button>
      <button type="button" onClick={() => setOpen(false)}>
        external close add transfer
      </button>
      {open ? (
        <AddTransferDialog open={open} onOpenChange={setOpen} onSuccess={vi.fn()} />
      ) : null}
    </>
  )
}

describe("AddTransferDialog side sheet presentation", () => {
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

    mocks.callRpc.mockResolvedValue([])
  })

  it("renders create content inside the shared side sheet shell with a footer submit control", () => {
    render(
      <AddTransferDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />,
      { wrapper: createWrapper() },
    )

    const sheet = screen.getByLabelText("transfer-create-sheet")
    expect(sheet).toHaveAttribute("data-content-class", expect.stringContaining("sm:max-w"))
    expect(sheet).toHaveAttribute("data-body-class", expect.stringContaining("overflow"))
    expect(screen.getByRole("heading", { name: "Tạo yêu cầu luân chuyển mới" })).toBeInTheDocument()
    expect(screen.getByTestId("sheet-body")).toContainElement(screen.getByLabelText(/Thiết bị/))
    expect(screen.getByTestId("sheet-body")).toContainElement(
      document.getElementById("add-transfer-form"),
    )
    expect(screen.getByTestId("sheet-footer")).toContainElement(
      screen.getByRole("button", { name: "Tạo yêu cầu" }),
    )
    expect(screen.getByRole("button", { name: "Tạo yêu cầu" })).toHaveAttribute(
      "form",
      "add-transfer-form",
    )
  })

  it("closes through the existing onOpenChange callback when the footer cancel button is clicked", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(
      <AddTransferDialog open onOpenChange={onOpenChange} onSuccess={vi.fn()} />,
      { wrapper: createWrapper() },
    )

    await user.click(screen.getByRole("button", { name: "Hủy" }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("resets draft state when the parent closes and remounts the add transfer sheet", async () => {
    const user = userEvent.setup()

    render(<AddTransferDialogHarness />, { wrapper: createWrapper() })

    await user.type(screen.getByLabelText("Lý do luân chuyển *"), "Draft reason")
    expect(screen.getByLabelText("Lý do luân chuyển *")).toHaveValue("Draft reason")

    await user.click(screen.getByRole("button", { name: "external close add transfer" }))
    await user.click(screen.getByRole("button", { name: "reopen add transfer" }))

    expect(screen.getByLabelText("Lý do luân chuyển *")).toHaveValue("")
  })

  it.each([
    ["footer cancel", "Hủy"],
    ["sheet close", "close add transfer sheet"],
  ])("resets draft state after %s closes the sheet", async (_label, buttonName) => {
    const user = userEvent.setup()

    render(<AddTransferDialogHarness />, { wrapper: createWrapper() })

    await user.type(screen.getByLabelText("Lý do luân chuyển *"), "Draft reason")
    await user.click(screen.getByRole("button", { name: buttonName }))
    await user.click(screen.getByRole("button", { name: "reopen add transfer" }))

    expect(screen.getByLabelText("Lý do luân chuyển *")).toHaveValue("")
  })
})
