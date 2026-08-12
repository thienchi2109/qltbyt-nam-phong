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
    total: 2,
    evaluated: 2,
    status: "failed",
    statusCounts: {
      ...emptyStatusCounts,
      fails: 1,
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
  it("renders and collapses a prebuilt page-local hierarchy row union", async () => {
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

  it("renders authoritative aggregate labels and exact canonical counts on structural rows", () => {
    render(
      <TechnicalConfigurationCriterionList
        rows={pageRows}
        hierarchyProgress={hierarchyProgress}
        assessmentsByCriterionId={{}}
        currentCriterionId={null}
        onSelectCriterion={vi.fn()}
      />
    )

    const sectionRow = screen.getByTestId("evaluation-hierarchy-section-group-main")
    const sectionCounts = within(sectionRow).getByTestId(
      "evaluation-hierarchy-section-status-counts-group-main"
    )
    expect(within(sectionRow).getByText("Không đạt", { exact: true })).toBeInTheDocument()
    expect(within(sectionCounts).getByText("Không đạt: 1")).toBeInTheDocument()
    expect(within(sectionCounts).getByText("Đạt: 1")).toBeInTheDocument()
    expect(within(sectionCounts).getByText("Chưa đánh giá: 0")).toBeInTheDocument()

    const subgroupRow = screen.getByTestId("evaluation-hierarchy-subgroup-subgroup-performance")
    const subgroupCounts = within(subgroupRow).getByTestId(
      "evaluation-hierarchy-subgroup-status-counts-subgroup-performance"
    )
    expect(within(subgroupRow).getByText("Đạt", { exact: true })).toBeInTheDocument()
    expect(within(subgroupCounts).getByText("Đạt: 1")).toBeInTheDocument()
    expect(within(subgroupCounts).getByText("Không đạt: 0")).toBeInTheDocument()
  })

  it("starts expanded and collapses only presentation descendants", async () => {
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
    expect(getCriterion("criterion-safety")).toBeInTheDocument()

    await user.click(subgroup)
    expect(subgroup).toHaveAttribute("aria-expanded", "false")
    expect(getCriterion("criterion-direct")).toBeInTheDocument()
    expect(getCriterion("criterion-subgroup")).toBeUndefined()
    expect(getCriterion("criterion-safety")).toBeInTheDocument()

    await user.click(mainSection)
    expect(mainSection).toHaveAttribute("aria-expanded", "false")
    expect(getCriterion("criterion-direct")).toBeUndefined()
    expect(
      screen.queryByTestId("evaluation-hierarchy-subgroup-subgroup-performance")
    ).not.toBeInTheDocument()
    expect(getCriterion("criterion-safety")).toBeInTheDocument()
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
    expect(onExpandedRowIdsChange).toHaveBeenCalledWith(
      new Set([performanceSubgroup.id, safetyGroup.id])
    )
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
        currentCriterionId={null}
        onSelectCriterion={vi.fn()}
      />
    )

    expect(screen.getAllByTestId("evaluation-criterion")).toHaveLength(2)
    expect(
      screen.getAllByTestId(/^evaluation-hierarchy-section-(group-main|group-safety)$/)
    ).toHaveLength(2)
    expect(screen.queryByTestId(/evaluation-hierarchy-subgroup-/)).not.toBeInTheDocument()
  })
})
