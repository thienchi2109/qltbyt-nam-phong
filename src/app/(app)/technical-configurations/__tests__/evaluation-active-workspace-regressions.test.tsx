import "@testing-library/jest-dom"
import type { ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationEvaluationActiveWorkspace } from "../_components/evaluation/TechnicalConfigurationEvaluationActiveWorkspace"
import type { TechnicalConfigurationComparisonResult } from "../comparison-types"
import {
  createComparisonResult,
  createOption,
  dossier,
} from "./technical-configuration-evaluation-workspace.test-support"

type MatrixState = ReturnType<
  typeof import("../_hooks/useTechnicalConfigurationComparisonMatrix").useTechnicalConfigurationComparisonMatrix
>

type ComparisonRequest = { optionIds: string[]; page: number }
type NavigatorPaneProps = {
  criteria: readonly unknown[]
  progress: unknown
  isLoading: boolean
  isError: boolean
  expandedRowIds?: ReadonlySet<string>
  onExpandedRowIdsChange?: (rowIds: ReadonlySet<string>) => void
}

const mocks = vi.hoisted(() => {
  let comparisonRequests: ComparisonRequest[] = []
  let page = 1
  let panelResult: TechnicalConfigurationComparisonResult | undefined
  let isTransitionPending = false
  let isSaving = false
  let isAssessmentLoading = false
  let assessmentError: Error | null = null
  let navigatorPaneProps: NavigatorPaneProps | null = null
  const hierarchyRows = [{ kind: "section", id: "group-1", name: "Thông số chính" }]
  const expandedRowIds = new Set(["group-1"])
  const onExpandedRowIdsChange = vi.fn()

  return {
    recordComparisonRequest(request: ComparisonRequest) {
      comparisonRequests = [...comparisonRequests, request]
    },
    getComparisonRequests() {
      return comparisonRequests
    },
    getPage() {
      return page
    },
    getPanelResult() {
      return panelResult
    },
    getIsTransitionPending() {
      return isTransitionPending
    },
    getIsSaving() {
      return isSaving
    },
    getIsAssessmentLoading() {
      return isAssessmentLoading
    },
    getAssessmentError() {
      return assessmentError
    },
    getHierarchyRows() {
      return hierarchyRows
    },
    getExpandedRowIds() {
      return expandedRowIds
    },
    getOnExpandedRowIdsChange() {
      return onExpandedRowIdsChange
    },
    recordNavigatorPaneProps(props: NavigatorPaneProps) {
      navigatorPaneProps = props
    },
    getNavigatorPaneProps() {
      return navigatorPaneProps
    },
    setScenario(scenario: {
      page?: number
      panelResult?: TechnicalConfigurationComparisonResult
      isTransitionPending?: boolean
      isSaving?: boolean
      isAssessmentLoading?: boolean
      assessmentError?: Error | null
    }) {
      page = scenario.page ?? page
      if ("panelResult" in scenario) panelResult = scenario.panelResult
      isTransitionPending = scenario.isTransitionPending ?? isTransitionPending
      isSaving = scenario.isSaving ?? isSaving
      isAssessmentLoading = scenario.isAssessmentLoading ?? isAssessmentLoading
      if ("assessmentError" in scenario) assessmentError = scenario.assessmentError ?? null
    },
    reset() {
      comparisonRequests = []
      page = 1
      panelResult = undefined
      isTransitionPending = false
      isSaving = false
      isAssessmentLoading = false
      assessmentError = null
      navigatorPaneProps = null
      onExpandedRowIdsChange.mockReset()
    },
  }
})

vi.mock("../_hooks/useTechnicalConfigurationComparison", () => ({
  useTechnicalConfigurationComparison: ({
    optionIds,
    page,
  }: {
    optionIds: readonly string[]
    page: number
  }) => {
    mocks.recordComparisonRequest({ optionIds: [...optionIds], page })
    return {
      comparisonQuery: {
        data: optionIds[0] ? mocks.getPanelResult() : undefined,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      },
    }
  },
}))

vi.mock("../_hooks/useTechnicalConfigurationEvaluationNavigator", () => ({
  useTechnicalConfigurationEvaluationNavigator: () => ({
    activeSelectedOptionId: "option-1",
    currentCriterion: { canonicalPage: mocks.getPage() },
    criterionId: mocks.getPage() === 1 ? "criterion-1" : "criterion-3",
    selectedOption: createOption("option-1", "Nhà cung cấp A · Model A"),
    projection: [],
    hierarchyRows: mocks.getHierarchyRows(),
    expandedRowIds: mocks.getExpandedRowIds(),
    onExpandedRowIdsChange: mocks.getOnExpandedRowIdsChange(),
    statusFilter: "all",
    isTransitionPending: mocks.getIsTransitionPending(),
    criteriaQuery: {
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    },
    isCurrentCriterionFilteredOut: false,
    hasNoMoreMatches: false,
    isPanelOpen: true,
    changeCriterion: vi.fn(),
  }),
}))

vi.mock("../_hooks/useTechnicalConfigurationEvaluationDraft", () => ({
  useTechnicalConfigurationEvaluationDraft: () => ({
    assessmentQuery: {
      isLoading: mocks.getIsAssessmentLoading(),
      isError: mocks.getAssessmentError() !== null,
      error: mocks.getAssessmentError(),
    },
    comparisonSetQuery: { isLoading: false, isError: false, error: null },
    assessmentsByCriterionId: {},
    draft: null,
    isSaving: mocks.getIsSaving(),
    isReady: false,
    error: null,
    discard: vi.fn(),
    setTechnicalAxis: vi.fn(),
    setEvidenceAxis: vi.fn(),
    setNotes: vi.fn(),
  }),
}))

vi.mock("../_hooks/useTechnicalConfigurationGuardedNavigation", () => ({
  useTechnicalConfigurationGuardedNavigation: () => ({
    requestNavigation: vi.fn(),
    discardConfirmationDialog: null,
  }),
}))

vi.mock("../_hooks/useTechnicalConfigurationEvaluationWorkspaceActions", () => ({
  useTechnicalConfigurationEvaluationWorkspaceActions: () => ({
    handleOptionChange: vi.fn(),
    handleFilterChange: vi.fn(),
    handleOpenEvaluation: vi.fn(),
    handleMatrixPageChange: vi.fn(),
    handleSave: vi.fn(),
    handleSaveAndContinue: vi.fn(),
    handleRetryEvaluationData: vi.fn(),
    closeEvaluationPanel: vi.fn(),
    runMatrixContextChange: vi.fn(),
  }),
}))

vi.mock("../_components/comparison/TechnicalConfigurationCriterionPanel", () => ({
  TechnicalConfigurationCriterionPanel: () => null,
}))
vi.mock("../_components/comparison/TechnicalConfigurationMatrix", () => ({
  TechnicalConfigurationMatrix: () => null,
}))
vi.mock("../_components/evaluation/TechnicalConfigurationEvaluationFeedback", () => ({
  TechnicalConfigurationEvaluationFeedback: () => null,
}))
vi.mock("../_components/evaluation/TechnicalConfigurationEvaluationMatrixControls", () => ({
  TechnicalConfigurationEvaluationMatrixControls: ({
    navigatorControl,
  }: {
    navigatorControl: ReactNode
  }) => navigatorControl,
}))
vi.mock("../_components/evaluation/TechnicalConfigurationEvaluationMatrixToolbar", () => ({
  TechnicalConfigurationEvaluationMatrixToolbar: () => null,
}))
vi.mock("../_components/evaluation/TechnicalConfigurationProgressSummary", () => ({
  TechnicalConfigurationProgressSummary: () => null,
}))
vi.mock("../_components/evaluation/TechnicalConfigurationEvaluationNavigatorDrawer", () => ({
  TechnicalConfigurationEvaluationNavigatorDrawer: ({
    navigatorProps,
  }: {
    navigatorProps: NavigatorPaneProps
  }) => {
    mocks.recordNavigatorPaneProps(navigatorProps)
    return <div data-testid="navigator-pane-probe" />
  },
}))
vi.mock("../_components/evaluation/TechnicalConfigurationResultExportControl", () => ({
  TechnicalConfigurationResultExportControl: () => null,
}))
vi.mock("../_components/evaluation/TechnicalConfigurationEvaluationSaveActions", () => ({
  TechnicalConfigurationEvaluationSaveActions: ({ saving }: { saving: boolean }) => (
    <div data-testid="save-actions-probe" data-saving={saving ? "true" : "false"} />
  ),
}))
vi.mock("../_components/evaluation/TechnicalConfigurationEvaluationPanel", () => ({
  TechnicalConfigurationEvaluationPanel: ({
    detail,
    actions,
  }: {
    detail: { criterionCode: string } | null
    actions: ReactNode
  }) => (
    <>
      <div data-testid="evaluation-panel-probe">{detail?.criterionCode ?? "none"}</div>
      {actions}
    </>
  ),
}))

describe("technical configuration evaluation active workspace regressions", () => {
  beforeEach(() => {
    mocks.reset()
  })

  function renderWorkspace(matrixOptionId: string, page = 2): void {
    mocks.setScenario({ page })
    const result = createComparisonResult(page, matrixOptionId)
    const matrix = {
      page,
      comparison: {
        comparisonQuery: {
          data: result,
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        },
      },
      baselineVersionId: "baseline-1",
      selectedOptionIds: ["option-1"],
      visibleOptionIds: ["option-1"],
      pinnedOptionIds: [],
      focusedOptionId: null,
      selectedOptions: result.data.options,
    } as unknown as MatrixState

    render(
      <TechnicalConfigurationEvaluationActiveWorkspace
        dossier={dossier}
        baselineVersionId="baseline-1"
        baselineGroups={[]}
        options={[createOption("option-1", "Nhà cung cấp A · Model A")]}
        matrix={matrix}
        onDirtyChange={vi.fn()}
        onNavigationBlockedChange={vi.fn()}
      />
    )
  }

  it("reuses the active matrix page for the open evaluation criterion", () => {
    renderWorkspace("option-1")

    expect(mocks.getComparisonRequests()).toContainEqual({ optionIds: [], page: 2 })
    expect(mocks.getComparisonRequests()).not.toContainEqual({
      optionIds: ["option-1"],
      page: 2,
    })
    expect(screen.getByTestId("evaluation-panel-probe")).toHaveTextContent("TC-03")
  })

  it("loads panel comparison data when the active supplier is not in the matrix result", () => {
    mocks.setScenario({
      page: 2,
      panelResult: createComparisonResult(2, "option-1"),
    })
    renderWorkspace("option-2")

    expect(mocks.getComparisonRequests()).toContainEqual({ optionIds: ["option-1"], page: 2 })
    expect(screen.getByTestId("evaluation-panel-probe")).toHaveTextContent("TC-03")
  })

  it("does not announce saving for a navigation-only transition", () => {
    mocks.setScenario({ page: 2, isTransitionPending: true })
    renderWorkspace("option-1")

    expect(screen.getByTestId("save-actions-probe")).toHaveAttribute("data-saving", "false")
  })

  it("passes page-local hierarchy rows and controlled expansion to the navigator drawer", () => {
    renderWorkspace("option-1")

    const props = mocks.getNavigatorPaneProps()
    expect(props).not.toBeNull()
    expect(props?.criteria).toBe(mocks.getHierarchyRows())
    expect(props?.progress).toBeDefined()
    expect(props?.expandedRowIds).toBe(mocks.getExpandedRowIds())
    expect(props?.onExpandedRowIdsChange).toBe(mocks.getOnExpandedRowIdsChange())
  })

  it.each([
    {
      label: "loading",
      scenario: { isAssessmentLoading: true, assessmentError: null },
      expectedLoading: true,
      expectedError: false,
    },
    {
      label: "error",
      scenario: {
        isAssessmentLoading: false,
        assessmentError: new Error("assessment read failed"),
      },
      expectedLoading: false,
      expectedError: true,
    },
  ])("routes assessment cache $label state into the hierarchy navigator", (state) => {
    mocks.setScenario(state.scenario)
    renderWorkspace("option-1")

    expect(mocks.getNavigatorPaneProps()).toMatchObject({
      isLoading: state.expectedLoading,
      isError: state.expectedError,
    })
  })
})
