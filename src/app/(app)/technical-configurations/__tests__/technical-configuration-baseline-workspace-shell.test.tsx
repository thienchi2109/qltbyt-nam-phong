import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TECHNICAL_CONFIGURATION_BASELINE_CRITERION_GRID_TEMPLATE } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineCriterionRow"
import { TechnicalConfigurationBaselineEditor } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor"
import type { TechnicalConfigurationBaselineHierarchyAuthoring } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineHierarchyAuthoring"
import type { TechnicalConfigurationBaselineEditorDraft } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"

const draft: TechnicalConfigurationBaselineEditorDraft = {
  id: "draft-1",
  dossierId: "dossier-1",
  status: "draft",
  revision: 4,
  groups: [
    {
      key: "group-a",
      id: "group-a",
      name: "Yêu cầu chung",
      criteria: [
        {
          key: "criterion-a",
          id: "criterion-a",
          criterionCode: "TC-0001",
          title: "Nguồn điện",
          requirementText: "Nguồn điện ổn định",
        },
      ],
      subgroups: [
        {
          key: "subgroup-a",
          id: "subgroup-a",
          name: "Phụ kiện",
          criteria: [
            {
              key: "criterion-b",
              id: "criterion-b",
              criterionCode: "TC-0002",
              title: "Dây nguồn",
              requirementText: "Dây nguồn tiêu chuẩn",
            },
          ],
        },
      ],
    },
    {
      key: "group-b",
      id: "group-b",
      name: "Yêu cầu lắp đặt",
      criteria: [],
    },
  ],
}

type EditorStatus = Readonly<{
  dirty: boolean
  saving: boolean
  editingDisabled: boolean
  conflict: boolean
  saveStatus: "idle" | "saved"
  hasPendingBulkInput: boolean
}>

const defaultStatus: EditorStatus = {
  dirty: true,
  saving: false,
  editingDisabled: false,
  conflict: false,
  saveStatus: "idle",
  hasPendingBulkInput: false,
}

function EditorHarness({
  status = defaultStatus,
}: Readonly<{
  status?: EditorStatus
}>): React.JSX.Element {
  const [isFocusMode, setIsFocusMode] = React.useState(false)
  const hierarchyAuthoring: TechnicalConfigurationBaselineHierarchyAuthoring = {
    activeOwnerKey: "",
    entryMode: "row",
    getBulkSession: () => ({ input: "", preview: null }),
    onOwnerModeChange: vi.fn(),
    onAddSubgroup: vi.fn(),
    onSubgroupNameChange: vi.fn(),
    onMoveSubgroup: vi.fn(),
    onDeleteSubgroup: vi.fn(),
    onCriterionTextChange: vi.fn(),
    onMoveCriterionWithinOwner: vi.fn(),
    onMoveCriterionToOwner: vi.fn(),
    onDeleteCriterion: vi.fn(),
    onAddCriterion: vi.fn(),
    onBulkInputChange: vi.fn(),
    onBulkPreview: vi.fn(),
    onBulkCancel: vi.fn(),
    onBulkAccept: vi.fn(),
  }

  return (
    <TechnicalConfigurationBaselineEditor
      draft={draft}
      validation={{ groupErrors: {}, criterionErrors: {} }}
      summaryValidation={{ groupErrors: {}, criterionErrors: {} }}
      status={status}
      isFocusMode={isFocusMode}
      activeValue=""
      entryMode="row"
      getBulkSession={() => ({ input: "", preview: null })}
      hierarchyAuthoring={hierarchyAuthoring}
      focusTarget={null}
      recentlyAcceptedCriterionKeys={new Set()}
      onGroupModeChange={vi.fn()}
      onAddGroup={vi.fn()}
      onGroupNameChange={vi.fn()}
      onMoveGroup={vi.fn()}
      onDeleteGroup={vi.fn()}
      onCriterionTextChange={vi.fn()}
      onMoveCriterion={vi.fn()}
      onDeleteCriterion={vi.fn()}
      onAddCriterion={vi.fn()}
      onBulkInputChange={vi.fn()}
      onBulkPreview={vi.fn()}
      onBulkCancel={vi.fn()}
      onBulkAccept={vi.fn()}
      onSave={vi.fn()}
      onToggleFocusMode={() => setIsFocusMode((current) => !current)}
    />
  )
}

describe("TechnicalConfigurationBaselineEditor workspace shell", () => {
  it("renders a passive canonical structure outline beside the hierarchy canvas", () => {
    render(<EditorHarness />)

    const shell = screen.getByTestId("baseline-editor-body")
    const sidebar = screen.getByTestId("baseline-structure-sidebar")
    const canvas = screen.getByRole("region", { name: "Các nhóm cấu hình cơ sở" })
    const outlineItems = within(sidebar).getAllByRole("listitem")

    expect(shell).toHaveClass("grid-cols-[220px_minmax(0,1fr)]")
    expect(shell).toContainElement(sidebar)
    expect(shell).toContainElement(canvas)
    expect(outlineItems).toHaveLength(2)
    expect(outlineItems[0]).toHaveTextContent(/^IYêu cầu chung2 tiêu chí$/)
    expect(outlineItems[1]).toHaveTextContent(/^IIYêu cầu lắp đặt0 tiêu chí$/)
    expect(within(sidebar).queryByRole("button")).not.toBeInTheDocument()
    expect(within(sidebar).queryByRole("link")).not.toBeInTheDocument()
    expect(sidebar.querySelector("[tabindex]")).toBeNull()
  })

  it("keeps one shared column header in the primary hierarchy scroll region", () => {
    render(<EditorHarness />)

    const canvas = screen.getByRole("region", { name: "Các nhóm cấu hình cơ sở" })
    const header = screen.getByTestId("baseline-editor-column-header")

    expect(canvas).toHaveClass("relative", "min-h-0", "flex-1", "overflow-y-auto")
    expect(canvas).toContainElement(header)
    expect(screen.getAllByTestId("baseline-editor-column-header")).toHaveLength(1)
    expect(header).toHaveAttribute(
      "data-grid-template",
      TECHNICAL_CONFIGURATION_BASELINE_CRITERION_GRID_TEMPLATE
    )
    expect(Array.from(header.children).map((cell) => cell.textContent)).toEqual([
      "",
      "STT",
      "Mã",
      "Tiêu đề",
      "Yêu cầu",
      "Trạng thái",
      "Thao tác",
    ])
    expect(within(canvas).getAllByText("Tiêu đề")).toHaveLength(1)
    expect(within(canvas).queryByText("Vị trí")).not.toBeInTheDocument()
    expect(within(header).queryByRole("row")).not.toBeInTheDocument()
    expect(within(header).queryByRole("columnheader")).not.toBeInTheDocument()
  })

  it("keeps the toolbar outside the canvas and mounted across focus-mode changes", async () => {
    const user = userEvent.setup()
    render(<EditorHarness />)

    const toolbar = screen.getByTestId("baseline-editor-toolbar")
    const canvas = screen.getByRole("region", { name: "Các nhóm cấu hình cơ sở" })

    expect(canvas).not.toContainElement(toolbar)
    await user.click(screen.getByRole("button", { name: "Mở rộng vùng chỉnh sửa" }))
    expect(screen.getByTestId("baseline-editor-toolbar")).toBe(toolbar)
    expect(screen.getByRole("button", { name: "Thu nhỏ vùng chỉnh sửa" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
  })

  it("preserves save status, disable rules, and exact in-flight feedback", () => {
    const { rerender } = render(
      <EditorHarness status={{ ...defaultStatus, dirty: false, saveStatus: "saved" }} />
    )

    expect(screen.getByText("Đã lưu")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled()

    rerender(<EditorHarness status={{ ...defaultStatus, saving: true }} />)

    const savingButton = screen.getByRole("button", { name: "Đang lưu..." })
    expect(savingButton).toBeDisabled()
    expect(savingButton.querySelector(".animate-spin")).not.toBeNull()

    rerender(<EditorHarness status={{ ...defaultStatus, hasPendingBulkInput: true }} />)

    expect(
      screen.getByText("Hoàn tất hoặc hủy phần nhập nhiều dòng trước khi lưu.")
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled()
  })

  it("does not add unrequested toolbar capabilities or block a small direct render", () => {
    const originalInnerWidth = window.innerWidth
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 360 })

    try {
      render(<EditorHarness />)

      expect(screen.getByTestId("baseline-editor-workspace")).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Tìm kiếm" })).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Xem trước" })).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Thu gọn tất cả" })).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Mở rộng tất cả" })).not.toBeInTheDocument()
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      })
    }
  })
})
