import "@testing-library/jest-dom"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TECHNICAL_CONFIGURATION_BASELINE_CRITERION_GRID_TEMPLATE } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineCriterionRow"
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
  it("renders the selected group in the shared stable columns", () => {
    render(
      <TechnicalConfigurationCriteriaSpreadsheet
        group={group}
        groupIndex={2}
        criterionErrors={{ "criterion-new": "Nội dung yêu cầu là bắt buộc." }}
        readOnly={false}
        disabled={false}
        focusCriterionKey={null}
        focusCriterionToken={null}
        recentlyAcceptedCriterionKeys={new Set(["criterion-new"])}
        onCriterionTextChange={vi.fn()}
        onMoveCriterion={vi.fn()}
        onDeleteCriterion={vi.fn()}
      />
    )

    expect(screen.getByTestId("criterion-row-criterion-1")).toHaveAttribute(
      "data-grid-template",
      TECHNICAL_CONFIGURATION_BASELINE_CRITERION_GRID_TEMPLATE
    )
    expect(screen.getByText("TC-0001")).toBeInTheDocument()
    expect(screen.getByText("Mới")).toBeInTheDocument()
    const requirement = screen.getByLabelText("Nội dung yêu cầu tiêu chí trực tiếp 2 của nhóm II")
    const error = screen.getByText("Nội dung yêu cầu là bắt buộc.")
    expect(error).toHaveAttribute("id", "baseline-requirement-error-criterion-new")
    expect(requirement).toHaveAttribute("aria-describedby", error.id)
    expect(screen.getByTestId("criterion-row-criterion-new")).toHaveAttribute(
      "data-recently-accepted",
      "true"
    )
  })

  it("reports exact edit, move, and delete commands", async () => {
    const user = userEvent.setup()
    const onCriterionTextChange = vi.fn()
    const onMoveCriterion = vi.fn()
    const onDeleteCriterion = vi.fn()

    render(
      <TechnicalConfigurationCriteriaSpreadsheet
        group={group}
        groupIndex={2}
        criterionErrors={{}}
        readOnly={false}
        disabled={false}
        focusCriterionKey={null}
        focusCriterionToken={null}
        recentlyAcceptedCriterionKeys={new Set()}
        onCriterionTextChange={onCriterionTextChange}
        onMoveCriterion={onMoveCriterion}
        onDeleteCriterion={onDeleteCriterion}
      />
    )

    await user.type(screen.getByLabelText("Tiêu đề tiêu chí trực tiếp 1 của nhóm II"), "X")
    expect(onCriterionTextChange).toHaveBeenLastCalledWith("criterion-1", "title", "Nguồn điệnX")

    await user.type(screen.getByLabelText("Nội dung yêu cầu tiêu chí trực tiếp 1 của nhóm II"), "Y")
    expect(onCriterionTextChange).toHaveBeenLastCalledWith(
      "criterion-1",
      "requirementText",
      "Nguồn điện ổn địnhY"
    )

    await user.click(
      screen.getByRole("button", {
        name: "Di chuyển tiêu chí trực tiếp 2 của nhóm II lên",
      })
    )
    expect(onMoveCriterion).toHaveBeenCalledWith(1, -1)

    await user.click(screen.getByRole("button", { name: "Xóa tiêu chí trực tiếp 1 của nhóm II" }))
    expect(onDeleteCriterion).toHaveBeenCalledWith("criterion-1")
  })

  it("focuses the requested requirement cell", async () => {
    render(
      <TechnicalConfigurationCriteriaSpreadsheet
        group={group}
        groupIndex={2}
        criterionErrors={{}}
        readOnly={false}
        disabled={false}
        focusCriterionKey="criterion-new"
        focusCriterionToken={1}
        recentlyAcceptedCriterionKeys={new Set()}
        onCriterionTextChange={vi.fn()}
        onMoveCriterion={vi.fn()}
        onDeleteCriterion={vi.fn()}
      />
    )

    await waitFor(() =>
      expect(
        screen.getByLabelText("Nội dung yêu cầu tiêu chí trực tiếp 2 của nhóm II")
      ).toHaveFocus()
    )
  })
})
