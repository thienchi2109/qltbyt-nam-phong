import { useState } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationMatrixColumnControls } from "../_components/comparison/TechnicalConfigurationMatrixColumnControls"
import type { TechnicalConfigurationOptionWire } from "../supplier-option-types"

function createOption(index: number): TechnicalConfigurationOptionWire {
  const suffix = String(index).padStart(12, "0")
  return {
    id: `00000000-0000-0000-0000-${suffix}`,
    dossier_id: "00000000-0000-0000-0000-000000000100",
    supplier_id: `00000000-0000-0000-0001-${suffix}`,
    supplier_name: `Nhà cung cấp ${index}`,
    model: `Model ${index}`,
    manufacturer: null,
    option_name: null,
    notes: null,
    display_label: `Nhà cung cấp ${index} · Model ${index}`,
    created_at: "2026-07-28T00:00:00Z",
    created_by: 1,
    updated_at: "2026-07-28T00:00:00Z",
    updated_by: 1,
    revision: index,
  }
}

function ColumnControlsHarness({ options }: { options: TechnicalConfigurationOptionWire[] }) {
  const optionIds = options.map((option) => option.id)
  const [visibleOptionIds, setVisibleOptionIds] = useState(optionIds)
  const [pinnedOptionIds, setPinnedOptionIds] = useState<readonly string[]>([])
  const [focusedOptionId, setFocusedOptionId] = useState<string | null>(null)
  const toggleVisibility = (optionId: string) =>
    setVisibleOptionIds((current) =>
      current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : optionIds.filter((id) => current.includes(id) || id === optionId)
    )
  const togglePin = (optionId: string) =>
    setPinnedOptionIds((current) => {
      if (current.includes(optionId)) return current.filter((id) => id !== optionId)
      return current.length >= 2
        ? current
        : optionIds.filter((id) => current.includes(id) || id === optionId)
    })

  return (
    <TechnicalConfigurationMatrixColumnControls
      selectedOptions={options}
      visibleOptionIds={visibleOptionIds}
      pinnedOptionIds={pinnedOptionIds}
      focusedOptionId={focusedOptionId}
      onToggleOptionVisibility={toggleVisibility}
      onToggleOptionPin={togglePin}
      onFocusOption={setFocusedOptionId}
      onExitFocus={() => setFocusedOptionId(null)}
    />
  )
}

const NOOP = vi.fn()

describe("P10B2 clean column controls", () => {
  it("applies keyboard actions immediately and focuses hidden selected options", async () => {
    const user = userEvent.setup()
    const options = Array.from({ length: 3 }, (_, index) => createOption(index + 1))
    render(<ColumnControlsHarness options={options} />)

    const trigger = screen.getByRole("button", { name: "Tùy chỉnh cột so sánh" })
    trigger.focus()
    await user.keyboard("{Enter}")

    expect(screen.getByRole("dialog", { name: "Cột phương án" })).toHaveTextContent(
      "Yêu cầu cơ sở luôn hiển thị · Ghim tối đa 2 cột"
    )
    expect(screen.queryByRole("button", { name: /Lưu|Thêm|Áp dụng/i })).not.toBeInTheDocument()

    const visibility = screen.getByRole("checkbox", {
      name: `Hiển thị ${options[0].display_label}`,
    })
    visibility.focus()
    await user.keyboard(" ")
    expect(visibility).not.toBeChecked()
    const pinButton = screen.getByRole("button", { name: `Ghim ${options[1].display_label}` })
    pinButton.focus()
    await user.keyboard("{Enter}")
    expect(
      screen.getByRole("button", { name: `Bỏ ghim ${options[1].display_label}` })
    ).toHaveFocus()
    const focusButton = screen.getByRole("button", {
      name: `Tập trung ${options[0].display_label}`,
    })
    focusButton.focus()
    await user.keyboard("{Enter}")

    const exitFocusButton = await screen.findByRole("button", {
      name: "Thoát chế độ tập trung",
    })
    expect(exitFocusButton).toHaveAttribute("title", "Thoát chế độ tập trung")
    await waitFor(() => expect(exitFocusButton).toHaveFocus())
    await user.keyboard("{Enter}")
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it("returns focus when focused state is reconciled externally", async () => {
    const options = [createOption(1), createOption(2)]
    const props = {
      selectedOptions: options,
      visibleOptionIds: options.map((option) => option.id),
      pinnedOptionIds: [],
      onToggleOptionVisibility: NOOP,
      onToggleOptionPin: NOOP,
      onFocusOption: NOOP,
      onExitFocus: NOOP,
    }
    const { rerender } = render(
      <TechnicalConfigurationMatrixColumnControls {...props} focusedOptionId={options[0].id} />
    )

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Thoát chế độ tập trung" })).toHaveFocus()
    )
    rerender(<TechnicalConfigurationMatrixColumnControls {...props} focusedOptionId={null} />)

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Tùy chỉnh cột so sánh" })).toHaveFocus()
    )
  })
})
