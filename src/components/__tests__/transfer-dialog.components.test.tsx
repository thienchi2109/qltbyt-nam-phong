import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

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

import { TransferDialogEquipmentSearch } from "@/components/transfer-dialog.equipment-search"
import {
  TransferInternalInputFields,
  TransferInternalSelectFields,
  toLocalDateInputValue,
} from "@/components/transfer-dialog.form-sections"
import { createEmptyTransferDialogFormData } from "@/components/transfer-dialog.shared"

const equipmentOption = {
  id: 11,
  ma_thiet_bi: "TB-11",
  ten_thiet_bi: "Máy siêu âm",
  khoa_phong_quan_ly: "Khoa A",
} as const

describe("transfer dialog shared components", () => {
  it("shows the equipment required marker only when the field is required", () => {
    const { rerender } = render(
      <TransferDialogEquipmentSearch
        disabled={false}
        searchTerm=""
        trimmedSearch=""
        selectedEquipment={null}
        isEquipmentLoading={false}
        showResultsDropdown={false}
        showNoResults={false}
        showMinCharsHint={false}
        filteredEquipment={[]}
        onSearchChange={vi.fn()}
        onSelectEquipment={vi.fn()}
      />,
    )

    expect(screen.getByLabelText("Thiết bị")).toBeInTheDocument()
    expect(screen.queryByLabelText("Thiết bị *")).not.toBeInTheDocument()

    rerender(
      <TransferDialogEquipmentSearch
        disabled={false}
        required
        searchTerm=""
        trimmedSearch=""
        selectedEquipment={null}
        isEquipmentLoading={false}
        showResultsDropdown={false}
        showNoResults={false}
        showMinCharsHint={false}
        filteredEquipment={[]}
        onSearchChange={vi.fn()}
        onSelectEquipment={vi.fn()}
      />,
    )

    expect(screen.getByLabelText("Thiết bị *")).toBeInTheDocument()
  })

  it("allows keyboard selection of an equipment result", async () => {
    const user = userEvent.setup()
    const onSelectEquipment = vi.fn()

    render(
      <TransferDialogEquipmentSearch
        disabled={false}
        searchTerm="Máy"
        trimmedSearch="Máy"
        selectedEquipment={null}
        isEquipmentLoading={false}
        showResultsDropdown
        showNoResults={false}
        showMinCharsHint={false}
        filteredEquipment={[equipmentOption]}
        onSearchChange={vi.fn()}
        onSelectEquipment={onSelectEquipment}
      />,
    )

    const optionButton = screen.getByRole("button", {
      name: /Máy siêu âm \(TB-11\)/,
    })

    optionButton.focus()
    await user.keyboard("{Enter}")

    expect(onSelectEquipment).toHaveBeenCalledWith(equipmentOption)
  })

  it("shows the no-results state without rendering stale equipment options", () => {
    render(
      <TransferDialogEquipmentSearch
        disabled={false}
        searchTerm="Máy"
        trimmedSearch="Máy"
        selectedEquipment={null}
        isEquipmentLoading={false}
        showResultsDropdown={false}
        showNoResults
        showMinCharsHint={false}
        filteredEquipment={[]}
        onSearchChange={vi.fn()}
        onSelectEquipment={vi.fn()}
      />,
    )

    expect(screen.getByText("Không tìm thấy kết quả phù hợp")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /TB-11/ })).not.toBeInTheDocument()
  })

  it("clears the receiving department when the selected current department changes to the same value", async () => {
    const user = userEvent.setup()

    function InternalSelectHarness() {
      const [formData, setFormData] = React.useState(() => ({
        ...createEmptyTransferDialogFormData(),
        khoa_phong_hien_tai: "Khoa A",
        khoa_phong_nhan: "Khoa B",
      }))

      return (
        <>
          <TransferInternalSelectFields
            departments={["Khoa A", "Khoa B", "Khoa C"]}
            disabled={false}
            formData={formData}
            setFormData={setFormData}
            lockCurrentDepartment={false}
          />
          <output data-testid="receiving-state">{formData.khoa_phong_nhan}</output>
        </>
      )
    }

    render(<InternalSelectHarness />)

    const selectElements = screen.getAllByRole("combobox")
    await user.selectOptions(selectElements[0], "Khoa B")

    expect(screen.getByTestId("receiving-state")).toHaveTextContent("")
  })

  it("marks current department as required and clears conflicting receiving input", async () => {
    const user = userEvent.setup()

    function InternalInputHarness() {
      const [formData, setFormData] = React.useState(() => ({
        ...createEmptyTransferDialogFormData(),
        khoa_phong_hien_tai: "Khoa A",
        khoa_phong_nhan: "Khoa B",
      }))

      return (
        <TransferInternalInputFields
          disabled={false}
          formData={formData}
          setFormData={setFormData}
        />
      )
    }

    render(<InternalInputHarness />)

    const currentDepartmentInput = screen.getByLabelText("Khoa/Phòng hiện tại *")
    const receivingDepartmentInput = screen.getByLabelText("Khoa/Phòng nhận *")

    expect(currentDepartmentInput).toBeRequired()

    await user.clear(currentDepartmentInput)
    await user.type(currentDepartmentInput, "Khoa B")

    expect(receivingDepartmentInput).toHaveValue("")
  })

  it("formats local dates for date input boundaries without UTC conversion", () => {
    expect(toLocalDateInputValue(new Date(2026, 3, 13, 15, 4, 5))).toBe("2026-04-13")
  })
})
