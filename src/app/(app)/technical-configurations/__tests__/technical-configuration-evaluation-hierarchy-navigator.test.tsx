import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { TechnicalConfigurationEvaluationCriterionWire } from "../assessment-types"
import type { TechnicalConfigurationBaselineGroupWire } from "../baseline-types"
import { useTechnicalConfigurationEvaluationNavigator } from "../_hooks/useTechnicalConfigurationEvaluationNavigator"
import {
  createBaselineGroups,
  createOption,
} from "./technical-configuration-evaluation-workspace.test-support"

const criteriaMocks = vi.hoisted(() => ({
  data: [] as TechnicalConfigurationEvaluationCriterionWire[],
  loadCriteria: vi.fn(),
  refetch: vi.fn(),
}))

vi.mock("../_hooks/useTechnicalConfigurationEvaluationCriteria", () => ({
  useTechnicalConfigurationEvaluationCriteria: () => ({
    criteriaQuery: {
      data: criteriaMocks.data,
      isLoading: false,
      isError: false,
      error: null,
      refetch: criteriaMocks.refetch,
    },
    loadCriteria: criteriaMocks.loadCriteria,
  }),
}))

function createHierarchyGroups(): TechnicalConfigurationBaselineGroupWire[] {
  const groups = createBaselineGroups()
  const subgroupCriterion = {
    ...groups[0].criteria[1],
    subgroup_id: "subgroup-1",
  }
  groups[0].criteria = [groups[0].criteria[0]]
  groups[0].subgroups = [
    {
      id: "subgroup-1",
      baseline_version_id: groups[0].baseline_version_id,
      group_id: groups[0].id,
      name: "Nhóm con",
      sort_order: 1,
      created_at: groups[0].created_at,
      created_by: groups[0].created_by,
      updated_at: groups[0].updated_at,
      updated_by: groups[0].updated_by,
      criteria: [subgroupCriterion],
    },
  ]
  return groups
}

function createSharedAncestorPageBoundaryFixture() {
  const groups = createHierarchyGroups()
  const group = groups[0]
  const subgroup = group.subgroups?.[0]
  if (!subgroup) throw new Error("Expected subgroup fixture")

  const criterionTemplate = subgroup.criteria[0]
  subgroup.criteria = Array.from({ length: 51 }, (_, index) => ({
    ...criterionTemplate,
    id: `criterion-${index + 1}`,
    criterion_code: `TC-${index + 1}`,
    sort_order: index + 1,
  }))
  group.criteria = []

  return {
    groups: [group],
    entries: subgroup.criteria.map((criterion, index) => ({
      criterion_id: criterion.id,
      canonical_index: index + 1,
      canonical_page: Math.floor(index / 50) + 1,
    })),
  }
}

const entries: TechnicalConfigurationEvaluationCriterionWire[] = [
  { criterion_id: "criterion-1", canonical_index: 1, canonical_page: 1 },
  { criterion_id: "criterion-2", canonical_index: 2, canonical_page: 1 },
  { criterion_id: "criterion-3", canonical_index: 3, canonical_page: 2 },
]

function renderNavigator(groups = createHierarchyGroups(), pageSize = 2) {
  return renderHook(() =>
    useTechnicalConfigurationEvaluationNavigator({
      options: [
        createOption("option-1", "Nhà cung cấp A"),
        createOption("option-2", "Nhà cung cấp B"),
      ],
      baselineGroups: groups,
      baselineVersionId: "baseline-1",
      pageSize,
    })
  )
}

function rowKeys(
  rows: ReturnType<typeof useTechnicalConfigurationEvaluationNavigator>["hierarchyRows"]
) {
  return rows.map((row) =>
    row.kind === "criterion" ? `criterion:${row.row.criterion.id}` : `${row.kind}:${row.id}`
  )
}

describe("P5C evaluation hierarchy navigator presentation", () => {
  beforeEach(() => {
    criteriaMocks.data = entries
    criteriaMocks.loadCriteria.mockReset()
    criteriaMocks.loadCriteria.mockResolvedValue(entries)
    criteriaMocks.refetch.mockReset()
  })

  it("exposes only current canonical-page rows and defaults their ancestors expanded", () => {
    const { result } = renderNavigator()

    expect(rowKeys(result.current.hierarchyRows)).toEqual([
      "section:group-1",
      "criterion:criterion-1",
      "subgroup:subgroup-1",
      "criterion:criterion-2",
    ])
    expect([...result.current.expandedRowIds]).toEqual(["group-1", "subgroup-1"])

    act(() => {
      result.current.onExpandedRowIdsChange(new Set(["group-1"]))
    })

    expect([...result.current.expandedRowIds]).toEqual(["group-1"])
    expect(result.current.projection.map((item) => item.criterion.id)).toEqual([
      "criterion-1",
      "criterion-2",
      "criterion-3",
    ])

    act(() => {
      result.current.changePage(2, (commit) => commit())
    })

    expect(rowKeys(result.current.hierarchyRows)).toEqual([
      "section:group-2",
      "criterion:criterion-3",
    ])
    expect([...result.current.expandedRowIds]).toEqual(["group-2"])
  })

  it("resets collapsed ancestors across canonical pages 50/51 with the same hierarchy", () => {
    const fixture = createSharedAncestorPageBoundaryFixture()
    criteriaMocks.data = fixture.entries
    criteriaMocks.loadCriteria.mockResolvedValue(fixture.entries)
    const { result } = renderNavigator(fixture.groups, 50)

    expect(result.current.hierarchyRows.at(-1)).toMatchObject({
      kind: "criterion",
      row: { criterion: { id: "criterion-50" } },
    })

    act(() => {
      result.current.onExpandedRowIdsChange(new Set())
    })
    expect([...result.current.expandedRowIds]).toEqual([])

    act(() => {
      result.current.changePage(2, (commit) => commit())
    })

    expect(rowKeys(result.current.hierarchyRows)).toEqual([
      "section:group-1",
      "subgroup:subgroup-1",
      "criterion:criterion-51",
    ])
    expect([...result.current.expandedRowIds]).toEqual(["group-1", "subgroup-1"])
  })

  it("keeps expansion and selection unchanged when guarded criterion navigation is cancelled", () => {
    const beforeOpen = vi.fn()
    let commitNavigation: (() => void) | null = null
    const { result } = renderNavigator()

    act(() => {
      result.current.onExpandedRowIdsChange(new Set())
      result.current.changeCriterion(
        "criterion-2",
        (commit) => {
          commitNavigation = commit
        },
        beforeOpen
      )
    })

    expect([...result.current.expandedRowIds]).toEqual([])
    expect(result.current.criterionId).toBe("criterion-1")
    expect(beforeOpen).not.toHaveBeenCalled()

    act(() => {
      commitNavigation?.()
    })

    expect([...result.current.expandedRowIds]).toEqual(["group-1", "subgroup-1"])
    expect(result.current.criterionId).toBe("criterion-2")
    expect(beforeOpen).toHaveBeenCalledTimes(1)
  })

  it("auto-expands a guarded target after approval without changing projection", async () => {
    let commitNavigation: (() => void) | null = null
    const { result } = renderNavigator()

    act(() => {
      result.current.onExpandedRowIdsChange(new Set())
      result.current.changeTarget("option-2", "criterion-2", (commit) => {
        commitNavigation = commit
      })
    })

    expect([...result.current.expandedRowIds]).toEqual([])
    expect(result.current.activeSelectedOptionId).toBe("option-1")

    act(() => {
      commitNavigation?.()
    })

    await waitFor(() => expect(result.current.activeSelectedOptionId).toBe("option-2"))
    expect([...result.current.expandedRowIds]).toEqual(["group-1", "subgroup-1"])
    expect(result.current.criterionId).toBe("criterion-2")
    expect(result.current.projection).toHaveLength(3)
  })

  it("auto-expands the next matching leaf after save without altering next resolution", async () => {
    const { result } = renderNavigator()

    act(() => {
      result.current.onExpandedRowIdsChange(new Set())
    })

    let nextCriterionId: string | undefined
    await act(async () => {
      nextCriterionId = (await result.current.advanceAfterSave())?.criterion.id
    })

    expect(nextCriterionId).toBe("criterion-2")
    expect(result.current.criterionId).toBe("criterion-2")
    expect([...result.current.expandedRowIds]).toEqual(["group-1", "subgroup-1"])
    expect(result.current.hasNoMoreMatches).toBe(false)
  })

  it("keeps legacy direct-only rows unchanged", () => {
    const { result } = renderNavigator(createBaselineGroups())

    expect(rowKeys(result.current.hierarchyRows)).toEqual([
      "section:group-1",
      "criterion:criterion-1",
      "criterion:criterion-2",
    ])
    expect([...result.current.expandedRowIds]).toEqual(["group-1"])
  })
})
