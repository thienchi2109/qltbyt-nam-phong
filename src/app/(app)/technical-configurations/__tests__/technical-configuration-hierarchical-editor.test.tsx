import { useState } from "react"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { TechnicalConfigurationBaselineEditor } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor"
import { useTechnicalConfigurationBulkEntrySessions } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBulkEntrySessions"
import { useTechnicalConfigurationInlineEditor } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationInlineEditor"
import type { TechnicalConfigurationBaselineEditorDraft } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"

const serverDraft: TechnicalConfigurationBaselineEditorDraft = {
  id: "draft-1",
  dossierId: "dossier-1",
  status: "draft",
  revision: 4,
  groups: [
    {
      key: "group-a",
      id: "group-a",
      name: "Nhóm A",
      criteria: [
        {
          key: "criterion-a",
          id: "criterion-a",
          criterionCode: "TC-0001",
          title: "Nguồn điện",
          requirementText: "Nguồn điện ổn định",
        },
      ],
    },
    {
      key: "group-b",
      id: "group-b",
      name: "Nhóm B",
      criteria: [
        {
          key: "criterion-b",
          id: "criterion-b",
          criterionCode: "TC-0002",
          title: "Áp lực",
          requirementText: "Áp lực tối thiểu 3 bar",
        },
      ],
    },
  ],
}

const emptyDraft: TechnicalConfigurationBaselineEditorDraft = {
  ...serverDraft,
  groups: [],
}

const scrollIntoViewMock = vi.fn()
const originalScrollIntoView = Element.prototype.scrollIntoView

beforeEach(() => {
  scrollIntoViewMock.mockClear()
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoViewMock,
  })
})

afterAll(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: originalScrollIntoView,
  })
})

function EditorHarness({
  initialDraft = serverDraft,
}: {
  initialDraft?: TechnicalConfigurationBaselineEditorDraft
}) {
  const [draft, setDraft] = useState(initialDraft)
  const bulkSessions = useTechnicalConfigurationBulkEntrySessions()
  const inlineEditor = useTechnicalConfigurationInlineEditor({
    draft,
    validation: { groupErrors: {}, criterionErrors: {} },
    saveStatus: "idle",
    bulkSessions,
    onEditorChange: setDraft,
  })

  return (
    <>
      <button
        type="button"
        onClick={() => inlineEditor.prepareForReload(draft.groups[0]?.key ?? "")}
      >
        Mô phỏng tải lại
      </button>
      <TechnicalConfigurationBaselineEditor
        draft={draft}
        validation={{ groupErrors: {}, criterionErrors: {} }}
        summaryValidation={{ groupErrors: {}, criterionErrors: {} }}
        status={{
          dirty: true,
          saving: false,
          editingDisabled: false,
          conflict: false,
          saveStatus: "idle",
          hasPendingBulkInput: bulkSessions.hasPendingInput,
        }}
        activeValue={inlineEditor.activeValue}
        entryMode={inlineEditor.entryMode}
        getBulkSession={bulkSessions.getSession}
        focusTarget={inlineEditor.focusTarget}
        recentlyAcceptedCriterionKeys={bulkSessions.recentlyAcceptedCriterionKeys}
        onGroupModeChange={inlineEditor.setGroupMode}
        onAddGroup={inlineEditor.addGroup}
        onGroupNameChange={inlineEditor.setGroupName}
        onMoveGroup={inlineEditor.moveGroup}
        onDeleteGroup={inlineEditor.deleteGroup}
        onCriterionTextChange={inlineEditor.setCriterionText}
        onMoveCriterion={inlineEditor.moveCriterion}
        onDeleteCriterion={inlineEditor.deleteCriterion}
        onAddCriterion={inlineEditor.addCriterion}
        onBulkInputChange={inlineEditor.setBulkInput}
        onBulkPreview={inlineEditor.previewBulk}
        onBulkCancel={inlineEditor.cancelBulk}
        onBulkAccept={inlineEditor.acceptBulk}
        onSave={vi.fn()}
      />
    </>
  )
}

function getGroupSection(ordinal: number) {
  return screen.getByRole("region", { name: `Nhóm tiêu chí ${ordinal}` })
}

describe("TechnicalConfigurationBaselineEditor hierarchy", () => {
  it("renders all groups expanded in a definite-height focusable scroll workspace", () => {
    userEvent.setup()
    render(<EditorHarness />)

    expect(screen.getByLabelText("Nội dung yêu cầu 1.1")).toBeInTheDocument()
    expect(screen.getByLabelText("Nội dung yêu cầu 2.1")).toBeInTheDocument()
    expect(screen.queryByRole("tab")).not.toBeInTheDocument()
    expect(screen.queryByText("Xem tất cả nhóm")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Thu gọn nhóm 1: Nhóm A" })).toHaveAttribute(
      "aria-expanded",
      "true"
    )
    expect(screen.getByRole("button", { name: "Thu gọn nhóm 2: Nhóm B" })).toHaveAttribute(
      "aria-expanded",
      "true"
    )
    expect(
      screen.getByRole("button", { name: "Nhập nhiều dòng cho nhóm 1: Nhóm A" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Nhập nhiều dòng cho nhóm 2: Nhóm B" })
    ).toBeInTheDocument()

    const workspace = screen.getByTestId("baseline-editor-workspace")
    const scrollRegion = screen.getByRole("region", { name: "Các nhóm cấu hình cơ sở" })
    const saveButton = screen.getByRole("button", { name: "Lưu" })

    expect(workspace).toHaveClass("h-[70dvh]", "min-h-[28rem]", "max-h-[52rem]")
    expect(scrollRegion).toHaveClass("min-h-0", "flex-1", "overflow-y-auto")
    expect(scrollRegion).toHaveAttribute("tabindex", "0")
    expect(scrollRegion).not.toContainElement(saveButton)
    expect(workspace).toContainElement(saveButton)
  })

  it("collapses one group independently and restores its row content", async () => {
    const user = userEvent.setup()
    render(<EditorHarness />)

    await user.click(screen.getByRole("button", { name: "Thu gọn nhóm 1: Nhóm A" }))

    expect(screen.queryByLabelText("Nội dung yêu cầu 1.1")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Nội dung yêu cầu 2.1")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Mở rộng nhóm 1: Nhóm A" }))

    expect(screen.getByLabelText("Nội dung yêu cầu 1.1")).toBeInTheDocument()
  })

  it("keeps Add group available for an empty draft", () => {
    userEvent.setup()
    render(<EditorHarness initialDraft={emptyDraft} />)

    expect(screen.getByRole("button", { name: "Thêm nhóm" })).toBeEnabled()
    expect(screen.queryByRole("tab")).not.toBeInTheDocument()
    expect(screen.getByText("Chưa có nhóm tiêu chí.")).toBeInTheDocument()
  })

  it("adds an expanded group, scrolls it into view, and focuses its name", async () => {
    const user = userEvent.setup()
    render(<EditorHarness />)

    await user.click(screen.getByRole("button", { name: "Thêm nhóm" }))

    const groupName = await screen.findByRole("textbox", { name: "Tên nhóm 3" })
    await waitFor(() => expect(groupName).toHaveFocus())
    expect(screen.getByRole("button", { name: /Thu gọn nhóm 3/ })).toHaveAttribute(
      "aria-expanded",
      "true"
    )
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ block: "nearest" })
  })

  it("expands before adding a criterion, then scrolls and focuses the requirement", async () => {
    const user = userEvent.setup()
    render(<EditorHarness />)

    await user.click(screen.getByRole("button", { name: "Thu gọn nhóm 1: Nhóm A" }))
    await user.click(
      within(getGroupSection(1)).getByRole("button", { name: "Thêm tiêu chí vào nhóm 1" })
    )

    const requirement = await screen.findByLabelText("Nội dung yêu cầu 1.2")
    await waitFor(() => expect(requirement).toHaveFocus())
    expect(screen.getByRole("button", { name: "Thu gọn nhóm 1: Nhóm A" })).toHaveAttribute(
      "aria-expanded",
      "true"
    )
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ block: "nearest" })
  })

  it("switches multiline groups without losing either group buffer", async () => {
    const user = userEvent.setup()
    render(<EditorHarness />)

    await user.click(within(getGroupSection(1)).getByRole("button", { name: /Nhập nhiều dòng/ }))
    await user.type(within(getGroupSection(1)).getByLabelText("Nội dung nhập nhanh"), "A-1")

    await user.click(within(getGroupSection(2)).getByRole("button", { name: /Nhập nhiều dòng/ }))
    await user.type(within(getGroupSection(2)).getByLabelText("Nội dung nhập nhanh"), "B-1")

    await user.click(within(getGroupSection(1)).getByRole("button", { name: /Nhập nhiều dòng/ }))

    expect(within(getGroupSection(1)).getByLabelText("Nội dung nhập nhanh")).toHaveValue("A-1")

    await user.click(within(getGroupSection(2)).getByRole("button", { name: /Nhập nhiều dòng/ }))
    expect(within(getGroupSection(2)).getByLabelText("Nội dung nhập nhanh")).toHaveValue("B-1")
  })

  it("accepts multiline input into the active group and returns to highlighted row mode", async () => {
    const user = userEvent.setup()
    render(<EditorHarness />)

    await user.click(within(getGroupSection(1)).getByRole("button", { name: /Nhập nhiều dòng/ }))
    await user.type(within(getGroupSection(1)).getByLabelText("Nội dung nhập nhanh"), "Yêu cầu mới")
    await user.click(within(getGroupSection(1)).getByRole("button", { name: "Xem trước" }))
    await user.click(within(getGroupSection(1)).getByRole("button", { name: "Thêm vào bản nháp" }))

    const newRequirement = await screen.findByLabelText("Nội dung yêu cầu 1.2")
    await waitFor(() => expect(newRequirement).toHaveFocus())
    expect(
      screen
        .getAllByTestId(/criterion-row-/)
        .some((row) => row.hasAttribute("data-recently-accepted"))
    ).toBe(true)
  })

  it("focuses disclosure, mode action, and first reloaded disclosure after transitions", async () => {
    const user = userEvent.setup()
    render(<EditorHarness />)

    await user.click(within(getGroupSection(1)).getByRole("button", { name: "Xóa nhóm 1" }))
    const remainingDisclosure = screen.getByRole("button", {
      name: "Thu gọn nhóm 1: Nhóm B",
    })
    await waitFor(() => expect(remainingDisclosure).toHaveFocus())

    await user.click(within(getGroupSection(1)).getByRole("button", { name: /Nhập nhiều dòng/ }))
    await user.click(within(getGroupSection(1)).getByRole("button", { name: "Hủy nhập" }))
    await waitFor(() =>
      expect(
        within(getGroupSection(1)).getByRole("button", { name: /Nhập nhiều dòng/ })
      ).toHaveFocus()
    )

    await user.click(screen.getByRole("button", { name: "Mô phỏng tải lại" }))
    await waitFor(() => expect(remainingDisclosure).toHaveFocus())
  })
})
