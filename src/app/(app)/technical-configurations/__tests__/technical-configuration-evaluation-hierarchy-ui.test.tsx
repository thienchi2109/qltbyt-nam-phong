import "@testing-library/jest-dom"
import { StrictMode } from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationCriterionList } from "../_components/evaluation/TechnicalConfigurationCriterionList"
import type { TechnicalConfigurationEvaluationHierarchyRow } from "../_components/evaluation/technical-configuration-evaluation-hierarchy"
import type { TechnicalConfigurationEvaluationCriterionListItem } from "../_components/evaluation/technical-configuration-evaluation-navigation"
import type { TechnicalConfigurationEvaluationProgress } from "../_components/evaluation/technical-configuration-evaluation-progress"

function createCriterion(
  id: string,
  canonicalIndex: number,
  group: { id: string; name: string; sortOrder: number },
  subgroup?: { id: string; name: string; sortOrder: number }
): TechnicalConfigurationEvaluationCriterionListItem {
  return {
    group,
    ...(subgroup ? { subgroup } : {}),
    criterion: {
      id,
      criterionCode: `TC-${String(canonicalIndex).padStart(2, "0")}`,
      title: `Tiêu chí ${canonicalIndex}`,
      sortOrder: canonicalIndex,
    },
    canonicalIndex,
    canonicalPage: 1,
  }
}

const mainGroup = { id: "group-main", name: "Thông số chính", sortOrder: 1 }
const safetyGroup = { id: "group-safety", name: "An toàn", sortOrder: 2 }
const performanceSubgroup = {
  id: "subgroup-performance",
  name: "Hiệu năng",
  sortOrder: 1,
}
const pageCriteria = [
  createCriterion("criterion-direct", 1, mainGroup),
  createCriterion("criterion-subgroup", 2, mainGroup, performanceSubgroup),
  createCriterion("criterion-safety", 3, safetyGroup),
] as const
const pageRows: readonly TechnicalConfigurationEvaluationHierarchyRow<TechnicalConfigurationEvaluationCriterionListItem>[] =
  [
    { kind: "section", id: mainGroup.id, name: mainGroup.name },
    { kind: "criterion", row: pageCriteria[0] },
    {
      kind: "subgroup",
      id: performanceSubgroup.id,
      sectionId: mainGroup.id,
      name: performanceSubgroup.name,
    },
    { kind: "criterion", row: pageCriteria[1] },
    { kind: "section", id: safetyGroup.id, name: safetyGroup.name },
    { kind: "criterion", row: pageCriteria[2] },
  ]
const emptyStatusCounts = {
  not_evaluated: 0,
  not_applicable: 0,
  fails: 0,
  unclear: 0,
  insufficient_evidence: 0,
  exceeds: 0,
  meets: 0,
} as const
const hierarchyProgress: TechnicalConfigurationEvaluationProgress["hierarchy"] = [
  {
    id: mainGroup.id,
    name: mainGroup.name,
    sortOrder: mainGroup.sortOrder,
    total: 5,
    evaluated: 4,
    status: "failed",
    statusCounts: {
      ...emptyStatusCounts,
      not_evaluated: 1,
      fails: 1,
      unclear: 1,
      insufficient_evidence: 1,
      meets: 1,
    },
    subgroups: [
      {
        id: performanceSubgroup.id,
        name: performanceSubgroup.name,
        sortOrder: performanceSubgroup.sortOrder,
        total: 1,
        evaluated: 1,
        status: "passed",
        statusCounts: {
          ...emptyStatusCounts,
          meets: 1,
        },
      },
    ],
  },
  {
    id: safetyGroup.id,
    name: safetyGroup.name,
    sortOrder: safetyGroup.sortOrder,
    total: 1,
    evaluated: 0,
    status: "in_progress",
    statusCounts: {
      ...emptyStatusCounts,
      not_evaluated: 1,
    },
    subgroups: [],
  },
]

function getCriterion(criterionId: string): HTMLElement | undefined {
  return screen
    .queryAllByTestId("evaluation-criterion")
    .find((criterion) => criterion.getAttribute("data-criterion-id") === criterionId)
}

describe("P5C evaluation hierarchy presentation", () => {
  it("opens only the current criterion ancestors and supports manual expansion", async () => {
    const user = userEvent.setup()

    render(
      <TechnicalConfigurationCriterionList
        rows={pageRows}
        hierarchyProgress={hierarchyProgress}
        assessmentsByCriterionId={{}}
        currentCriterionId="criterion-subgroup"
        onSelectCriterion={vi.fn()}
      />
    )

    expect(screen.getByTestId("evaluation-hierarchy-section-group-main")).toBeInTheDocument()
    expect(
      screen.getByTestId("evaluation-hierarchy-subgroup-subgroup-performance")
    ).toBeInTheDocument()
    expect(getCriterion("criterion-subgroup")).toHaveAttribute("aria-current", "true")
    expect(screen.getByTestId("evaluation-hierarchy-section-group-safety")).toHaveAttribute(
      "aria-expanded",
      "false"
    )
    expect(getCriterion("criterion-safety")).toBeUndefined()

    await user.click(screen.getByTestId("evaluation-hierarchy-section-group-safety"))
    expect(getCriterion("criterion-safety")).toBeInTheDocument()

    await user.click(screen.getByTestId("evaluation-hierarchy-section-group-main"))

    expect(getCriterion("criterion-direct")).toBeUndefined()
    expect(getCriterion("criterion-subgroup")).toBeUndefined()
    expect(getCriterion("criterion-safety")).toBeInTheDocument()
  })

  it("renders only page-local ancestors and keeps structural rows assessment-free", async () => {
    const user = userEvent.setup()
    const onSelectCriterion = vi.fn()

    render(
      <TechnicalConfigurationCriterionList
        rows={pageRows}
        hierarchyProgress={hierarchyProgress}
        assessmentsByCriterionId={{}}
        currentCriterionId="criterion-subgroup"
        onSelectCriterion={onSelectCriterion}
      />
    )

    const sectionRow = screen.getByTestId("evaluation-hierarchy-section-group-main")
    const subgroupRow = screen.getByTestId("evaluation-hierarchy-subgroup-subgroup-performance")
    expect(within(sectionRow).getByText("Thông số chính")).toBeInTheDocument()
    expect(within(subgroupRow).getByText("Hiệu năng")).toBeInTheDocument()
    expect(screen.getByText("An toàn")).toBeInTheDocument()
    expect(screen.queryByText("Nhóm trống ngoài trang")).not.toBeInTheDocument()
    expect(within(sectionRow).queryByRole("radio")).not.toBeInTheDocument()
    expect(within(subgroupRow).queryByRole("radio")).not.toBeInTheDocument()
    expect(sectionRow).not.toHaveAttribute("data-criterion-id")
    expect(subgroupRow).not.toHaveAttribute("data-criterion-id")

    await user.click(sectionRow)
    await user.click(subgroupRow)
    expect(onSelectCriterion).not.toHaveBeenCalled()
  })

  it("renders ratios, conditional progress and only nonzero exception counts", () => {
    render(
      <TechnicalConfigurationCriterionList
        rows={pageRows}
        hierarchyProgress={hierarchyProgress}
        assessmentsByCriterionId={{}}
        currentCriterionId="criterion-subgroup"
        onSelectCriterion={vi.fn()}
      />
    )

    const sectionRow = screen.getByTestId("evaluation-hierarchy-section-group-main")
    expect(sectionRow.querySelector("div")).toBeNull()
    expect(within(sectionRow).getByText("4 / 5")).toBeInTheDocument()
    expect(within(sectionRow).getByText("Không đạt 1")).toBeInTheDocument()
    expect(within(sectionRow).getByText("Cần làm rõ 2")).toBeInTheDocument()
    expect(within(sectionRow).queryByText(/Chưa đánh giá/)).not.toBeInTheDocument()
    expect(within(sectionRow).queryByText(/Đạt 1/)).not.toBeInTheDocument()
    expect(
      within(sectionRow).getByRole("progressbar", { name: "Tiến độ Thông số chính" })
    ).toHaveAttribute("aria-valuenow", "80")

    const subgroupRow = screen.getByTestId("evaluation-hierarchy-subgroup-subgroup-performance")
    expect(subgroupRow.querySelector("div")).toBeNull()
    expect(within(subgroupRow).getByText("1 / 1")).toBeInTheDocument()
    expect(within(subgroupRow).getByText("Đạt", { exact: true })).toBeInTheDocument()
    expect(within(subgroupRow).queryByRole("progressbar")).not.toBeInTheDocument()
    expect(within(subgroupRow).queryByText(/Không đạt/)).not.toBeInTheDocument()
  })

  it("collapses only presentation descendants", async () => {
    const user = userEvent.setup()

    render(
      <TechnicalConfigurationCriterionList
        rows={pageRows}
        hierarchyProgress={hierarchyProgress}
        assessmentsByCriterionId={{}}
        currentCriterionId="criterion-subgroup"
        onSelectCriterion={vi.fn()}
      />
    )

    const mainSection = screen.getByTestId("evaluation-hierarchy-section-group-main")
    const subgroup = screen.getByTestId("evaluation-hierarchy-subgroup-subgroup-performance")
    expect(mainSection).toHaveAttribute("aria-expanded", "true")
    expect(subgroup).toHaveAttribute("aria-expanded", "true")
    expect(getCriterion("criterion-direct")).toBeInTheDocument()
    expect(getCriterion("criterion-subgroup")).toBeInTheDocument()
    expect(getCriterion("criterion-safety")).toBeUndefined()

    await user.click(subgroup)
    expect(subgroup).toHaveAttribute("aria-expanded", "false")
    expect(getCriterion("criterion-direct")).toBeInTheDocument()
    expect(getCriterion("criterion-subgroup")).toBeUndefined()
    expect(getCriterion("criterion-safety")).toBeUndefined()

    await user.click(mainSection)
    expect(mainSection).toHaveAttribute("aria-expanded", "false")
    expect(getCriterion("criterion-direct")).toBeUndefined()
    expect(
      screen.queryByTestId("evaluation-hierarchy-subgroup-subgroup-performance")
    ).not.toBeInTheDocument()
    expect(getCriterion("criterion-safety")).toBeUndefined()
  })

  it("emits one uncontrolled expansion change per structural toggle in StrictMode", async () => {
    const user = userEvent.setup()
    const onExpandedRowIdsChange = vi.fn()

    render(
      <StrictMode>
        <TechnicalConfigurationCriterionList
          rows={pageRows}
          hierarchyProgress={hierarchyProgress}
          assessmentsByCriterionId={{}}
          currentCriterionId={null}
          onSelectCriterion={vi.fn()}
          onExpandedRowIdsChange={onExpandedRowIdsChange}
        />
      </StrictMode>
    )

    await user.click(screen.getByTestId("evaluation-hierarchy-section-group-main"))

    expect(onExpandedRowIdsChange).toHaveBeenCalledTimes(1)
    expect(onExpandedRowIdsChange).toHaveBeenCalledWith(new Set([mainGroup.id]))
  })

  it("supports controlled ancestor expansion for a selected hidden leaf", async () => {
    const user = userEvent.setup()
    const onExpandedRowIdsChange = vi.fn()
    const { rerender } = render(
      <TechnicalConfigurationCriterionList
        rows={pageRows}
        hierarchyProgress={hierarchyProgress}
        assessmentsByCriterionId={{}}
        currentCriterionId="criterion-subgroup"
        onSelectCriterion={vi.fn()}
        expandedRowIds={new Set([mainGroup.id, safetyGroup.id])}
        onExpandedRowIdsChange={onExpandedRowIdsChange}
      />
    )

    expect(getCriterion("criterion-subgroup")).toBeUndefined()

    rerender(
      <TechnicalConfigurationCriterionList
        rows={pageRows}
        hierarchyProgress={hierarchyProgress}
        assessmentsByCriterionId={{}}
        currentCriterionId="criterion-subgroup"
        onSelectCriterion={vi.fn()}
        expandedRowIds={new Set([mainGroup.id, performanceSubgroup.id, safetyGroup.id])}
        onExpandedRowIdsChange={onExpandedRowIdsChange}
      />
    )

    expect(getCriterion("criterion-subgroup")).toHaveAttribute("aria-current", "true")
    await user.click(screen.getByTestId("evaluation-hierarchy-subgroup-subgroup-performance"))
    expect(onExpandedRowIdsChange).toHaveBeenCalledWith(new Set([mainGroup.id, safetyGroup.id]))
  })

  it("preserves legacy direct-criterion rendering without subgroup rows", () => {
    const legacyRows: readonly TechnicalConfigurationEvaluationHierarchyRow<TechnicalConfigurationEvaluationCriterionListItem>[] =
      [
        { kind: "section", id: mainGroup.id, name: mainGroup.name },
        {
          kind: "criterion",
          row: createCriterion("criterion-legacy-1", 1, mainGroup),
        },
        { kind: "section", id: safetyGroup.id, name: safetyGroup.name },
        {
          kind: "criterion",
          row: createCriterion("criterion-legacy-2", 2, safetyGroup),
        },
      ]

    render(
      <TechnicalConfigurationCriterionList
        rows={legacyRows}
        hierarchyProgress={hierarchyProgress}
        assessmentsByCriterionId={{}}
        currentCriterionId="criterion-legacy-1"
        onSelectCriterion={vi.fn()}
      />
    )

    expect(screen.getAllByTestId("evaluation-criterion")).toHaveLength(1)
    expect(getCriterion("criterion-legacy-1")).toBeInTheDocument()
    expect(getCriterion("criterion-legacy-2")).toBeUndefined()
    expect(
      screen.getAllByTestId(/^evaluation-hierarchy-section-(group-main|group-safety)$/)
    ).toHaveLength(2)
    expect(screen.queryByTestId(/evaluation-hierarchy-subgroup-/)).not.toBeInTheDocument()
  })

  it("uses a stable three-column desktop grid and a two-level mobile row", async () => {
    const user = userEvent.setup()
    const onSelectCriterion = vi.fn()

    render(
      <TechnicalConfigurationCriterionList
        rows={pageRows}
        hierarchyProgress={hierarchyProgress}
        assessmentsByCriterionId={{}}
        currentCriterionId="criterion-subgroup"
        onSelectCriterion={onSelectCriterion}
      />
    )

    const criterion = getCriterion("criterion-subgroup")
    expect(criterion).toHaveClass("sm:grid-cols-[7rem_minmax(0,1fr)_11rem]")
    expect(within(criterion!).getByText("TC-02")).toBeInTheDocument()
    expect(within(criterion!).getByText("Tiêu chí 2")).toHaveClass("row-start-2", "sm:row-auto")
    expect(
      within(criterion!).getByTestId("evaluation-criterion-open-indicator")
    ).toBeInTheDocument()

    await user.click(criterion!)
    expect(onSelectCriterion).toHaveBeenCalledWith("criterion-subgroup")
  })
})
