import * as React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { FilterBottomSheet, type EquipmentFilterData } from "../../equipment/filter-bottom-sheet"

const emptyFilterData: EquipmentFilterData = {
  status: [{ id: "active", label: "Đang sử dụng", count: 10 }],
  department: [],
  location: [],
  user: [],
  classification: [],
  fundingSource: [],
}

function ControlledFilterBottomSheet({
  onApply = vi.fn(),
  onClearAll = vi.fn(),
  onOutsideAction = vi.fn(),
}: {
  onApply?: React.ComponentProps<typeof FilterBottomSheet>["onApply"]
  onClearAll?: React.ComponentProps<typeof FilterBottomSheet>["onClearAll"]
  onOutsideAction?: () => void
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Mở bộ lọc
      </button>
      <button type="button" onClick={onOutsideAction}>
        Tác vụ ngoài trang
      </button>
      <FilterBottomSheet
        open={open}
        onOpenChange={setOpen}
        data={emptyFilterData}
        columnFilters={[]}
        onApply={onApply}
        onClearAll={onClearAll}
      />
    </>
  )
}

describe("FilterBottomSheet (regression)", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    data: emptyFilterData,
    columnFilters: [],
    onApply: vi.fn(),
    onClearAll: vi.fn(),
  }

  it("renders filter section labels when open", () => {
    render(<FilterBottomSheet {...defaultProps} />)

    expect(screen.getByText("Trạng thái")).toBeInTheDocument()
    expect(screen.getByText("Đang sử dụng")).toBeInTheDocument()
  })

  it("calls onOpenChange(false) when close button is clicked", () => {
    const onOpenChange = vi.fn()
    render(<FilterBottomSheet {...defaultProps} onOpenChange={onOpenChange} />)

    const closeButton = screen.getByLabelText("Đóng bộ lọc")
    fireEvent.click(closeButton)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("calls onOpenChange(false) on backdrop click", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<FilterBottomSheet {...defaultProps} onOpenChange={onOpenChange} />)

    const backdrop = screen.getByTestId("mobile-bottom-sheet-backdrop")
    await user.click(backdrop)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("does not render when closed", () => {
    render(<FilterBottomSheet {...defaultProps} open={false} />)

    expect(screen.queryByText("Trạng thái")).not.toBeInTheDocument()
  })

  it("keeps the local draft when parent filters refresh while open", () => {
    const { rerender } = render(
      <FilterBottomSheet
        {...defaultProps}
        columnFilters={[{ id: "tinh_trang_hien_tai", value: ["active"] }]}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /Đang sử dụng/ }))

    rerender(
      <FilterBottomSheet
        {...defaultProps}
        columnFilters={[{ id: "tinh_trang_hien_tai", value: ["active"] }]}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /Áp dụng/ }))

    expect(defaultProps.onApply).toHaveBeenCalledWith([])
  })

  it("reports local draft changes so parent can refresh cascade buckets before apply", () => {
    const onApply = vi.fn()
    const onDraftFiltersChange = vi.fn()

    render(
      <FilterBottomSheet
        {...defaultProps}
        onApply={onApply}
        onDraftFiltersChange={onDraftFiltersChange}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /Đang sử dụng/ }))

    expect(onDraftFiltersChange).toHaveBeenCalledTimes(1)
    expect(onDraftFiltersChange).toHaveBeenCalledWith([
      { id: "tinh_trang_hien_tai", value: ["active"] },
    ])
    expect(onApply).not.toHaveBeenCalled()
  })

  it("renders compact full-width footer actions for mobile reachability", () => {
    render(<FilterBottomSheet {...defaultProps} />)

    const clearButton = screen.getByRole("button", { name: "Xóa tất cả" })
    const applyButton = screen.getByRole("button", { name: "Áp dụng" })
    const footer = clearButton.closest("[data-testid='filter-bottom-sheet-footer']")

    expect(footer).toHaveClass("pb-12")
    expect(clearButton).toHaveClass("w-full", "min-w-0")
    expect(applyButton).toHaveClass("w-full", "min-w-0")
  })

  it("supports apply, clear, Escape close, and page interaction after close", async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    const onClearAll = vi.fn()
    const onOutsideAction = vi.fn()

    render(
      <ControlledFilterBottomSheet
        onApply={onApply}
        onClearAll={onClearAll}
        onOutsideAction={onOutsideAction}
      />
    )

    await user.click(screen.getByRole("button", { name: "Mở bộ lọc" }))
    await user.click(screen.getByRole("button", { name: /Đang sử dụng/ }))
    await user.click(screen.getByRole("button", { name: /Áp dụng/ }))

    expect(onApply).toHaveBeenCalledWith([{ id: "tinh_trang_hien_tai", value: ["active"] }])
    expect(screen.queryByRole("dialog", { name: "Bộ lọc thiết bị" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Tác vụ ngoài trang" }))
    expect(onOutsideAction).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole("button", { name: "Mở bộ lọc" }))
    await user.click(screen.getByRole("button", { name: "Xóa tất cả" }))

    expect(onClearAll).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("dialog", { name: "Bộ lọc thiết bị" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Tác vụ ngoài trang" }))
    expect(onOutsideAction).toHaveBeenCalledTimes(2)

    await user.click(screen.getByRole("button", { name: "Mở bộ lọc" }))
    await user.keyboard("{Escape}")

    expect(screen.queryByRole("dialog", { name: "Bộ lọc thiết bị" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Tác vụ ngoài trang" }))
    expect(onOutsideAction).toHaveBeenCalledTimes(3)
  })
})
