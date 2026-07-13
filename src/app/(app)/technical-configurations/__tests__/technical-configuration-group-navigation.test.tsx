import "@testing-library/jest-dom"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationAllGroupsOverview } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationAllGroupsOverview"
import { ALL_GROUPS_VALUE } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationGroupNavigation"
import { TechnicalConfigurationGroupNavigator } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationGroupNavigator"
import type { TechnicalConfigurationBaselineEditorDraft } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"

const draft: TechnicalConfigurationBaselineEditorDraft = {
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
          title: "Điện",
          requirementText: "Nguồn điện ổn định",
        },
        {
          key: "criterion-new",
          id: null,
          criterionCode: null,
          title: "",
          requirementText: "",
        },
      ],
    },
    {
      key: "group-2",
      id: "group-2",
      name: "",
      criteria: [
        {
          key: "criterion-2",
          id: "criterion-2",
          criterionCode: "TC-0002",
          title: "Áp lực",
          requirementText: "Áp lực tối thiểu 3 bar",
        },
      ],
    },
  ],
}

const validation = {
  groupErrors: { "group-2": "Tên nhóm là bắt buộc." },
  criterionErrors: { "criterion-new": "Nội dung yêu cầu là bắt buộc." },
}

describe("technical configuration group navigation", () => {
  it("shows group counts, fallback names, errors, and all-groups activation", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()

    render(
      <TechnicalConfigurationGroupNavigator
        groups={draft.groups}
        activeValue="group-1"
        validation={validation}
        focusGroupRequest={null}
        onValueChange={onValueChange}
      />
    )

    expect(screen.getByRole("tab", { name: /Yêu cầu chung.*2 tiêu chí/ })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    expect(screen.getByRole("tab", { name: /Nhóm 2.*1 tiêu chí.*1 lỗi/ })).toBeInTheDocument()

    const first = screen.getByRole("tab", { name: /Yêu cầu chung/ })
    first.focus()
    await user.keyboard("{End}")
    const overviewTab = screen.getByRole("tab", { name: "Xem tất cả nhóm" })
    await waitFor(() => expect(overviewTab).toHaveFocus())
    await user.keyboard("{Enter}")
    await waitFor(() => expect(onValueChange).toHaveBeenLastCalledWith(ALL_GROUPS_VALUE))
  })

  it("reuses group tab metadata when only active navigation state changes", () => {
    let groupNameReads = 0
    const trackedGroup = { ...draft.groups[0] }
    Object.defineProperty(trackedGroup, "name", {
      enumerable: true,
      get() {
        groupNameReads += 1
        return "Yêu cầu chung"
      },
    })
    const groups = [trackedGroup, draft.groups[1]]
    const onValueChange = vi.fn()
    const { rerender } = render(
      <TechnicalConfigurationGroupNavigator
        groups={groups}
        activeValue="group-1"
        validation={validation}
        focusGroupRequest={null}
        onValueChange={onValueChange}
      />
    )
    const initialReads = groupNameReads

    rerender(
      <TechnicalConfigurationGroupNavigator
        groups={groups}
        activeValue="group-2"
        validation={validation}
        focusGroupRequest={{ groupKey: "group-2", token: 1 }}
        onValueChange={onValueChange}
      />
    )

    expect(groupNameReads).toBe(initialReads)
  })

  it("filters the read-only overview and reports criterion activation", async () => {
    const user = userEvent.setup()
    const onCriterionActivate = vi.fn()

    render(
      <TechnicalConfigurationAllGroupsOverview
        draft={draft}
        validation={validation}
        onCriterionActivate={onCriterionActivate}
      />
    )

    expect(screen.getByRole("heading", { name: "Xem tất cả nhóm" })).toHaveFocus()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(screen.getByText("TC-0001")).toBeInTheDocument()
    expect(screen.getByText("Mới")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Có lỗi" }))
    expect(screen.getByText("Nội dung yêu cầu là bắt buộc.")).toBeInTheDocument()
    expect(screen.getByText("Tên nhóm là bắt buộc.")).toBeInTheDocument()
    expect(screen.getByText("TC-0002")).toBeInTheDocument()
    expect(screen.queryByText("TC-0001")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Mới thêm" }))
    expect(screen.getByText("Mới")).toBeInTheDocument()
    expect(screen.queryByText("TC-0002")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Mở tiêu chí 1.2 để chỉnh sửa" }))
    expect(onCriterionActivate).toHaveBeenCalledWith("group-1", "criterion-new")
  })

  it("reuses the overview projection when only the activation callback changes", () => {
    let projectionReads = 0
    const trackedDraft = {
      ...draft,
      groups: new Proxy(draft.groups, {
        get(target, property, receiver) {
          if (property === "map") projectionReads += 1
          return Reflect.get(target, property, receiver)
        },
      }),
    }
    const { rerender } = render(
      <TechnicalConfigurationAllGroupsOverview
        draft={trackedDraft}
        validation={validation}
        onCriterionActivate={vi.fn()}
      />
    )
    const initialReads = projectionReads

    rerender(
      <TechnicalConfigurationAllGroupsOverview
        draft={trackedDraft}
        validation={validation}
        onCriterionActivate={vi.fn()}
      />
    )

    expect(projectionReads).toBe(initialReads)
  })
})
