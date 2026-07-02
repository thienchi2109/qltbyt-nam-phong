import * as React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { RepairRequestsFormFields } from "../_components/RepairRequestsFormFields"
import type { RepairUnit } from "../types"

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    type = "button",
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={type} {...props}>
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
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/ui/calendar", () => ({
  Calendar: () => <div>calendar</div>,
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    onValueChange,
  }: {
    children: React.ReactNode
    onValueChange?: (value: string) => void
  }) => (
    <div>
      {children}
      <button type="button" onClick={() => onValueChange?.("thue_ngoai")}>
        chọn thuê ngoài
      </button>
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children, id }: { children: React.ReactNode; id?: string }) => (
    <button type="button" id={id}>
      {children}
    </button>
  ),
  SelectValue: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

type RepairRequestsFormFieldsProps = React.ComponentProps<typeof RepairRequestsFormFields>

function renderForm(overrides: Partial<RepairRequestsFormFieldsProps> = {}) {
  const props: RepairRequestsFormFieldsProps = {
    canSetRepairUnit: true,
    desiredDate: undefined,
    externalCompanyName: "",
    fieldIdPrefix: "test-repair-request",
    isDateDisabled: () => false,
    issueDescription: "",
    onDesiredDateChange: vi.fn(),
    onExternalCompanyNameChange: vi.fn(),
    onIssueDescriptionChange: vi.fn(),
    onRepairItemsChange: vi.fn(),
    onRepairUnitChange: vi.fn(),
    repairItems: "",
    repairItemsLabel: "Các hạng mục yêu cầu sửa chữa",
    repairItemsRequired: false,
    repairUnit: "noi_bo",
    ...overrides,
  }

  render(<RepairRequestsFormFields {...props} />)

  return props
}

describe("RepairRequestsFormFields", () => {
  it("wires labels to visible controls and exposes repair-unit selection", async () => {
    const user = userEvent.setup()
    const props = renderForm()

    expect(screen.getByLabelText("Mô tả sự cố")).toBeInTheDocument()
    expect(screen.getByLabelText("Các hạng mục yêu cầu sửa chữa")).not.toBeRequired()
    expect(screen.getByLabelText("Ngày mong muốn hoàn thành (nếu có)")).toHaveAttribute(
      "id",
      "test-repair-request-desired-date"
    )
    expect(screen.getByLabelText("Đơn vị thực hiện")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "chọn thuê ngoài" }))

    expect(props.onRepairUnitChange).toHaveBeenCalledWith("thue_ngoai" satisfies RepairUnit)
  })

  it("renders the external company input when repair unit is external", () => {
    renderForm({
      externalCompanyName: "Công ty ABC",
      repairUnit: "thue_ngoai",
    })

    expect(screen.getByLabelText("Tên đơn vị được thuê")).toHaveValue("Công ty ABC")
    expect(screen.getByLabelText("Tên đơn vị được thuê")).toBeRequired()
  })

  it("toggles repair-items required state from props", () => {
    renderForm({ repairItemsRequired: true })

    expect(screen.getByLabelText("Các hạng mục yêu cầu sửa chữa")).toBeRequired()
  })
})
