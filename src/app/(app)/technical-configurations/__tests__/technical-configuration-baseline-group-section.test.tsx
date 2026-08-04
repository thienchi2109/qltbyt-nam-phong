import { useState } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
  TechnicalConfigurationBaselineGroupSection,
  type TechnicalConfigurationBaselineGroupSectionProps,
} from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineGroupSection"
import type {
  TechnicalConfigurationEntryMode,
  TechnicalConfigurationFocusTarget,
} from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor"
import type { TechnicalConfigurationBulkEntrySession } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBulkEntrySessions"
import type { TechnicalConfigurationBaselineEditorGroup } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"

const group: TechnicalConfigurationBaselineEditorGroup = {
  key: "group-2",
  id: "group-2",
  name: "Yêu cầu kỹ thuật",
  criteria: [
    {
      key: "criterion-1",
      id: "criterion-1",
      criterionCode: "TC-0001",
      title: "Nguồn điện",
      requirementText: "Nguồn điện ổn định",
    },
    {
      key: "criterion-2",
      id: "criterion-2",
      criterionCode: "TC-0002",
      title: "Áp lực",
      requirementText: "",
    },
  ],
}

const pendingBulkSession: TechnicalConfigurationBulkEntrySession = {
  input: "Yêu cầu thứ nhất\nYêu cầu thứ hai",
  preview: null,
}

type RenderGroupSectionOptions = {
  initialExpanded?: boolean
  initialMode?: TechnicalConfigurationEntryMode
  focusTarget?: TechnicalConfigurationFocusTarget
  disabled?: boolean
  groupError?: string
  bulkSession?: TechnicalConfigurationBulkEntrySession
}

type RenderGroupSectionResult = {
  callbacks: Record<string, ReturnType<typeof vi.fn>>
  events: string[]
}

function renderGroupSection({
  initialExpanded = true,
  initialMode = "row",
  focusTarget = null,
  disabled = false,
  groupError = "Tên nhóm là bắt buộc.",
  bulkSession = pendingBulkSession,
}: RenderGroupSectionOptions = {}): RenderGroupSectionResult {
  const events: string[] = []
  const callbacks = {
    onExpandedChange: vi.fn(),
    onModeChange: vi.fn(),
    onGroupNameChange: vi.fn(),
    onMoveGroup: vi.fn(),
    onDeleteGroup: vi.fn(),
    onCriterionTextChange: vi.fn(),
    onMoveCriterion: vi.fn(),
    onDeleteCriterion: vi.fn(),
    onAddCriterion: vi.fn(),
    onBulkInputChange: vi.fn(),
    onBulkPreview: vi.fn(),
    onBulkCancel: vi.fn(),
    onBulkAccept: vi.fn(),
  }

  function Harness(): React.JSX.Element {
    const [expanded, setExpanded] = useState(initialExpanded)
    const [mode, setMode] = useState<TechnicalConfigurationEntryMode>(initialMode)
    const props: TechnicalConfigurationBaselineGroupSectionProps = {
      group,
      groupIndex: 1,
      groupCount: 3,
      expanded,
      mode,
      bulkSession,
      groupError,
      criterionErrors: { "criterion-2": "Nội dung yêu cầu là bắt buộc." },
      summaryErrorCount: 2,
      pendingInputDescriptionId: "pending-bulk-status",
      disabled,
      focusTarget,
      recentlyAcceptedCriterionKeys: new Set(["criterion-1"]),
      onExpandedChange: (nextExpanded) => {
        events.push(`expanded:${nextExpanded}`)
        callbacks.onExpandedChange(nextExpanded)
        setExpanded(nextExpanded)
      },
      onModeChange: (groupKey, nextMode) => {
        callbacks.onModeChange(groupKey, nextMode)
        setMode(nextMode)
      },
      onGroupNameChange: callbacks.onGroupNameChange,
      onMoveGroup: callbacks.onMoveGroup,
      onDeleteGroup: callbacks.onDeleteGroup,
      onCriterionTextChange: callbacks.onCriterionTextChange,
      onMoveCriterion: callbacks.onMoveCriterion,
      onDeleteCriterion: callbacks.onDeleteCriterion,
      onAddCriterion: (groupKey) => {
        events.push(`add:${groupKey}`)
        callbacks.onAddCriterion(groupKey)
      },
      onBulkInputChange: callbacks.onBulkInputChange,
      onBulkPreview: callbacks.onBulkPreview,
      onBulkCancel: callbacks.onBulkCancel,
      onBulkAccept: callbacks.onBulkAccept,
    }

    return <TechnicalConfigurationBaselineGroupSection {...props} />
  }

  render(<Harness />)
  return { callbacks, events }
}

describe("TechnicalConfigurationBaselineGroupSection", () => {
  it("renders an expanded editable header with counts, validation, and pending status", () => {
    userEvent.setup()
    renderGroupSection()

    const disclosure = screen.getByRole("button", {
      name: "Thu gọn nhóm 2: Yêu cầu kỹ thuật",
    })
    const nameInput = screen.getByRole("textbox", { name: "Tên nhóm 2" })

    expect(disclosure).toHaveAttribute("aria-expanded", "true")
    expect(nameInput).toHaveValue("Yêu cầu kỹ thuật")
    expect(nameInput).toHaveAttribute("aria-invalid", "true")
    expect(nameInput).toHaveAccessibleDescription("Tên nhóm là bắt buộc.")
    expect(screen.getByText("2 tiêu chí")).toBeInTheDocument()
    expect(screen.getByText("2 lỗi")).toBeInTheDocument()
    expect(screen.getByText("Có nội dung nhập nhiều dòng")).toBeInTheDocument()
  })

  it("collapses content while keeping counts and pending status visible", async () => {
    const user = userEvent.setup()
    const { callbacks } = renderGroupSection()

    await user.click(screen.getByRole("button", { name: "Thu gọn nhóm 2: Yêu cầu kỹ thuật" }))

    expect(callbacks.onExpandedChange).toHaveBeenCalledWith(false)
    expect(screen.queryByRole("region", { name: "Nội dung nhóm 2" })).not.toBeInTheDocument()
    expect(screen.getByText("2 tiêu chí")).toBeInTheDocument()
    expect(screen.getByText("2 lỗi")).toBeInTheDocument()
    expect(screen.getByText("Có nội dung nhập nhiều dòng")).toBeInTheDocument()
  })

  it("toggles disclosure with Enter and Space", async () => {
    const user = userEvent.setup()
    const { callbacks } = renderGroupSection()

    await user.tab()
    expect(screen.getByRole("button", { name: /Thu gọn nhóm 2/ })).toHaveFocus()

    await user.keyboard("{Enter}")
    expect(callbacks.onExpandedChange).toHaveBeenLastCalledWith(false)

    await user.keyboard(" ")
    expect(callbacks.onExpandedChange).toHaveBeenLastCalledWith(true)
  })

  it("wires row-mode validation, highlights, edits, move, and delete callbacks", async () => {
    const user = userEvent.setup()
    const { callbacks } = renderGroupSection({ groupError: undefined })

    expect(screen.getByRole("region", { name: "Nội dung nhóm 2" })).toBeInTheDocument()
    expect(screen.getByLabelText("Nội dung yêu cầu 2.2")).toHaveAccessibleDescription(
      "Nội dung yêu cầu là bắt buộc."
    )
    expect(screen.getByTestId("criterion-row-criterion-1")).toHaveAttribute(
      "data-recently-accepted",
      "true"
    )

    const titleInput = screen.getByLabelText("Tiêu đề tiêu chí 2.1")
    await user.type(titleInput, "X")
    expect(callbacks.onCriterionTextChange).toHaveBeenLastCalledWith(
      "group-2",
      "criterion-1",
      "title",
      "Nguồn điệnX"
    )

    await user.click(screen.getByRole("button", { name: "Di chuyển tiêu chí 2.1 xuống" }))
    expect(callbacks.onMoveCriterion).toHaveBeenCalledWith("group-2", 0, 1)

    await user.click(screen.getByRole("button", { name: "Xóa tiêu chí 2.2" }))
    expect(callbacks.onDeleteCriterion).toHaveBeenCalledWith("group-2", "criterion-2")
  })

  it("renders the existing multiline workbench for the group session", () => {
    userEvent.setup()
    renderGroupSection({ initialMode: "bulk", groupError: undefined })

    expect(screen.getByLabelText("Nội dung nhập nhanh")).toHaveValue(pendingBulkSession.input)
    expect(screen.getByText("2 tiêu chí hiện có trong bản nháp")).toBeInTheDocument()
    expect(
      screen.getByText("Mỗi dòng tạo một tiêu chí mới trong nhóm Yêu cầu kỹ thuật.")
    ).toBeInTheDocument()
  })

  it("switches group modes through the header action", async () => {
    const user = userEvent.setup()
    const { callbacks } = renderGroupSection({ groupError: undefined })

    await user.click(screen.getByRole("button", { name: /Nhập nhiều dòng/ }))
    expect(callbacks.onModeChange).toHaveBeenLastCalledWith("group-2", "bulk")

    await user.click(screen.getByRole("button", { name: /Chỉnh từng dòng/ }))
    expect(callbacks.onModeChange).toHaveBeenLastCalledWith("group-2", "row")
  })

  it("keeps delete focusable but blocks it while the group has pending input", async () => {
    const user = userEvent.setup()
    const { callbacks } = renderGroupSection({ groupError: undefined })

    const deleteButton = screen.getByRole("button", { name: "Xóa nhóm 2" })
    expect(deleteButton).not.toBeDisabled()
    expect(deleteButton).toHaveAttribute("aria-disabled", "true")
    expect(deleteButton).toHaveAttribute("aria-describedby", "pending-bulk-status")

    await user.click(deleteButton)
    expect(callbacks.onDeleteGroup).not.toHaveBeenCalled()
  })

  it("expands before adding a criterion and renders one add control", async () => {
    const user = userEvent.setup()
    const { callbacks, events } = renderGroupSection({
      initialExpanded: false,
      groupError: undefined,
    })

    const addButtons = screen.getAllByRole("button", { name: "Thêm tiêu chí vào nhóm 2" })
    expect(addButtons).toHaveLength(1)
    await user.click(addButtons[0])

    expect(callbacks.onExpandedChange).toHaveBeenCalledWith(true)
    expect(callbacks.onAddCriterion).toHaveBeenCalledWith("group-2")
    expect(events).toEqual(["expanded:true", "add:group-2"])
  })

  it.each([
    {
      name: "add criterion",
      focusTarget: {
        kind: "add-criterion",
        key: "group-2",
        token: 1,
      } as TechnicalConfigurationFocusTarget,
      target: () => screen.getByRole("button", { name: "Thêm tiêu chí vào nhóm 2" }),
    },
    {
      name: "group disclosure",
      focusTarget: {
        kind: "group-disclosure",
        key: "group-2",
        token: 2,
      } as TechnicalConfigurationFocusTarget,
      target: () => screen.getByRole("button", { name: /Thu gọn nhóm 2/ }),
    },
    {
      name: "group mode action",
      focusTarget: {
        kind: "group-mode-action",
        key: "group-2",
        token: 3,
      } as TechnicalConfigurationFocusTarget,
      target: () => screen.getByRole("button", { name: /Nhập nhiều dòng/ }),
    },
    {
      name: "group name",
      focusTarget: {
        kind: "group-name",
        key: "group-2",
        token: 4,
      } as TechnicalConfigurationFocusTarget,
      target: () => screen.getByRole("textbox", { name: "Tên nhóm 2" }),
    },
  ])("focuses the $name target", async ({ focusTarget, target }) => {
    userEvent.setup()
    renderGroupSection({ focusTarget, groupError: undefined })

    await waitFor(() => expect(target()).toHaveFocus())
  })

  it("preserves disabled move, delete, name, and validation semantics", () => {
    userEvent.setup()
    renderGroupSection({ disabled: true })

    expect(screen.getByRole("textbox", { name: "Tên nhóm 2" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Di chuyển nhóm 2 lên" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Di chuyển nhóm 2 xuống" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Xóa nhóm 2" })).toBeDisabled()
    expect(screen.getByText("Tên nhóm là bắt buộc.")).toHaveAttribute(
      "id",
      "baseline-group-group-2-error"
    )
  })
})
