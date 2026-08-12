import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationMatrix } from "../_components/comparison/TechnicalConfigurationMatrix"
import type {
  TechnicalConfigurationBaselineCriterionWire,
  TechnicalConfigurationBaselineGroupWire,
} from "../baseline-types"
import type { TechnicalConfigurationComparisonResult } from "../comparison-types"

import { createComparisonResult } from "./comparison-matrix-test-fixtures"

const TIMESTAMP = "2026-08-12T00:00:00.000Z"

function createCriterion(
  id: string,
  groupId: string,
  subgroupId: string | null,
  criterionCode: string,
  title: string | null,
  requirementText: string,
  sortOrder: number
): TechnicalConfigurationBaselineCriterionWire {
  return {
    id,
    baseline_version_id: "baseline-1",
    group_id: groupId,
    subgroup_id: subgroupId,
    criterion_code: criterionCode,
    title,
    requirement_text: requirementText,
    sort_order: sortOrder,
    source_criterion_id: null,
    created_at: TIMESTAMP,
    created_by: 1,
    updated_at: TIMESTAMP,
    updated_by: 1,
  }
}

function createHierarchyGroups(): TechnicalConfigurationBaselineGroupWire[] {
  return [
    {
      id: "group-1",
      baseline_version_id: "baseline-1",
      name: "Thông số chính",
      sort_order: 1,
      created_at: TIMESTAMP,
      created_by: 1,
      updated_at: TIMESTAMP,
      updated_by: 1,
      criteria: [
        createCriterion(
          "criterion-1",
          "group-1",
          null,
          "TS-01",
          null,
          "Tần số tối thiểu 10 MHz",
          1
        ),
      ],
      subgroups: [
        {
          id: "subgroup-1",
          baseline_version_id: "baseline-1",
          group_id: "group-1",
          name: "1.1 Chất lượng hình ảnh",
          sort_order: 1,
          created_at: TIMESTAMP,
          created_by: 1,
          updated_at: TIMESTAMP,
          updated_by: 1,
          criteria: [
            createCriterion(
              "criterion-2",
              "group-1",
              "subgroup-1",
              "TS-02",
              "Độ phân giải",
              "Độ phân giải theo yêu cầu",
              1
            ),
          ],
        },
      ],
    },
    {
      id: "group-2",
      baseline_version_id: "baseline-1",
      name: "Phụ kiện",
      sort_order: 2,
      created_at: TIMESTAMP,
      created_by: 1,
      updated_at: TIMESTAMP,
      updated_by: 1,
      criteria: [
        createCriterion(
          "criterion-3",
          "group-2",
          null,
          "PK-01",
          "Xe đẩy",
          "Có xe đẩy chuyên dụng",
          1
        ),
      ],
      subgroups: [],
    },
  ]
}

function createManyOptionResult(): TechnicalConfigurationComparisonResult {
  const result = createComparisonResult()
  const options = Array.from({ length: 8 }, (_, index) => ({
    id: `option-${index + 1}`,
    supplierId: `supplier-${index + 1}`,
    supplierName: `Nhà cung cấp ${index + 1}`,
    model: `Model ${index + 1}`,
    manufacturer: null,
    optionName: null,
    displayLabel: `Nhà cung cấp ${index + 1} · Model ${index + 1}`,
  }))

  return {
    ...result,
    data: {
      ...result.data,
      options,
      criteria: result.data.criteria.map((row) => ({
        ...row,
        optionValues: [],
      })),
    },
  }
}

function hierarchyRowOrder(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll(
      [
        '[data-testid="comparison-section-row"]',
        '[data-testid="comparison-subgroup-row"]',
        '[data-testid="comparison-criterion-row"]',
      ].join(",")
    )
  ).map((row) => {
    if (row.getAttribute("data-testid") === "comparison-section-row") {
      return `section:${row.getAttribute("data-section-id")}`
    }
    if (row.getAttribute("data-testid") === "comparison-subgroup-row") {
      return `subgroup:${row.getAttribute("data-subgroup-id")}`
    }
    return `criterion:${row.getAttribute("data-criterion-id")}`
  })
}

describe("P5B comparison hierarchy", () => {
  it("renders direct criteria before subgroup blocks in canonical section order", () => {
    const { container } = render(
      <TechnicalConfigurationMatrix
        hasRequest
        result={createComparisonResult()}
        baselineGroups={createHierarchyGroups()}
        onOpenDetail={vi.fn()}
        onPageChange={vi.fn()}
        onRetry={vi.fn()}
      />
    )

    expect(hierarchyRowOrder(container)).toEqual([
      "section:group-1",
      "criterion:criterion-1",
      "subgroup:subgroup-1",
      "criterion:criterion-2",
      "section:group-2",
      "criterion:criterion-3",
    ])
    expect(screen.getAllByTestId("comparison-section-row")[0]).toHaveTextContent("Thông số chính")
    expect(screen.getAllByTestId("comparison-section-row")[0].querySelector("th")).toHaveAttribute(
      "scope",
      "rowgroup"
    )
    expect(screen.getByTestId("comparison-subgroup-row")).toHaveTextContent(
      "1.1 Chất lượng hình ảnh"
    )
    expect(
      within(screen.getByTestId("comparison-subgroup-row")).getByRole("heading", {
        level: 3,
      })
    ).toHaveTextContent("1.1 Chất lượng hình ảnh")
    expect(screen.getByTestId("comparison-subgroup-row").querySelector("th")).not.toHaveAttribute(
      "scope"
    )
  })

  it("keeps many-option, pinning and focus interactions criterion-only", () => {
    const result = createManyOptionResult()
    const baselineGroups = createHierarchyGroups()
    const visibleOptionIds = result.data.options.map((option) => option.id)
    const { rerender } = render(
      <TechnicalConfigurationMatrix
        hasRequest
        result={result}
        baselineGroups={baselineGroups}
        visibleOptionIds={visibleOptionIds}
        pinnedOptionIds={["option-4", "option-2"]}
        focusedOptionId={null}
        onOpenDetail={vi.fn()}
        onOpenEvaluation={vi.fn()}
        onPageChange={vi.fn()}
        onRetry={vi.fn()}
      />
    )

    expect(screen.getAllByTestId("comparison-option-cell")).toHaveLength(
      result.data.criteria.length * result.data.options.length
    )
    expect(screen.getAllByTestId("matrix-evaluation-action")).toHaveLength(
      result.data.criteria.length * result.data.options.length
    )
    for (const heading of [
      ...screen.getAllByTestId("comparison-section-row"),
      ...screen.getAllByTestId("comparison-subgroup-row"),
    ]) {
      expect(within(heading).queryByRole("button")).not.toBeInTheDocument()
      expect(heading.querySelector('[data-testid="comparison-option-cell"]')).toBeNull()
    }

    rerender(
      <TechnicalConfigurationMatrix
        hasRequest
        result={result}
        baselineGroups={baselineGroups}
        visibleOptionIds={visibleOptionIds}
        pinnedOptionIds={["option-4", "option-2"]}
        focusedOptionId="option-7"
        onOpenDetail={vi.fn()}
        onOpenEvaluation={vi.fn()}
        onPageChange={vi.fn()}
        onRetry={vi.fn()}
      />
    )

    expect(screen.getAllByTestId("comparison-option-header")).toHaveLength(1)
    expect(screen.getAllByTestId("comparison-option-cell")).toHaveLength(
      result.data.criteria.length
    )
    expect(screen.getAllByTestId("matrix-evaluation-action")).toHaveLength(
      result.data.criteria.length
    )
  })

  it("keeps pagination and evidence targets criterion-based on a partial page", async () => {
    const user = userEvent.setup()
    const result = createComparisonResult()
    const subgroupCriterion = result.data.criteria.find((row) => row.criterion.id === "criterion-2")
    expect(subgroupCriterion).toBeDefined()
    const partialPageResult: TechnicalConfigurationComparisonResult = {
      ...result,
      data: {
        ...result.data,
        criteria: subgroupCriterion ? [subgroupCriterion] : [],
      },
    }
    const onOpenDetail = vi.fn()
    const onPageChange = vi.fn()
    render(
      <TechnicalConfigurationMatrix
        hasRequest
        result={partialPageResult}
        baselineGroups={createHierarchyGroups()}
        onOpenDetail={onOpenDetail}
        onPageChange={onPageChange}
        onRetry={vi.fn()}
      />
    )

    expect(screen.getAllByTestId("comparison-section-row")).toHaveLength(1)
    expect(screen.getAllByTestId("comparison-subgroup-row")).toHaveLength(1)
    expect(screen.queryByText("Phụ kiện")).not.toBeInTheDocument()
    expect(screen.getByText("Tiêu chí 51-100 trên 120")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Trang tiếp theo" }))
    expect(onPageChange).toHaveBeenCalledWith(3)

    await user.click(screen.getByRole("button", { name: "Xem chi tiết TS-02 · Yêu cầu cơ sở" }))
    expect(onOpenDetail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        evidence: { documentCount: 2, citationCount: 1, hasEvidence: true },
        evidenceTarget: {
          kind: "baseline",
          baselineVersionId: "baseline-1",
          criterionId: "criterion-2",
        },
      })
    )

    await user.click(
      screen.getByRole("button", {
        name: "Xem chi tiết TS-02 · Nhà cung cấp B · Phương án B",
      })
    )
    expect(onOpenDetail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        evidence: { documentCount: 1, citationCount: 1, hasEvidence: true },
        evidenceTarget: {
          kind: "option",
          baselineVersionId: "baseline-1",
          optionId: "option-b",
          criterionId: "criterion-2",
        },
      })
    )
  })

  it("keeps one section heading when a stale hierarchy omits a page criterion", () => {
    const baselineGroups = createHierarchyGroups()
    baselineGroups[0].criteria = []
    const { container } = render(
      <TechnicalConfigurationMatrix
        hasRequest
        result={createComparisonResult()}
        baselineGroups={baselineGroups}
        onOpenDetail={vi.fn()}
        onPageChange={vi.fn()}
        onRetry={vi.fn()}
      />
    )

    expect(screen.getAllByTestId("comparison-section-row")).toHaveLength(2)
    expect(hierarchyRowOrder(container)).toEqual([
      "section:group-1",
      "criterion:criterion-1",
      "subgroup:subgroup-1",
      "criterion:criterion-2",
      "section:group-2",
      "criterion:criterion-3",
    ])
  })

  it("falls back to the comparison group when hierarchy ownership is stale", () => {
    const baselineGroups = createHierarchyGroups()
    const misplacedCriterion = baselineGroups[1].criteria[0]
    baselineGroups[0].criteria.push(misplacedCriterion)
    baselineGroups[1].criteria = []
    const { container } = render(
      <TechnicalConfigurationMatrix
        hasRequest
        result={createComparisonResult()}
        baselineGroups={baselineGroups}
        onOpenDetail={vi.fn()}
        onPageChange={vi.fn()}
        onRetry={vi.fn()}
      />
    )

    expect(hierarchyRowOrder(container)).toEqual([
      "section:group-1",
      "criterion:criterion-1",
      "subgroup:subgroup-1",
      "criterion:criterion-2",
      "section:group-2",
      "criterion:criterion-3",
    ])
  })
})
