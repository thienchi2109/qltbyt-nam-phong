import "@testing-library/jest-dom"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationEvaluationNavigatorDrawer } from "../_components/evaluation/TechnicalConfigurationEvaluationNavigatorDrawer"
import type { TechnicalConfigurationEvaluationHierarchyRow } from "../_components/evaluation/technical-configuration-evaluation-hierarchy"
import type { TechnicalConfigurationEvaluationCriterionListItem } from "../_components/evaluation/technical-configuration-evaluation-navigation"

const criterion: TechnicalConfigurationEvaluationCriterionListItem = {
  group: { id: "group-1", name: "Thông số chính", sortOrder: 1 },
  criterion: {
    id: "criterion-1",
    criterionCode: "TC-01",
    title: "Tiêu chí thử nghiệm",
    sortOrder: 1,
  },
  canonicalIndex: 1,
  canonicalPage: 1,
}

const rows: readonly TechnicalConfigurationEvaluationHierarchyRow<TechnicalConfigurationEvaluationCriterionListItem>[] =
  [
    { kind: "section", id: "group-1", name: "Thông số chính" },
    { kind: "criterion", row: criterion },
  ]

describe("technical configuration evaluation navigator drawer", () => {
  it("keeps hierarchy hidden until requested and closes it after committed selection", async () => {
    const user = userEvent.setup()
    const onSelectCriterion = vi.fn(
      (
        _criterionId: string,
        navigation: Readonly<{
          returnFocusTarget: HTMLElement | null
          closeDrawer: () => void
        }>
      ) => navigation.closeDrawer()
    )

    render(
      <TechnicalConfigurationEvaluationNavigatorDrawer
        disabled={false}
        navigatorProps={{
          statusFilter: "all",
          onStatusFilterChange: vi.fn(),
          criteria: rows,
          progress: null,
          assessmentsByCriterionId: {},
          currentCriterionId: "criterion-1",
          page: 1,
          pageSize: 50,
          total: 1,
          onPageChange: vi.fn(),
          disabled: false,
          isLoading: false,
          isError: false,
          error: null,
          onRetry: vi.fn(),
          isCurrentCriterionFilteredOut: false,
          hasNoMoreMatches: false,
        }}
        onSelectCriterion={onSelectCriterion}
      />
    )

    expect(
      screen.queryByRole("navigation", { name: "Danh sách tiêu chí đánh giá" })
    ).not.toBeInTheDocument()

    const trigger = screen.getByRole("button", { name: "Mục lục tiêu chí" })
    await user.click(trigger)

    expect(
      screen.getByRole("navigation", { name: "Danh sách tiêu chí đánh giá" })
    ).toBeInTheDocument()
    await user.click(screen.getByTestId("evaluation-criterion"))

    expect(onSelectCriterion).toHaveBeenCalledWith(
      "criterion-1",
      expect.objectContaining({ returnFocusTarget: trigger })
    )
    await waitFor(() =>
      expect(
        screen.queryByRole("navigation", { name: "Danh sách tiêu chí đánh giá" })
      ).not.toBeInTheDocument()
    )
  })
})
