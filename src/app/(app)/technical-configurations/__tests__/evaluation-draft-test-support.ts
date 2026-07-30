import { renderHook } from "@testing-library/react"
import { vi, type Mock } from "vitest"

import { ASSESSMENT_RPC_FUNCTIONS } from "@/lib/technical-configuration-assessment-rpcs"
import { useTechnicalConfigurationEvaluationDraft } from "../_hooks/useTechnicalConfigurationEvaluationDraft"
import {
  createAssessmentQueryWrapper,
  createAssessmentTestQueryClient,
} from "./assessment-hook-test-support"
import {
  assessment,
  baselineVersionId,
  comparisonSet,
  criterionId,
  optionId,
  savedAssessment,
} from "./assessment-test-fixtures"

type EvaluationDraftMocks = {
  callRpc: Mock
  getOrCreateComparisonSet: Mock
  readComparisonSet: Mock
}

const evaluationDraftMocks = vi.hoisted(() => ({
  callRpc: vi.fn(),
  getOrCreateComparisonSet: vi.fn(),
  readComparisonSet: vi.fn(),
}))

vi.mock("../technical-configuration-rpc", () => ({
  callTechnicalConfigurationRpc: (...args: unknown[]) => evaluationDraftMocks.callRpc(...args),
}))

vi.mock("../technical-configuration-option-response-operations", () => ({
  getOrCreateTechnicalConfigurationComparisonSet: (...args: unknown[]) =>
    evaluationDraftMocks.getOrCreateComparisonSet(...args),
  readTechnicalConfigurationComparisonSet: (...args: unknown[]) =>
    evaluationDraftMocks.readComparisonSet(...args),
}))

export function useEvaluationDraftForTest(
  input: Parameters<typeof useTechnicalConfigurationEvaluationDraft>[0]
) {
  return useTechnicalConfigurationEvaluationDraft(input)
}

export function getEvaluationDraftMocks(): EvaluationDraftMocks {
  return evaluationDraftMocks
}

export function renderEvaluationDraftHook(onDossierRevisionChange?: (revision: number) => void) {
  const queryClient = createAssessmentTestQueryClient()
  return renderHook(
    () =>
      useTechnicalConfigurationEvaluationDraft({
        optionId,
        baselineVersionId,
        criterionId,
        expectedDossierRevision: 6,
        onDossierRevisionChange,
      }),
    { wrapper: createAssessmentQueryWrapper(queryClient) }
  )
}

export function mockExistingAssessmentSave(
  mocks: Pick<EvaluationDraftMocks, "callRpc" | "readComparisonSet">,
  data = savedAssessment
): void {
  mocks.readComparisonSet.mockResolvedValue(comparisonSet)
  mocks.callRpc.mockImplementation((fn: string) => {
    if (fn === ASSESSMENT_RPC_FUNCTIONS.listAssessments) {
      return Promise.resolve({
        data: [assessment],
        total: 1,
        page: 1,
        page_size: 100,
      })
    }
    if (fn === ASSESSMENT_RPC_FUNCTIONS.upsertAssessment) {
      return Promise.resolve({ data })
    }
    throw new Error(`Unexpected RPC: ${fn}`)
  })
}

export function resetEvaluationDraftMocks(mocks: EvaluationDraftMocks): void {
  mocks.callRpc.mockReset()
  mocks.getOrCreateComparisonSet.mockReset()
  mocks.readComparisonSet.mockReset()
}

export function hasAssessmentUpsertCall(callRpc: Mock): boolean {
  return callRpc.mock.calls.some(([fn]) => fn === ASSESSMENT_RPC_FUNCTIONS.upsertAssessment)
}
