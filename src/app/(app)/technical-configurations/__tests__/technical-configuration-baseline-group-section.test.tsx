import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { TechnicalConfigurationFocusTarget } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor"
import {
  group,
  pendingBulkSession,
  renderGroupSection,
} from "./technical-configuration-baseline-group-section-fixtures"

describe("TechnicalConfigurationBaselineGroupSection", () => {
  it("renders an expanded editable header with counts, validation, and pending status", () => {
    userEvent.setup()
    renderGroupSection()

    const disclosure = screen.getByRole("button", {
      name: "Thu gọn nhóm II: Yêu cầu kỹ thuật",
    })
    const nameInput = screen.getByRole("textbox", { name: "Tên nhóm II" })

    expect(disclosure).toHaveAttribute("aria-expanded", "true")
    expect(nameInput).toHaveValue("Yêu cầu kỹ thuật")
    expect(nameInput).toHaveAttribute("aria-invalid", "true")
    expect(nameInput).toHaveAccessibleDescription("Tên nhóm là bắt buộc.")
    expect(screen.getByText("2 tiêu chí")).toBeInTheDocument()
    expect(screen.getByText("2 lỗi")).toBeInTheDocument()
    expect(screen.getByText("Có nội dung nhập nhiều dòng")).toBeInTheDocument()
  })

  it("renders and edits a literal hyphen title in the shared criterion tree-grid row", async () => {
    const user = userEvent.setup()
    const { callbacks } = renderGroupSection({
      groupValue: {
        ...group,
        criteria: [{ ...group.criteria[0], title: "-" }],
      },
      groupError: undefined,
      bulkSession: { input: "", preview: null },
    })

    const row = screen.getByTestId("criterion-row-criterion-1")
    const titleInput = within(row).getByLabelText("Tiêu đề tiêu chí trực tiếp 1 của nhóm II")

    expect(row).toHaveAttribute("data-criterion-row", "true")
    expect(row).toHaveAttribute("data-owner-kind", "group")
    expect(titleInput).toHaveValue("-")
    expect(titleInput).not.toHaveAttribute("placeholder")
    expect(titleInput).toHaveClass("border-transparent", "shadow-none")
    expect(
      within(row).getByRole("button", {
        name: "Kéo để sắp xếp tiêu chí trực tiếp 1 của nhóm II",
      })
    ).toBeInTheDocument()
    expect(within(row).getByRole("img", { name: "Hợp lệ" })).toBeInTheDocument()
    expect(screen.queryByText("Vị trí")).not.toBeInTheDocument()

    await user.type(titleInput, "X")
    expect(callbacks.onCriterionTextChange).toHaveBeenLastCalledWith(
      "group-2",
      "criterion-1",
      "title",
      "-X"
    )
  })

  it("renders a stable direct-group criterion drop zone when the owner is empty", () => {
    renderGroupSection({
      groupValue: { ...group, criteria: [] },
      groupError: undefined,
      bulkSession: { input: "", preview: null },
    })

    const dropZone = screen.getByTestId("criterion-drop-zone-group-group-2")
    expect(dropZone).toHaveAttribute("id", "baseline-criterion-drop-zone-group-group-2")
    expect(dropZone).toHaveAttribute("data-criterion-drop-zone", "true")
    expect(dropZone).toHaveAttribute("data-drop-slot", "criterion")
    expect(dropZone).toHaveAttribute("data-owner-kind", "group")
    expect(dropZone).toHaveAttribute("data-owner-group-key", "group-2")
    expect(dropZone).toHaveTextContent("Nhóm này chưa có tiêu chí.")
  })

  it("collapses content while keeping counts and pending status visible", async () => {
    const user = userEvent.setup()
    const { callbacks } = renderGroupSection()

    await user.click(screen.getByRole("button", { name: "Thu gọn nhóm II: Yêu cầu kỹ thuật" }))

    expect(callbacks.onExpandedChange).toHaveBeenCalledWith(false)
    expect(screen.queryByRole("region", { name: "Nội dung nhóm II" })).not.toBeInTheDocument()
    expect(screen.getByText("2 tiêu chí")).toBeInTheDocument()
    expect(screen.getByText("2 lỗi")).toBeInTheDocument()
    expect(screen.getByText("Có nội dung nhập nhiều dòng")).toBeInTheDocument()
  })

  it("toggles disclosure with Enter and Space", async () => {
    const user = userEvent.setup()
    const { callbacks } = renderGroupSection()

    await user.tab()
    expect(screen.getByRole("button", { name: /Thu gọn nhóm II/ })).toHaveFocus()

    await user.keyboard("{Enter}")
    expect(callbacks.onExpandedChange).toHaveBeenLastCalledWith(false)

    await user.keyboard(" ")
    expect(callbacks.onExpandedChange).toHaveBeenLastCalledWith(true)
  })

  it("wires row-mode validation, highlights, edits, move, and delete callbacks", async () => {
    const user = userEvent.setup()
    const { callbacks } = renderGroupSection({ groupError: undefined })

    expect(screen.getByRole("region", { name: "Nội dung nhóm II" })).toBeInTheDocument()
    expect(
      screen.getByLabelText("Nội dung yêu cầu tiêu chí trực tiếp 2 của nhóm II")
    ).toHaveAccessibleDescription("Nội dung yêu cầu là bắt buộc.")
    expect(screen.getByTestId("criterion-row-criterion-1")).toHaveAttribute(
      "data-recently-accepted",
      "true"
    )

    const titleInput = screen.getByLabelText("Tiêu đề tiêu chí trực tiếp 1 của nhóm II")
    await user.type(titleInput, "X")
    expect(callbacks.onCriterionTextChange).toHaveBeenLastCalledWith(
      "group-2",
      "criterion-1",
      "title",
      "Nguồn điệnX"
    )

    await user.click(
      screen.getByRole("button", { name: "Di chuyển tiêu chí trực tiếp 1 của nhóm II xuống" })
    )
    expect(callbacks.onMoveCriterion).toHaveBeenCalledWith("group-2", 0, 1)

    await user.click(screen.getByRole("button", { name: "Xóa tiêu chí trực tiếp 2 của nhóm II" }))
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

    const deleteButton = screen.getByRole("button", { name: "Xóa nhóm II" })
    expect(deleteButton).not.toBeDisabled()
    expect(deleteButton).toHaveAttribute("aria-disabled", "true")
    expect(deleteButton).toHaveAttribute("aria-describedby", "pending-bulk-status")

    await user.click(deleteButton)
    expect(callbacks.onDeleteGroup).not.toHaveBeenCalled()
  })

  it("blocks parent deletion while a subgroup has pending multiline input", async () => {
    const user = userEvent.setup()
    const subgroupKey = "subgroup-1"
    const { callbacks } = renderGroupSection({
      groupValue: {
        ...group,
        subgroups: [
          {
            key: subgroupKey,
            id: subgroupKey,
            name: "Hạ tầng",
            criteria: [],
          },
        ],
      },
      groupError: undefined,
      bulkSession: { input: "", preview: null },
      hierarchyAuthoring: {
        activeOwnerKey: subgroupKey,
        entryMode: "bulk",
        getBulkSession: (ownerKey) =>
          ownerKey === subgroupKey ? pendingBulkSession : { input: "", preview: null },
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
      },
    })

    const deleteButton = screen.getByRole("button", { name: "Xóa nhóm II" })
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

    const addButtons = screen.getAllByRole("button", { name: "Thêm tiêu chí vào nhóm II" })
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
      target: () => screen.getByRole("button", { name: "Thêm tiêu chí vào nhóm II" }),
    },
    {
      name: "group disclosure",
      focusTarget: {
        kind: "group-disclosure",
        key: "group-2",
        token: 2,
      } as TechnicalConfigurationFocusTarget,
      target: () => screen.getByRole("button", { name: /Thu gọn nhóm II/ }),
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
      target: () => screen.getByRole("textbox", { name: "Tên nhóm II" }),
    },
  ])("focuses the $name target", async ({ focusTarget, target }) => {
    userEvent.setup()
    renderGroupSection({ focusTarget, groupError: undefined })

    await waitFor(() => expect(target()).toHaveFocus())
  })

  it("renders locked content without edit, move, delete, or drag affordances", () => {
    userEvent.setup()
    renderGroupSection({ disabled: true })

    expect(screen.queryByRole("textbox", { name: "Tên nhóm II" })).not.toBeInTheDocument()
    expect(screen.getByLabelText("Tên nhóm II")).toHaveTextContent("Yêu cầu kỹ thuật")
    expect(screen.getByLabelText("Tiêu đề tiêu chí trực tiếp 1 của nhóm II")).toHaveTextContent(
      "Nguồn điện"
    )
    expect(
      screen.getByLabelText("Nội dung yêu cầu tiêu chí trực tiếp 1 của nhóm II")
    ).toHaveTextContent("Nguồn điện ổn định")
    expect(screen.queryByRole("button", { name: "Di chuyển nhóm II lên" })).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Di chuyển nhóm II xuống" })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Xóa nhóm II" })).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText("Kéo để sắp xếp tiêu chí trực tiếp 1 của nhóm II")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", {
        name: "Di chuyển tiêu chí trực tiếp 1 của nhóm II xuống",
      })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Xóa tiêu chí trực tiếp 1 của nhóm II" })
    ).not.toBeInTheDocument()
    expect(screen.getByText("Tên nhóm là bắt buộc.")).toHaveAttribute(
      "id",
      "baseline-group-group-2-error"
    )
  })
})
