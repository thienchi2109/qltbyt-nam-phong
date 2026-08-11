import { useState } from "react"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import {
  TechnicalConfigurationBaselineEditor,
  type TechnicalConfigurationFocusTarget,
} from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor"
import type {
  TechnicalConfigurationBaselineEditorDraft,
  TechnicalConfigurationBaselineEditorValidation,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"

const hierarchyDraft: TechnicalConfigurationBaselineEditorDraft = {
  id: "draft-hierarchy",
  dossierId: "dossier-1",
  status: "draft",
  revision: 4,
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
          title: "Nguồn điện",
          requirementText: "Nguồn điện ổn định",
        },
      ],
      subgroups: [
        {
          key: "subgroup-a",
          id: "subgroup-a",
          name: "Hạ tầng",
          criteria: [
            {
              key: "criterion-subgroup",
              id: "criterion-subgroup",
              criterionCode: "TC-0002",
              title: "Tiếp địa",
              requirementText: "Có hệ thống tiếp địa riêng",
            },
          ],
        },
      ],
    },
    {
      key: "section-b",
      id: "section-b",
      name: "Yêu cầu bổ sung",
      criteria: [],
      subgroups: [],
    },
  ],
}

const emptyValidation: TechnicalConfigurationBaselineEditorValidation = {
  groupErrors: {},
  subgroupErrors: {},
  criterionErrors: {},
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

function HierarchyHarness({
  validation = emptyValidation,
  initialMode = "row",
  initialPendingInput = "",
}: {
  validation?: TechnicalConfigurationBaselineEditorValidation
  initialMode?: "row" | "bulk"
  initialPendingInput?: string
}): React.JSX.Element {
  const [focusTarget, setFocusTarget] = useState<TechnicalConfigurationFocusTarget>(null)
  const [entryMode, setEntryMode] = useState<"row" | "bulk">(initialMode)
  const [pendingInput, setPendingInput] = useState(initialPendingInput)

  return (
    <>
      <button
        type="button"
        onClick={() =>
          setFocusTarget((current) => ({
            kind: "criterion",
            key: "criterion-subgroup",
            token: current?.kind === "criterion" ? current.token + 1 : 1,
          }))
        }
      >
        Tập trung tiêu chí nhóm con
      </button>
      <TechnicalConfigurationBaselineEditor
        draft={hierarchyDraft}
        validation={validation}
        summaryValidation={validation}
        status={{
          dirty: false,
          saving: false,
          editingDisabled: false,
          conflict: false,
          saveStatus: "idle",
          hasPendingBulkInput: pendingInput.trim().length > 0,
        }}
        isFocusMode={false}
        activeValue="section-a"
        entryMode={entryMode}
        getBulkSession={() => ({ input: pendingInput, preview: null })}
        focusTarget={focusTarget}
        recentlyAcceptedCriterionKeys={new Set()}
        onGroupModeChange={(_, mode) => setEntryMode(mode)}
        onAddGroup={vi.fn()}
        onGroupNameChange={vi.fn()}
        onMoveGroup={vi.fn()}
        onDeleteGroup={vi.fn()}
        onCriterionTextChange={vi.fn()}
        onMoveCriterion={vi.fn()}
        onDeleteCriterion={vi.fn()}
        onAddCriterion={vi.fn()}
        onBulkInputChange={setPendingInput}
        onBulkPreview={vi.fn()}
        onBulkCancel={() => setPendingInput("")}
        onBulkAccept={vi.fn()}
        onSave={vi.fn()}
      />
    </>
  )
}

describe("technical configuration baseline subgroup presentation", () => {
  it("renders the canonical section, direct criterion, subgroup, and subgroup criterion order", () => {
    render(<HierarchyHarness />)

    const sectionName = screen.getByLabelText("Tên nhóm I")
    const directRequirement = screen.getByLabelText(
      "Nội dung yêu cầu tiêu chí trực tiếp 1 của nhóm I"
    )
    const subgroupDisclosure = screen.getByRole("button", {
      name: "Thu gọn nhóm con 1 của nhóm I: Hạ tầng",
    })
    const subgroupRequirement = screen.getByLabelText(
      "Nội dung yêu cầu tiêu chí 1 của nhóm con 1, nhóm I"
    )

    expect(sectionName.compareDocumentPosition(directRequirement)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
    expect(directRequirement.compareDocumentPosition(subgroupDisclosure)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
    expect(subgroupDisclosure.compareDocumentPosition(subgroupRequirement)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
    expect(
      screen.getByRole("region", { name: "Nhóm con 1 của nhóm I: Hạ tầng" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Thu gọn nhóm II: Yêu cầu bổ sung" })
    ).toBeInTheDocument()
    expect(screen.queryByLabelText("Nội dung yêu cầu 1.1")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Nội dung yêu cầu 1.1.1")).not.toBeInTheDocument()
  })

  it("keeps section and subgroup disclosure independent with native keyboard controls", async () => {
    const user = userEvent.setup()
    render(<HierarchyHarness />)

    const sectionDisclosure = screen.getByRole("button", {
      name: "Thu gọn nhóm I: Yêu cầu chung",
    })
    const subgroupDisclosure = screen.getByRole("button", {
      name: "Thu gọn nhóm con 1 của nhóm I: Hạ tầng",
    })

    subgroupDisclosure.focus()
    await user.keyboard("{Enter}")

    expect(subgroupDisclosure).toHaveAttribute("aria-expanded", "false")
    expect(
      screen.getByLabelText("Nội dung yêu cầu tiêu chí trực tiếp 1 của nhóm I")
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText("Nội dung yêu cầu tiêu chí 1 của nhóm con 1, nhóm I")
    ).not.toBeInTheDocument()

    await user.click(sectionDisclosure)
    expect(sectionDisclosure).toHaveAttribute("aria-expanded", "false")
    await user.click(sectionDisclosure)

    const restoredSubgroupDisclosure = screen.getByRole("button", {
      name: "Mở rộng nhóm con 1 của nhóm I: Hạ tầng",
    })
    expect(restoredSubgroupDisclosure).toHaveAttribute("aria-expanded", "false")

    restoredSubgroupDisclosure.focus()
    await user.keyboard(" ")
    expect(restoredSubgroupDisclosure).toHaveAttribute("aria-expanded", "true")
    expect(
      screen.getByLabelText("Nội dung yêu cầu tiêu chí 1 của nhóm con 1, nhóm I")
    ).toBeInTheDocument()
  })

  it("expands both structural levels and focuses a subgroup criterion target", async () => {
    const user = userEvent.setup()
    render(<HierarchyHarness />)

    await user.click(
      screen.getByRole("button", {
        name: "Thu gọn nhóm con 1 của nhóm I: Hạ tầng",
      })
    )
    const sectionDisclosure = screen.getByRole("button", {
      name: "Thu gọn nhóm I: Yêu cầu chung",
    })
    await user.click(sectionDisclosure)
    await user.click(screen.getByRole("button", { name: "Tập trung tiêu chí nhóm con" }))

    await waitFor(() => expect(sectionDisclosure).toHaveAttribute("aria-expanded", "true"))
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Thu gọn nhóm con 1 của nhóm I: Hạ tầng",
        })
      ).toHaveAttribute("aria-expanded", "true")
    )

    const subgroupRequirement = screen.getByLabelText(
      "Nội dung yêu cầu tiêu chí 1 của nhóm con 1, nhóm I"
    )
    await waitFor(() => expect(subgroupRequirement).toHaveFocus())
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ block: "nearest" })

    const subgroupDisclosure = screen.getByRole("button", {
      name: "Thu gọn nhóm con 1 của nhóm I: Hạ tầng",
    })
    await user.click(subgroupDisclosure)
    expect(subgroupDisclosure).toHaveAttribute("aria-expanded", "false")
    expect(
      screen.queryByLabelText("Nội dung yêu cầu tiêu chí 1 của nhóm con 1, nhóm I")
    ).not.toBeInTheDocument()

    await user.click(sectionDisclosure)
    await user.click(sectionDisclosure)
    const restoredCollapsedSubgroupDisclosure = screen.getByRole("button", {
      name: "Mở rộng nhóm con 1 của nhóm I: Hạ tầng",
    })
    expect(restoredCollapsedSubgroupDisclosure).toHaveAttribute("aria-expanded", "false")

    await user.click(screen.getByRole("button", { name: "Tập trung tiêu chí nhóm con" }))
    await waitFor(() =>
      expect(restoredCollapsedSubgroupDisclosure).toHaveAttribute("aria-expanded", "true")
    )
    await waitFor(() =>
      expect(
        screen.getByLabelText("Nội dung yêu cầu tiêu chí 1 của nhóm con 1, nhóm I")
      ).toHaveFocus()
    )
  })

  it("associates subgroup validation and keeps structural presentation responsive and read-only", () => {
    render(
      <HierarchyHarness
        validation={{
          groupErrors: {},
          subgroupErrors: { "subgroup-a": "Tên nhóm con là bắt buộc." },
          criterionErrors: {
            "criterion-subgroup": "Nội dung nhóm con là bắt buộc.",
          },
        }}
      />
    )

    const subgroupDisclosure = screen.getByRole("button", {
      name: "Thu gọn nhóm con 1 của nhóm I: Hạ tầng",
    })
    const subgroupRequirement = screen.getByLabelText(
      "Nội dung yêu cầu tiêu chí 1 của nhóm con 1, nhóm I"
    )
    const subgroupRegion = screen.getByTestId("baseline-subgroup-subgroup-a")
    const criterionGrid = screen.getByTestId("baseline-subgroup-criterion-grid")

    expect(subgroupDisclosure).toHaveAccessibleDescription("Tên nhóm con là bắt buộc.")
    expect(subgroupRequirement).toHaveAccessibleDescription("Nội dung nhóm con là bắt buộc.")
    expect(subgroupRequirement).toHaveAttribute("readonly")
    expect(subgroupRegion).toHaveClass("min-w-0")
    expect(criterionGrid.className).toContain("grid-cols-1")
    expect(criterionGrid.className).toContain("md:grid-cols-2")
    expect(criterionGrid.className).toMatch(/xl:grid-cols-/)
    expect(criterionGrid.className).not.toContain("min-w-[")
    expect(criterionGrid.className).not.toContain("minmax(12rem")
    expect(criterionGrid.className).not.toContain("minmax(20rem")
    expect(screen.getAllByText("2 lỗi")).toHaveLength(2)

    expect(screen.queryByRole("button", { name: /Thêm nhóm con/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Xóa nhóm con/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Di chuyển nhóm con/i })).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Thêm tiêu chí vào nhóm con/i })
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Phản hồi|Đánh giá/i)).not.toBeInTheDocument()
  })

  it("preserves a pending direct multiline buffer across section collapse and restore", async () => {
    const user = userEvent.setup()
    render(
      <HierarchyHarness initialMode="bulk" initialPendingInput={"Yêu cầu mới\nDòng tiếp theo"} />
    )

    const sectionDisclosure = screen.getByRole("button", {
      name: "Thu gọn nhóm I: Yêu cầu chung",
    })
    const bulkInput = screen.getByRole("textbox", { name: "Nội dung nhập nhanh" })
    expect(bulkInput).toHaveValue("Yêu cầu mới\nDòng tiếp theo")

    await user.click(sectionDisclosure)
    expect(screen.queryByRole("textbox", { name: "Nội dung nhập nhanh" })).not.toBeInTheDocument()
    await user.click(sectionDisclosure)

    expect(screen.getByRole("textbox", { name: "Nội dung nhập nhanh" })).toHaveValue(
      "Yêu cầu mới\nDòng tiếp theo"
    )
    expect(
      screen.getByText("Hoàn tất hoặc hủy phần nhập nhiều dòng trước khi lưu.")
    ).toBeInTheDocument()
  })
})
