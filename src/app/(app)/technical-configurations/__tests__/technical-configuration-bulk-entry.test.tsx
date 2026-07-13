import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationBaselineEditor } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor"
import type { TechnicalConfigurationBaselineEditorDraft } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"

const initialDraft: TechnicalConfigurationBaselineEditorDraft = {
  id: "draft-1",
  dossierId: "dossier-1",
  status: "draft",
  revision: 4,
  groups: [
    {
      key: "group-1",
      id: "group-1",
      name: "Yêu cầu chung",
      criteria: [
        {
          key: "criterion-1",
          id: "criterion-1",
          criterionCode: "TC-0001",
          title: "",
          requirementText: "Tiêu chí hiện có",
        },
      ],
    },
    {
      key: "group-2",
      id: "group-2",
      name: "Yêu cầu kỹ thuật",
      criteria: [],
    },
  ],
}

function renderEditor() {
  const onChange = vi.fn()
  const onSave = vi.fn()

  function EditorHarness({ isSaving }: Readonly<{ isSaving: boolean }>) {
    const [draft, setDraft] = React.useState(initialDraft)

    return (
      <TechnicalConfigurationBaselineEditor
        draft={draft}
        validation={{ groupErrors: {}, criterionErrors: {} }}
        isDirty={draft !== initialDraft}
        isSaving={isSaving}
        isConflict={false}
        saveStatus="idle"
        onChange={(nextDraft) => {
          onChange(nextDraft)
          setDraft(nextDraft)
        }}
        onSave={onSave}
      />
    )
  }

  const rendered = render(<EditorHarness isSaving={false} />)
  return {
    onChange,
    onSave,
    setSaving: (isSaving: boolean) => rendered.rerender(<EditorHarness isSaving={isSaving} />),
    ...rendered,
  }
}

describe("technical configuration bulk text entry", () => {
  it("previews row validation and blocks accept while an internal blank row is invalid", async () => {
    const user = userEvent.setup()
    const { onChange, onSave } = renderEditor()

    await user.click(screen.getByRole("button", { name: "Nhập nhanh tiêu chí vào nhóm 2" }))
    const dialog = screen.getByRole("dialog", { name: "Nhập nhanh tiêu chí" })

    expect(within(dialog).getByText("Yêu cầu kỹ thuật")).toBeInTheDocument()
    await user.type(
      within(dialog).getByLabelText("Nội dung nhập nhanh"),
      "Nguồn điện ổn định\n\nÁp lực vận hành ≥ 3 bar"
    )
    await user.click(within(dialog).getByRole("button", { name: "Xem trước" }))

    expect(within(dialog).getByText("Dòng 1")).toBeInTheDocument()
    expect(within(dialog).getByText("Dòng 2")).toBeInTheDocument()
    expect(within(dialog).getByText("Dòng 3")).toBeInTheDocument()
    expect(within(dialog).getByText("Nguồn điện ổn định")).toBeInTheDocument()
    expect(within(dialog).getByText("Áp lực vận hành ≥ 3 bar")).toBeInTheDocument()
    expect(within(dialog).getByText("Nội dung yêu cầu là bắt buộc.")).toBeInTheDocument()
    expect(within(dialog).getByRole("status")).toHaveTextContent("3 dòng, 1 dòng có lỗi.")
    expect(
      within(dialog).getByRole("region", { name: "Danh sách xem trước tiêu chí" })
    ).toHaveAttribute("tabindex", "0")
    const acceptButton = within(dialog).getByRole("button", { name: "Thêm vào nhóm" })
    expect(acceptButton).toBeDisabled()
    expect(acceptButton).toHaveAttribute("aria-describedby", "bulk-entry-preview-status-2")
    const footer = within(dialog).getByRole("button", { name: "Hủy" }).parentElement
    expect(footer).toHaveClass("flex-col", "gap-2")
    expect(footer).not.toHaveClass("flex-col-reverse")
    expect(onChange).not.toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it("cancels without changing the draft", async () => {
    const user = userEvent.setup()
    const { onChange, onSave } = renderEditor()

    const trigger = screen.getByRole("button", { name: "Nhập nhanh tiêu chí vào nhóm 1" })
    await user.click(trigger)
    const dialog = screen.getByRole("dialog", { name: "Nhập nhanh tiêu chí" })
    await user.type(within(dialog).getByLabelText("Nội dung nhập nhanh"), "Tiêu chí mới")
    await user.click(within(dialog).getByRole("button", { name: "Xem trước" }))
    await user.click(within(dialog).getByRole("button", { name: "Hủy" }))

    expect(screen.queryByRole("dialog", { name: "Nhập nhanh tiêu chí" })).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue("Tiêu chí mới")).not.toBeInTheDocument()
    expect(screen.queryByText("Có thay đổi chưa lưu")).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
    await waitFor(() => expect(trigger).toHaveFocus())

    await user.click(trigger)
    const reopenedDialog = screen.getByRole("dialog", { name: "Nhập nhanh tiêu chí" })
    expect(within(reopenedDialog).getByLabelText("Nội dung nhập nhanh")).toHaveValue("")
    expect(
      within(reopenedDialog).queryByRole("region", {
        name: "Danh sách xem trước tiêu chí",
      })
    ).not.toBeInTheDocument()
    expect(within(reopenedDialog).getByRole("button", { name: "Thêm vào nhóm" })).toBeDisabled()
  })

  it("invalidates a stale preview when pasted input changes", async () => {
    const user = userEvent.setup()
    const { onChange, onSave } = renderEditor()

    await user.click(screen.getByRole("button", { name: "Nhập nhanh tiêu chí vào nhóm 2" }))
    const dialog = screen.getByRole("dialog", { name: "Nhập nhanh tiêu chí" })
    const input = within(dialog).getByLabelText("Nội dung nhập nhanh")
    await user.type(input, "Nguồn điện ổn định")
    await user.click(within(dialog).getByRole("button", { name: "Xem trước" }))

    expect(within(dialog).getByRole("button", { name: "Thêm vào nhóm" })).toBeEnabled()
    await user.type(input, "\nÁp lực vận hành ≥ 3 bar")

    expect(
      within(dialog).queryByRole("region", {
        name: "Danh sách xem trước tiêu chí",
      })
    ).not.toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Thêm vào nhóm" })).toBeDisabled()
    expect(onChange).not.toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it("blocks editing and accept while an explicit save is pending", async () => {
    const user = userEvent.setup()
    const { onChange, onSave, setSaving } = renderEditor()

    await user.click(screen.getByRole("button", { name: "Nhập nhanh tiêu chí vào nhóm 2" }))
    const dialog = screen.getByRole("dialog", { name: "Nhập nhanh tiêu chí" })
    const input = within(dialog).getByLabelText("Nội dung nhập nhanh")
    const previewButton = within(dialog).getByRole("button", { name: "Xem trước" })
    const acceptButton = within(dialog).getByRole("button", { name: "Thêm vào nhóm" })

    await user.type(input, "Nguồn điện ổn định")
    await user.click(previewButton)
    expect(acceptButton).toBeEnabled()

    setSaving(true)

    expect(input).toBeDisabled()
    expect(previewButton).toBeDisabled()
    expect(acceptButton).toBeDisabled()
    await user.click(acceptButton)
    expect(onChange).not.toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()

    setSaving(false)
    expect(input).toBeEnabled()
    expect(acceptButton).toBeEnabled()
  })

  it("accepts into the selected local group and persists only from explicit save", async () => {
    const user = userEvent.setup()
    const { onChange, onSave } = renderEditor()

    await user.click(screen.getByRole("button", { name: "Nhập nhanh tiêu chí vào nhóm 2" }))
    const dialog = screen.getByRole("dialog", { name: "Nhập nhanh tiêu chí" })
    await user.type(
      within(dialog).getByLabelText("Nội dung nhập nhanh"),
      "  Nguồn điện ổn định  \nÁp lực vận hành ≥ 3 bar"
    )
    await user.click(within(dialog).getByRole("button", { name: "Xem trước" }))
    await user.click(within(dialog).getByRole("button", { name: "Thêm vào nhóm" }))

    expect(screen.getByLabelText("Nội dung yêu cầu 1.1")).toHaveValue("Tiêu chí hiện có")
    expect(screen.queryByLabelText("Nội dung yêu cầu 1.2")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Nội dung yêu cầu 2.1")).toHaveValue("Nguồn điện ổn định")
    expect(screen.getByLabelText("Nội dung yêu cầu 2.2")).toHaveValue("Áp lực vận hành ≥ 3 bar")
    expect(screen.getByText("Có thay đổi chưa lưu")).toBeInTheDocument()
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Lưu" }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })
})
