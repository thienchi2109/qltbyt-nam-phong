import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationEvaluationActiveWorkspace } from "../_components/evaluation/TechnicalConfigurationEvaluationActiveWorkspace"
import {
  createComparisonResult,
  createOption,
  dossier,
} from "./technical-configuration-evaluation-workspace.test-support"

type MatrixState = ReturnType<
  typeof import("../_hooks/useTechnicalConfigurationComparisonMatrix").useTechnicalConfigurationComparisonMatrix
>

const mocks = vi.hoisted(() => ({
  comparisonRequests: [] as Array<{ optionIds: string[]; page: number }>,
}))

vi.mock("../_hooks/useTechnicalConfigurationComparison", () => ({
  useTechnicalConfigurationComparison: ({
    optionIds,
    page,
  }: {
    optionIds: readonly string[]
    page: number
  }) => {
    mocks.comparisonRequests.push({ optionIds: [...optionIds], page })
    return {
      comparisonQuery: {
        data: undefined,
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
    currentCriterion: { canonicalPage: 1 },
    criterionId: "criterion-1",
    selectedOption: createOption("option-1", "Nhà cung cấp A · Model A"),
    projection: [],
    statusFilter: "all",
    isTransitionPending: false,
    criteriaQuery: {
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    },
    isCurrentCriterionFilteredOut: false,
    hasNoMoreMatches: false,
    isPanelOpen: true,
  }),
}))

vi.mock("../_hooks/useTechnicalConfigurationEvaluationDraft", () => ({
  useTechnicalConfigurationEvaluationDraft: () => ({
    assessmentQuery: { isLoading: false, isError: false, error: null },
    comparisonSetQuery: { isLoading: false, isError: false, error: null },
    assessmentsByCriterionId: {},
    draft: null,
    isSaving: false,
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
  TechnicalConfigurationEvaluationMatrixControls: () => null,
}))
vi.mock("../_components/evaluation/TechnicalConfigurationEvaluationMatrixToolbar", () => ({
  TechnicalConfigurationEvaluationMatrixToolbar: () => null,
}))
vi.mock("../_components/evaluation/TechnicalConfigurationProgressSummary", () => ({
  TechnicalConfigurationProgressSummary: () => null,
}))
vi.mock("../_components/evaluation/TechnicalConfigurationResultExportControl", () => ({
  TechnicalConfigurationResultExportControl: () => null,
}))
vi.mock("../_components/evaluation/TechnicalConfigurationEvaluationSaveActions", () => ({
  TechnicalConfigurationEvaluationSaveActions: () => null,
}))
vi.mock("../_components/evaluation/TechnicalConfigurationEvaluationPanel", () => ({
  TechnicalConfigurationEvaluationPanel: ({
    detail,
  }: {
    detail: { criterionCode: string } | null
  }) => <div data-testid="evaluation-panel-probe">{detail?.criterionCode ?? "none"}</div>,
}))

describe("technical configuration evaluation active workspace regressions", () => {
  beforeEach(() => {
    mocks.comparisonRequests = []
  })

  function renderWorkspace(matrixOptionId: string) {
    const result = createComparisonResult(1, matrixOptionId)
    const matrix = {
      page: 1,
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

    expect(mocks.comparisonRequests).toContainEqual({ optionIds: [], page: 1 })
    expect(mocks.comparisonRequests).not.toContainEqual({ optionIds: ["option-1"], page: 1 })
    expect(screen.getByTestId("evaluation-panel-probe")).toHaveTextContent("TC-01")
  })

  it("loads panel comparison data when the active supplier is not in the matrix result", () => {
    renderWorkspace("option-2")

    expect(mocks.comparisonRequests).toContainEqual({ optionIds: ["option-1"], page: 1 })
  })
})
