import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationBulkEntryWorkbench } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBulkEntryWorkbench"
import type { TechnicalConfigurationBulkEntrySession } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBulkEntrySessions"
import { parseTechnicalConfigurationBulkEntry } from "@/app/(app)/technical-configurations/bulk-entry-utils"

function renderWorkbench({ disabled = false }: { disabled?: boolean } = {}) {
  const onCancel = vi.fn()
  const onAccept = vi.fn()

  function WorkbenchHarness() {
    const [session, setSession] = React.useState<TechnicalConfigurationBulkEntrySession>({
      input: "",
      preview: null,
    })

    return (
      <TechnicalConfigurationBulkEntryWorkbench
        groupName="Yêu cầu kỹ thuật"
        existingCriterionCount={67}
        session={session}
        disabled={disabled}
        onInputChange={(input) => setSession({ input, preview: null })}
        onPreview={() =>
          setSession((current) => ({
            ...current,
            preview: parseTechnicalConfigurationBulkEntry(current.input),
          }))
        }
        onCancel={onCancel}
        onAccept={onAccept}
      />
    )
  }

  return { onCancel, onAccept, ...render(<WorkbenchHarness />) }
}

describe("TechnicalConfigurationBulkEntryWorkbench", () => {
  it("renders inline, focuses input, and previews row validation", async () => {
    const user = userEvent.setup()
    renderWorkbench()

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByText("67 tiêu chí hiện có trong bản nháp")).toBeInTheDocument()
    const input = screen.getByLabelText("Nội dung nhập nhanh")
    expect(input).toHaveFocus()

    await user.type(input, "Nguồn điện ổn định\n\nÁp lực vận hành ≥ 3 bar")
    await user.click(screen.getByRole("button", { name: "Xem trước" }))

    const preview = screen.getByRole("region", { name: "Xem trước tiêu chí" })
    expect(preview).toHaveAttribute("tabindex", "0")
    expect(within(preview).getByText("Dòng")).toBeInTheDocument()
    expect(within(preview).getByText("Nội dung yêu cầu")).toBeInTheDocument()
    expect(within(preview).getByText("Trạng thái")).toBeInTheDocument()
    expect(within(preview).getByText("Dòng 2")).toBeInTheDocument()
    expect(within(preview).getByText("Nội dung yêu cầu là bắt buộc.")).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("3 dòng, 1 dòng có lỗi.")
    expect(screen.getByRole("button", { name: "Thêm vào bản nháp" })).toBeDisabled()
  })

  it("invalidates stale preview after input changes", async () => {
    const user = userEvent.setup()
    renderWorkbench()

    const input = screen.getByLabelText("Nội dung nhập nhanh")
    await user.type(input, "Nguồn điện ổn định")
    await user.click(screen.getByRole("button", { name: "Xem trước" }))
    expect(screen.getByRole("button", { name: "Thêm vào bản nháp" })).toBeEnabled()

    await user.type(input, "\nÁp lực vận hành ≥ 3 bar")
    expect(screen.queryByRole("region", { name: "Xem trước tiêu chí" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Thêm vào bản nháp" })).toBeDisabled()
  })

  it("uses explicit cancel and does not treat Escape as cancellation", async () => {
    const user = userEvent.setup()
    const { onCancel } = renderWorkbench()

    await user.type(screen.getByLabelText("Nội dung nhập nhanh"), "Tiêu chí mới")
    await user.keyboard("{Escape}")
    expect(onCancel).not.toHaveBeenCalled()
    expect(screen.getByLabelText("Nội dung nhập nhanh")).toHaveValue("Tiêu chí mới")

    await user.click(screen.getByRole("button", { name: "Hủy nhập" }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it("accepts only a valid preview and blocks every command while saving", async () => {
    const user = userEvent.setup()
    const active = renderWorkbench()

    await user.type(active.getByLabelText("Nội dung nhập nhanh"), "Nguồn điện ổn định")
    await user.click(active.getByRole("button", { name: "Xem trước" }))
    await user.click(active.getByRole("button", { name: "Thêm vào bản nháp" }))
    expect(active.onAccept).toHaveBeenCalledTimes(1)

    active.unmount()
    const pending = renderWorkbench({ disabled: true })
    expect(pending.getByLabelText("Nội dung nhập nhanh")).toBeDisabled()
    expect(pending.getByRole("button", { name: "Hủy nhập" })).toBeDisabled()
    expect(pending.getByRole("button", { name: "Xem trước" })).toBeDisabled()
    expect(pending.getByRole("button", { name: "Thêm vào bản nháp" })).toBeDisabled()
  })
})
