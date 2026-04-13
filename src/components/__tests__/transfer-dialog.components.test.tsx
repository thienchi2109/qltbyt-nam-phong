import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TransferDialogEquipmentSearch } from "@/components/transfer-dialog.equipment-search"
import { toLocalDateInputValue } from "@/components/transfer-dialog.form-sections"

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

  it("formats local dates for date input boundaries without UTC conversion", () => {
    expect(toLocalDateInputValue(new Date(2026, 3, 13, 15, 4, 5))).toBe("2026-04-13")
  })
})
