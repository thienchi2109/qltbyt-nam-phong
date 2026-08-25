import "@testing-library/jest-dom"
import { useState } from "react"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationBaselineEditor } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor"
import { useTechnicalConfigurationBulkEntrySessions } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBulkEntrySessions"
import { useTechnicalConfigurationInlineEditor } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationInlineEditor"
import type {
  TechnicalConfigurationBaselineEditorDraft,
  TechnicalConfigurationBaselineEditorValidation,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"

const validation: TechnicalConfigurationBaselineEditorValidation = {
  groupErrors: {},
  subgroupErrors: {},
  criterionErrors: {},
}

const initialDraft: TechnicalConfigurationBaselineEditorDraft = {
  id: "draft-hierarchy-workflow",
  dossierId: "dossier-1",
  status: "draft",
  revision: 7,
  groups: [
    {
      key: "section-a",
      id: "section-a",
      name: "Yêu cầu chung",
      criteria: [
        {
          key: "criterion-direct",
          id: "criterion-direct",
          criterionCode: "TC-0001",
          title: "-",
          requirementText: "Nguồn điện ổn định",
        },
      ],
      subgroups: [
        {
          key: "subgroup-a",
          id: "subgroup-a",
          name: "Hạ tầng",
          criteria: [],
        },
      ],
    },
  ],
}

const scrollIntoViewMock = vi.fn()
const originalScrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "scrollIntoView"
)

beforeEach(() => {
  scrollIntoViewMock.mockClear()
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoViewMock,
  })
})

afterAll(() => {
  if (originalScrollIntoViewDescriptor) {
    Object.defineProperty(Element.prototype, "scrollIntoView", originalScrollIntoViewDescriptor)
  } else {
    Reflect.deleteProperty(Element.prototype, "scrollIntoView")
  }
})

function HierarchyAuthoringHarness(): React.JSX.Element {
  const [draft, setDraft] = useState(initialDraft)
  const bulkSessions = useTechnicalConfigurationBulkEntrySessions()
  const inlineEditor = useTechnicalConfigurationInlineEditor({
    draft,
    validation,
    saveStatus: "idle",
    bulkSessions,
    onEditorChange: setDraft,
  })

  return (
    <TechnicalConfigurationBaselineEditor
      draft={draft}
      validation={validation}
      summaryValidation={validation}
      status={{
        dirty: true,
        saving: false,
        editingDisabled: false,
        conflict: false,
        saveStatus: "idle",
        hasPendingBulkInput: bulkSessions.hasPendingInput,
      }}
      isFocusMode={false}
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
      hierarchyAuthoring={inlineEditor.hierarchyAuthoring}
    />
  )
}

describe("technical configuration baseline hierarchy authoring workflow", () => {
  it("focuses new subgroup names and new subgroup criterion requirements", async () => {
    const user = userEvent.setup()
    render(<HierarchyAuthoringHarness />)

    const section = screen.getByRole("region", { name: "Nhóm tiêu chí I" })
    await user.click(within(section).getByRole("button", { name: "Thêm nhóm con vào nhóm I" }))

    const newSubgroupName = within(section).getByRole("textbox", {
      name: "Tên nhóm con 2 của nhóm I",
    })
    await waitFor(() => expect(newSubgroupName).toHaveFocus())
    await user.type(newSubgroupName, "An toàn")

    const newSubgroup = within(section).getByRole("region", {
      name: "Nhóm con 2 của nhóm I: An toàn",
    })
    await user.click(
      within(newSubgroup).getByRole("button", {
        name: "Thêm tiêu chí vào nhóm con 2 của nhóm I",
      })
    )

    await waitFor(() =>
      expect(
        within(newSubgroup).getByRole("textbox", {
          name: "Nội dung yêu cầu tiêu chí 1 của nhóm con 2, nhóm I",
        })
      ).toHaveFocus()
    )
    expect(scrollIntoViewMock).toHaveBeenCalled()
  })

  it("keeps direct and subgroup buffers through collapse and restores focus after cancel", async () => {
    const user = userEvent.setup()
    render(<HierarchyAuthoringHarness />)

    const section = screen.getByRole("region", { name: "Nhóm tiêu chí I" })
    const subgroup = within(section).getByRole("region", {
      name: "Nhóm con 1 của nhóm I: Hạ tầng",
    })

    await user.click(
      within(section).getByRole("button", {
        name: "Nhập nhiều dòng cho nhóm I: Yêu cầu chung",
      })
    )
    const directInput = within(section).getByRole("textbox", { name: "Nội dung nhập nhanh" })
    await user.type(directInput, "Yêu cầu trực tiếp đang chờ")

    await user.click(
      within(subgroup).getByRole("button", {
        name: "Nhập nhiều dòng cho nhóm con 1 của nhóm I",
      })
    )
    let subgroupInput = within(subgroup).getByRole("textbox", { name: "Nội dung nhập nhanh" })
    await waitFor(() => expect(subgroupInput).toHaveFocus())
    await user.type(subgroupInput, "Tiếp địa riêng")

    expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled()
    expect(
      screen.getByText("Hoàn tất hoặc hủy phần nhập nhiều dòng trước khi lưu.")
    ).toBeInTheDocument()

    await user.click(
      within(subgroup).getByRole("button", {
        name: "Thu gọn nhóm con 1 của nhóm I: Hạ tầng",
      })
    )
    await user.click(
      within(subgroup).getByRole("button", {
        name: "Mở rộng nhóm con 1 của nhóm I: Hạ tầng",
      })
    )
    subgroupInput = within(subgroup).getByRole("textbox", { name: "Nội dung nhập nhanh" })
    expect(subgroupInput).toHaveValue("Tiếp địa riêng")

    await user.click(within(subgroup).getByRole("button", { name: "Hủy nhập" }))
    await waitFor(() =>
      expect(
        within(subgroup).getByRole("button", {
          name: "Nhập nhiều dòng cho nhóm con 1 của nhóm I",
        })
      ).toHaveFocus()
    )

    await user.click(
      within(section).getByRole("button", {
        name: "Nhập nhiều dòng cho nhóm I: Yêu cầu chung",
      })
    )
    expect(within(section).getByRole("textbox", { name: "Nội dung nhập nhanh" })).toHaveValue(
      "Yêu cầu trực tiếp đang chờ"
    )
  })

  it("opens a collapsed destination before restoring focus after a criterion menu move", async () => {
    const user = userEvent.setup()
    render(<HierarchyAuthoringHarness />)

    const section = screen.getByRole("region", { name: "Nhóm tiêu chí I" })
    const subgroup = within(section).getByRole("region", {
      name: "Nhóm con 1 của nhóm I: Hạ tầng",
    })
    await user.click(
      within(subgroup).getByRole("button", {
        name: "Thu gọn nhóm con 1 của nhóm I: Hạ tầng",
      })
    )

    await user.click(
      within(section).getByRole("button", {
        name: "Thao tác cho tiêu chí trực tiếp 1 của nhóm I",
      })
    )
    await user.click(await screen.findByRole("menuitem", { name: "Chuyển đến..." }))
    await user.click(await screen.findByRole("menuitem", { name: "I.1 Hạ tầng" }))

    const movedRequirement = within(subgroup).getByRole("textbox", {
      name: "Nội dung yêu cầu tiêu chí 1 của nhóm con 1, nhóm I",
    })
    await waitFor(() => expect(movedRequirement).toHaveFocus())
    expect(
      within(subgroup).getByRole("button", {
        name: "Thu gọn nhóm con 1 của nhóm I: Hạ tầng",
      })
    ).toBeInTheDocument()
    expect(screen.getByText("Có thay đổi chưa lưu")).toBeInTheDocument()
  })
})
