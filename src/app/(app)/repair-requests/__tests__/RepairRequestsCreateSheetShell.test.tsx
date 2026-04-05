import * as React from "react"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  closeAllDialogs: vi.fn(),
  createMutate: vi.fn(),
  fetchEquipment: vi.fn(),
  useMediaQuery: vi.fn(),
}))

const contextValue = {
  dialogState: {
    isCreateOpen: true,
    preSelectedEquipment: null,
  },
  closeAllDialogs: mocks.closeAllDialogs,
  createMutation: {
    mutate: mocks.createMutate,
    isPending: false,
  },
  user: { full_name: "Test User", username: "tester" },
  canSetRepairUnit: true,
  assistantDraft: null,
}

vi.mock("@/hooks/use-media-query", () => ({
  useMediaQuery: () => mocks.useMediaQuery(),
}))

vi.mock("../_hooks/useRepairRequestsContext", () => ({
  useRepairRequestsContext: () => contextValue,
}))

vi.mock("../repair-requests-equipment-rpc", () => ({
  fetchRepairRequestEquipmentList: (...args: unknown[]) => mocks.fetchEquipment(...args),
}))

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetContent: ({
    children,
    side,
    className,
  }: {
    children: React.ReactNode
    side?: string
    className?: string
  }) => (
    <div data-testid="sheet-content" data-side={side} className={className}>
      {children}
    </div>
  ),
  SheetDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  SheetTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    type,
    disabled,
    className,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={type} disabled={disabled} className={className} {...props}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock("@/components/ui/textarea", () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}))

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}))

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/calendar", () => ({
  Calendar: () => <div>calendar</div>,
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  SelectValue: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { RepairRequestsCreateSheet } from "../_components/RepairRequestsCreateSheet"

describe("RepairRequestsCreateSheet shell", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useMediaQuery.mockReturnValue(true)
    mocks.fetchEquipment.mockResolvedValue([])
  })

  it("uses a right-side responsive sheet even on mobile viewports", () => {
    render(<RepairRequestsCreateSheet />)

    const sheetContent = screen.getByTestId("sheet-content")

    expect(sheetContent).toHaveAttribute("data-side", "right")
    expect(sheetContent.className).toContain("w-full")
    expect(sheetContent.className).toContain("sm:max-w-lg")
    expect(sheetContent.className).toContain("p-0")
    expect(sheetContent.className).not.toContain("h-[90vh]")
  })

  it("marks the calendar trigger as a non-submit button inside the form", () => {
    render(<RepairRequestsCreateSheet />)

    expect(screen.getByRole("button", { name: /chọn ngày/i })).toHaveAttribute("type", "button")
  })
})
