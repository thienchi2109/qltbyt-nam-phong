import "@testing-library/jest-dom"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationCriteriaSpreadsheet } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationCriteriaSpreadsheet"
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
      key: "criterion-new",
      id: null,
      criterionCode: null,
      title: "",
      requirementText: "",
    },
  ],
}

describe("TechnicalConfigurationCriteriaSpreadsheet", () => {
  it("renders the selected group as editable stable columns", () => {
    render(
      <TechnicalConfigurationCriteriaSpreadsheet
        group={group}
        groupIndex={2}
        criterionErrors={{ "criterion-new": "Nội dung yêu cầu là bắt buộc." }}
        disabled={false}
        focusCriterionKey={null}
        focusAddCriterionToken={null}
        recentlyAcceptedCriterionKeys={new Set(["criterion-new"])}
        onCriterionTextChange={vi.fn()}
        onMoveCriterion={vi.fn()}
        onDeleteCriterion={vi.fn()}
        onAddCriterion={vi.fn()}
      />
    )

    expect(screen.getByText("Mã")).toBeInTheDocument()
    expect(screen.getByText("Tiêu đề")).toBeInTheDocument()
    expect(screen.getByText("Nội dung yêu cầu")).toBeInTheDocument()
    expect(screen.getByText("Trạng thái")).toBeInTheDocument()
    expect(screen.getByText("TC-0001")).toBeInTheDocument()
    expect(screen.getByText("Mới")).toBeInTheDocument()
    const requirement = screen.getByLabelText("Nội dung yêu cầu 2.2")
    const error = screen.getByText("Nội dung yêu cầu là bắt buộc.")
    expect(error).toHaveAttribute("id", "baseline-requirement-error-criterion-new")
    expect(requirement).toHaveAttribute("aria-describedby", error.id)
    expect(screen.getByTestId("criterion-row-criterion-new")).toHaveAttribute(
      "data-recently-accepted",
      "true"
    )
  })

  it("reports exact edit, move, delete, and add commands", async () => {
    const user = userEvent.setup()
    const onCriterionTextChange = vi.fn()
    const onMoveCriterion = vi.fn()
    const onDeleteCriterion = vi.fn()
    const onAddCriterion = vi.fn()

    render(
      <TechnicalConfigurationCriteriaSpreadsheet
        group={group}
        groupIndex={2}
        criterionErrors={{}}
        disabled={false}
        focusCriterionKey={null}
        focusAddCriterionToken={null}
        recentlyAcceptedCriterionKeys={new Set()}
        onCriterionTextChange={onCriterionTextChange}
        onMoveCriterion={onMoveCriterion}
        onDeleteCriterion={onDeleteCriterion}
        onAddCriterion={onAddCriterion}
      />
    )

    fireEvent.change(screen.getByLabelText("Tiêu đề tiêu chí 2.1"), {
      target: { value: "Điện áp" },
    })
    expect(onCriterionTextChange).toHaveBeenLastCalledWith("criterion-1", "title", "Điện áp")

    fireEvent.change(screen.getByLabelText("Nội dung yêu cầu 2.1"), {
      target: { value: "220V" },
    })
    expect(onCriterionTextChange).toHaveBeenLastCalledWith("criterion-1", "requirementText", "220V")

    await user.click(screen.getByRole("button", { name: "Di chuyển tiêu chí 2.2 lên" }))
    expect(onMoveCriterion).toHaveBeenCalledWith(1, -1)

    await user.click(screen.getByRole("button", { name: "Xóa tiêu chí 2.1" }))
    expect(onDeleteCriterion).toHaveBeenCalledWith("criterion-1")

    await user.click(screen.getByRole("button", { name: "Thêm tiêu chí vào nhóm 2" }))
    expect(onAddCriterion).toHaveBeenCalledTimes(1)
  })

  it("focuses the requested requirement cell", async () => {
    render(
      <TechnicalConfigurationCriteriaSpreadsheet
        group={group}
        groupIndex={2}
        criterionErrors={{}}
        disabled={false}
        focusCriterionKey="criterion-new"
        focusAddCriterionToken={null}
        recentlyAcceptedCriterionKeys={new Set()}
        onCriterionTextChange={vi.fn()}
        onMoveCriterion={vi.fn()}
        onDeleteCriterion={vi.fn()}
        onAddCriterion={vi.fn()}
      />
    )

    await waitFor(() => expect(screen.getByLabelText("Nội dung yêu cầu 2.2")).toHaveFocus())
  })
})
