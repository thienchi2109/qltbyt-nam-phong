import * as React from "react"
import "@testing-library/jest-dom"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationEvaluationWorkspace } from "../_components/evaluation/TechnicalConfigurationEvaluationWorkspace"
import type { TechnicalConfigurationAssessmentWire } from "@/app/(app)/technical-configurations/assessment-types"
import {
  createBaselineGroups,
  createComparisonResult,
  createDraft,
  createEvaluationAssessment,
  createOption,
  dossier,
  getCriterion,
  openCurrentCriterion,
} from "./technical-configuration-evaluation-workspace.test-support"

type EvaluationCriterionEntry = {
  criterion_id: string
  canonical_index: number
  canonical_page: number
}

const mocks = vi.hoisted(() => ({
  assessmentsByOptionId: {} as Record<
    string,
    Readonly<Record<string, TechnicalConfigurationAssessmentWire>>
  >,
  evaluationCriteriaByOptionAndFilter: {} as Record<string, readonly EvaluationCriterionEntry[]>,
  assessmentQueryError: null as Error | null,
  assessmentQueryLoading: false,
  comparisonSetQueryError: null as Error | null,
  discard: vi.fn(),
  loadEvaluationCriteria: vi.fn(),
  refetchEvaluationCriteria: vi.fn(),
  refetchAssessment: vi.fn(),
  refetchComparisonSet: vi.fn(),
  save: vi.fn(),
  synchronizeVersion: vi.fn(),
}))

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

vi.mock("../_hooks/useTechnicalConfigurationBaselineVersionSelection", () => ({
  useTechnicalConfigurationBaselineVersionSelection: () => ({
    selectedVersion: {
      id: "baseline-1",
      dossier_id: "dossier-1",
      version_number: 2,
      status: "locked",
      revision: 4,
      groups: createBaselineGroups(),
    },
    synchronizeVersion: mocks.synchronizeVersion,
    versionState: {
      versions: [],
      versionsQuery: {
        isLoading: false,
        isError: false,
      },
      retryVersions: vi.fn(),
    },
  }),
}))

vi.mock("../_hooks/useTechnicalConfigurationOptionListQuery", () => ({
  useTechnicalConfigurationOptionListQuery: () => ({
    optionsQuery: {
      data: {
        options: [
          createOption("option-1", "Nhà cung cấp A · Model A"),
          createOption("option-2", "Nhà cung cấp B · Model B"),
        ],
        revision: 3,
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    },
  }),
}))

vi.mock("../_components/evaluation/TechnicalConfigurationOptionReferenceRanking", () => ({
  TechnicalConfigurationOptionReferenceRanking: ({
    dossierId,
    baselineVersionId,
  }: {
    dossierId: string
    baselineVersionId: string
  }) => <span data-testid="reference-ranking-scope">{`${dossierId}:${baselineVersionId}`}</span>,
}))

vi.mock("../comparison-matrix-constants", () => ({
  TECHNICAL_CONFIGURATION_CRITERION_PAGE_SIZE: 2,
}))

vi.mock("../_hooks/useTechnicalConfigurationComparison", () => ({
  useTechnicalConfigurationComparison: ({
    optionIds,
    page,
  }: {
    optionIds: readonly string[]
    page: number
  }) => ({
    comparisonQuery: {
      data: optionIds[0] ? createComparisonResult(page, optionIds[0]) : undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    },
  }),
}))

vi.mock("../_hooks/useTechnicalConfigurationEvaluationCriteria", () => ({
  useTechnicalConfigurationEvaluationCriteria: ({
    optionId,
    statusFilter,
  }: {
    optionId: string
    statusFilter: string
  }) => {
    const loadCriteria = async ({
      optionId: targetOptionId,
      statusFilter: targetStatusFilter,
    }: {
      optionId: string
      statusFilter: string
    }) => {
      const override = (await mocks.loadEvaluationCriteria({
        optionId: targetOptionId,
        statusFilter: targetStatusFilter,
      })) as readonly EvaluationCriterionEntry[] | undefined
      if (override !== undefined) return override
      return (
        mocks.evaluationCriteriaByOptionAndFilter[`${targetOptionId}:${targetStatusFilter}`] ?? []
      )
    }

    return {
      criteriaQuery: {
        data: mocks.evaluationCriteriaByOptionAndFilter[`${optionId}:${statusFilter}`] ?? [],
        isLoading: false,
        isError: false,
        error: null,
        refetch: mocks.refetchEvaluationCriteria,
      },
      loadCriteria,
    }
  },
}))

vi.mock("../_hooks/useTechnicalConfigurationEvaluationDraft", async () => {
  const ReactModule = await vi.importActual<typeof import("react")>("react")

  return {
    useTechnicalConfigurationEvaluationDraft: ({
      optionId,
      baselineVersionId,
      criterionId,
      onDossierRevisionChange,
    }: {
      optionId: string
      baselineVersionId: string | null
      criterionId: string | null
      onDossierRevisionChange?: (revision: number) => void
    }) => {
      const contextKey = JSON.stringify([optionId, baselineVersionId, criterionId])
      const [draft, setDraft] = ReactModule.useState(() => createDraft(criterionId))
      const [isSaving, setIsSaving] = ReactModule.useState(false)

      ReactModule.useEffect(() => {
        setDraft(createDraft(criterionId))
      }, [contextKey, criterionId])

      const updateDraft = ReactModule.useCallback(
        (patch: {
          technicalAxis?: "fails" | "meets" | "exceeds" | null
          evidenceAxis?: "none" | "partial" | "complete" | null
          notes?: string
        }) => {
          setDraft((current) => ({
            ...current,
            ...patch,
            isDirty: true,
            error: null,
          }))
        },
        []
      )

      const save = ReactModule.useCallback(async () => {
        setIsSaving(true)
        setDraft((current) => ({ ...current, saveStatus: "saving", error: null }))
        try {
          const result = await mocks.save({
            optionId,
            baselineVersionId,
            criterionId,
          })
          setDraft((current) => ({
            ...current,
            isDirty: false,
            saveStatus: "idle",
            error: null,
          }))
          onDossierRevisionChange?.(7)
          return result
        } catch (error) {
          setDraft((current) => ({
            ...current,
            isDirty: true,
            saveStatus: "error",
            error,
          }))
          throw error
        } finally {
          setIsSaving(false)
        }
      }, [baselineVersionId, criterionId, onDossierRevisionChange, optionId])

      return {
        assessmentsByCriterionId: mocks.assessmentsByOptionId[optionId] ?? {},
        assessmentQuery: {
          isLoading: mocks.assessmentQueryLoading,
          isError: mocks.assessmentQueryError !== null,
          error: mocks.assessmentQueryError,
          refetch: mocks.refetchAssessment,
        },
        comparisonSetQuery: {
          isLoading: false,
          isError: mocks.comparisonSetQueryError !== null,
          error: mocks.comparisonSetQueryError,
          refetch: mocks.refetchComparisonSet,
        },
        draft,
        isReady: criterionId !== null,
        isSaving,
        error: draft.error,
        setTechnicalAxis: (technicalAxis: "fails" | "meets" | "exceeds" | null) =>
          updateDraft({ technicalAxis }),
        setEvidenceAxis: (evidenceAxis: "none" | "partial" | "complete" | null) =>
          updateDraft({ evidenceAxis }),
        setNotes: (notes: string) => updateDraft({ notes }),
        discard: mocks.discard,
        save,
      }
    },
  }
})

const originalHasPointerCapture = HTMLElement.prototype.hasPointerCapture
const originalSetPointerCapture = HTMLElement.prototype.setPointerCapture
const originalReleasePointerCapture = HTMLElement.prototype.releasePointerCapture
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView

beforeAll(() => {
  HTMLElement.prototype.hasPointerCapture = () => false
  HTMLElement.prototype.setPointerCapture = () => undefined
  HTMLElement.prototype.releasePointerCapture = () => undefined
  HTMLElement.prototype.scrollIntoView = () => undefined
})

afterAll(() => {
  HTMLElement.prototype.hasPointerCapture = originalHasPointerCapture
  HTMLElement.prototype.setPointerCapture = originalSetPointerCapture
  HTMLElement.prototype.releasePointerCapture = originalReleasePointerCapture
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView
})

describe("P12A2 technical configuration evaluation workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.loadEvaluationCriteria.mockReset()
    const allCriteria = [
      { criterion_id: "criterion-1", canonical_index: 1, canonical_page: 1 },
      { criterion_id: "criterion-2", canonical_index: 2, canonical_page: 1 },
      { criterion_id: "criterion-3", canonical_index: 3, canonical_page: 2 },
    ] as const
    mocks.evaluationCriteriaByOptionAndFilter = {
      "option-1:all": allCriteria,
      "option-1:not_evaluated": [allCriteria[2]],
      "option-1:fails": [allCriteria[1]],
      "option-1:insufficient_evidence": [],
      "option-2:all": allCriteria,
      "option-2:not_evaluated": [allCriteria[0], allCriteria[1]],
      "option-2:fails": [allCriteria[0]],
      "option-2:insufficient_evidence": [],
    }
    mocks.assessmentsByOptionId = {
      "option-1": {
        "criterion-1": createEvaluationAssessment("option-1", "criterion-1", "meets", "complete"),
        "criterion-2": createEvaluationAssessment("option-1", "criterion-2", "fails", null),
      },
      "option-2": {
        "criterion-3": createEvaluationAssessment("option-2", "criterion-3", "exceeds", "complete"),
      },
    }
    mocks.assessmentQueryError = null
    mocks.assessmentQueryLoading = false
    mocks.comparisonSetQueryError = null
    mocks.save.mockResolvedValue({})
  })

  it("renders progress only for the selected option across the complete baseline universe", async () => {
    const user = userEvent.setup()

    render(<TechnicalConfigurationEvaluationWorkspace dossier={dossier} />)

    expect(screen.getByTestId("reference-ranking-scope")).toHaveTextContent("dossier-1:baseline-1")
    expect(await screen.findByText("Đã đánh giá 2 / 3 tiêu chí")).toBeInTheDocument()
    expect(screen.getByText("2 / 2")).toBeInTheDocument()
    expect(screen.getByText("0 / 1")).toBeInTheDocument()

    await user.click(screen.getByLabelText("Phương án đánh giá"))
    await user.click(await screen.findByRole("option", { name: "Nhà cung cấp B · Model B" }))

    expect(await screen.findByText("Đã đánh giá 1 / 3 tiêu chí")).toBeInTheDocument()
    expect(screen.getByText("0 / 2")).toBeInTheDocument()
    expect(screen.getByText("1 / 1")).toBeInTheDocument()
    expect(screen.queryByText("Đã đánh giá 2 / 3 tiêu chí")).not.toBeInTheDocument()
  })

  it("does not render false progress counters while complete assessments are loading", () => {
    mocks.assessmentQueryLoading = true

    render(<TechnicalConfigurationEvaluationWorkspace dossier={dossier} />)

    expect(screen.getByText("Đang tải tiến độ đánh giá...")).toBeInTheDocument()
    expect(screen.queryByText(/Đã đánh giá \d+ \/ 3 tiêu chí/)).not.toBeInTheDocument()
  })

  it.each([
    {
      label: "Chưa đánh giá",
      statusFilter: "not_evaluated",
      expectedCriterionIds: ["criterion-3"],
    },
    {
      label: "Không đạt",
      statusFilter: "fails",
      expectedCriterionIds: ["criterion-2"],
    },
    {
      label: "Chưa đủ bằng chứng",
      statusFilter: "insufficient_evidence",
      expectedCriterionIds: [],
    },
  ])(
    "renders only canonical IDs returned by the server-side $statusFilter filter",
    async ({ label, statusFilter, expectedCriterionIds }) => {
      const user = userEvent.setup()

      render(<TechnicalConfigurationEvaluationWorkspace dossier={dossier} />)

      await user.click(screen.getByLabelText("Lọc trạng thái đánh giá"))
      await user.click(await screen.findByRole("option", { name: label }))

      await waitFor(() =>
        expect(mocks.loadEvaluationCriteria).toHaveBeenCalledWith({
          optionId: "option-1",
          statusFilter,
        })
      )
      expect(
        screen
          .queryAllByTestId("evaluation-criterion")
          .map((criterion) => criterion.getAttribute("data-criterion-id"))
      ).toEqual(expectedCriterionIds)
      if (expectedCriterionIds.length === 0) {
        expect(screen.getByText("Không có tiêu chí phù hợp")).toBeInTheDocument()
      }
    }
  )

  it("keeps the saved panel open when Lưu removes the current criterion from the filter", async () => {
    const user = userEvent.setup()

    render(<TechnicalConfigurationEvaluationWorkspace dossier={dossier} />)

    await user.click(screen.getByLabelText("Lọc trạng thái đánh giá"))
    await user.click(await screen.findByRole("option", { name: "Không đạt" }))
    await user.click(getCriterion("criterion-2"))
    await user.type(screen.getByLabelText("Ghi chú"), "Lưu rồi rời bộ lọc")
    mocks.save.mockImplementationOnce(async () => {
      mocks.evaluationCriteriaByOptionAndFilter["option-1:fails"] = []
      return {}
    })

    await user.click(screen.getByRole("button", { name: "Lưu", exact: true }))

    expect(
      await screen.findByText("Tiêu chí đang mở không còn phù hợp với bộ lọc sau khi lưu.")
    ).toBeInTheDocument()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("Phản hồi TC-02")).toBeInTheDocument()
  })

  it("restores filter, page, criterion, panel and draft when dirty filter navigation is cancelled", async () => {
    const user = userEvent.setup()

    render(<TechnicalConfigurationEvaluationWorkspace dossier={dossier} />)

    await user.click(screen.getByRole("button", { name: "Trang tiếp theo" }))
    await user.click(getCriterion("criterion-3"))
    await user.type(screen.getByLabelText("Ghi chú"), "Giữ nguyên toàn bộ state")
    await user.click(screen.getByRole("button", { name: "Đóng chi tiết tiêu chí" }))

    await user.click(screen.getByLabelText("Lọc trạng thái đánh giá"))
    await user.click(await screen.findByRole("option", { name: "Không đạt" }))
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Bỏ thay đổi chưa lưu?")
    await user.click(screen.getByRole("button", { name: "Hủy" }))

    expect(screen.getByLabelText("Lọc trạng thái đánh giá")).toHaveTextContent("Tất cả")
    expect(screen.getByText("Trang 2/2")).toBeInTheDocument()
    expect(getCriterion("criterion-3")).toHaveAttribute("aria-current", "true")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await user.click(getCriterion("criterion-3"))
    expect(screen.getByLabelText("Ghi chú")).toHaveValue("Giữ nguyên toàn bộ state")
  })

  it("freezes navigation while loading filtered IDs and guards before committing", async () => {
    const user = userEvent.setup()
    const deferred = createDeferred<readonly EvaluationCriterionEntry[]>()
    mocks.loadEvaluationCriteria.mockReturnValueOnce(deferred.promise)

    render(<TechnicalConfigurationEvaluationWorkspace dossier={dossier} />)

    await openCurrentCriterion(user)
    await user.type(screen.getByLabelText("Ghi chú"), "Phải guard trước RPC")
    await user.click(screen.getByRole("button", { name: "Đóng chi tiết tiêu chí" }))
    await user.click(screen.getByLabelText("Lọc trạng thái đánh giá"))
    await user.click(await screen.findByRole("option", { name: "Không đạt" }))

    await waitFor(() => expect(mocks.loadEvaluationCriteria).toHaveBeenCalledTimes(1))
    expect(screen.getByLabelText("Phương án đánh giá")).toBeDisabled()
    expect(screen.getByLabelText("Lọc trạng thái đánh giá")).toBeDisabled()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()

    deferred.resolve(mocks.evaluationCriteriaByOptionAndFilter["option-1:fails"])

    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Bỏ thay đổi chưa lưu?")
    await user.click(screen.getByRole("button", { name: "Bỏ thay đổi" }))
    await waitFor(() => expect(getCriterion("criterion-2")).toHaveAttribute("aria-current", "true"))
    expect(screen.getByLabelText("Lọc trạng thái đánh giá")).toHaveTextContent("Không đạt")
  })

  it("keeps the active filter and resolves selection deterministically when option changes", async () => {
    const user = userEvent.setup()

    render(<TechnicalConfigurationEvaluationWorkspace dossier={dossier} />)

    await user.click(screen.getByLabelText("Lọc trạng thái đánh giá"))
    await user.click(await screen.findByRole("option", { name: "Không đạt" }))
    expect(getCriterion("criterion-2")).toHaveAttribute("aria-current", "true")

    await user.click(screen.getByLabelText("Phương án đánh giá"))
    await user.click(await screen.findByRole("option", { name: "Nhà cung cấp B · Model B" }))

    expect(screen.getByLabelText("Lọc trạng thái đánh giá")).toHaveTextContent("Không đạt")
    expect(getCriterion("criterion-1")).toHaveAttribute("aria-current", "true")
  })

  it("moves save-next through matching canonical results and shows no-more-match without wrapping", async () => {
    const user = userEvent.setup()
    const matchingCriteria = [
      { criterion_id: "criterion-1", canonical_index: 1, canonical_page: 1 },
      { criterion_id: "criterion-3", canonical_index: 3, canonical_page: 2 },
    ] as const
    mocks.evaluationCriteriaByOptionAndFilter["option-1:fails"] = matchingCriteria
    mocks.assessmentsByOptionId["option-1"] = {
      ...mocks.assessmentsByOptionId["option-1"],
      "criterion-1": createEvaluationAssessment("option-1", "criterion-1", "fails", null),
      "criterion-3": createEvaluationAssessment("option-1", "criterion-3", "fails", null),
    }

    render(<TechnicalConfigurationEvaluationWorkspace dossier={dossier} />)

    await user.click(screen.getByLabelText("Lọc trạng thái đánh giá"))
    await user.click(await screen.findByRole("option", { name: "Không đạt" }))
    await user.click(getCriterion("criterion-1"))
    await user.type(screen.getByLabelText("Ghi chú"), "Tiếp tục theo filter")
    await user.click(screen.getByRole("button", { name: "Lưu & tiếp tục" }))

    await waitFor(() => expect(getCriterion("criterion-3")).toHaveAttribute("aria-current", "true"))
    expect(screen.getByText("Phản hồi TC-03")).toBeInTheDocument()

    mocks.save.mockImplementationOnce(async () => {
      mocks.evaluationCriteriaByOptionAndFilter["option-1:fails"] = []
      return {}
    })
    await user.type(screen.getByLabelText("Ghi chú"), "Kết quả cuối")
    await user.click(screen.getByRole("button", { name: "Lưu & tiếp tục" }))

    expect(await screen.findByText("Không còn tiêu chí phù hợp với bộ lọc.")).toBeInTheDocument()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("Phản hồi TC-03")).toBeInTheDocument()
  })

  it("blocks option and filter changes while save-next reloads matching criteria", async () => {
    const user = userEvent.setup()
    const matchingCriteria = [
      { criterion_id: "criterion-1", canonical_index: 1, canonical_page: 1 },
      { criterion_id: "criterion-3", canonical_index: 3, canonical_page: 2 },
    ] as const
    const criteriaReload = createDeferred<readonly EvaluationCriterionEntry[]>()
    mocks.evaluationCriteriaByOptionAndFilter["option-1:fails"] = matchingCriteria
    mocks.assessmentsByOptionId["option-1"] = {
      ...mocks.assessmentsByOptionId["option-1"],
      "criterion-1": createEvaluationAssessment("option-1", "criterion-1", "fails", null),
      "criterion-3": createEvaluationAssessment("option-1", "criterion-3", "fails", null),
    }

    render(<TechnicalConfigurationEvaluationWorkspace dossier={dossier} />)

    await user.click(screen.getByLabelText("Lọc trạng thái đánh giá"))
    await user.click(await screen.findByRole("option", { name: "Không đạt" }))
    await user.click(getCriterion("criterion-1"))
    await user.type(screen.getByLabelText("Ghi chú"), "Chờ tải tiêu chí kế tiếp")
    mocks.loadEvaluationCriteria.mockReset()
    mocks.loadEvaluationCriteria.mockReturnValueOnce(criteriaReload.promise)

    await user.click(screen.getByRole("button", { name: "Lưu & tiếp tục" }))

    await waitFor(() => expect(mocks.loadEvaluationCriteria).toHaveBeenCalledTimes(1))
    expect(screen.getByLabelText("Phương án đánh giá")).toBeDisabled()
    expect(screen.getByLabelText("Lọc trạng thái đánh giá")).toBeDisabled()

    await act(async () => {
      criteriaReload.resolve(matchingCriteria)
      await criteriaReload.promise
    })

    await waitFor(() => expect(getCriterion("criterion-3")).toHaveAttribute("aria-current", "true"))
    expect(screen.getByLabelText("Phương án đánh giá")).not.toBeDisabled()
    expect(screen.getByLabelText("Lọc trạng thái đánh giá")).not.toBeDisabled()
  })

  it("preserves filtered navigation and draft when save-next fails", async () => {
    const user = userEvent.setup()
    const matchingCriteria = [
      { criterion_id: "criterion-1", canonical_index: 1, canonical_page: 1 },
      { criterion_id: "criterion-3", canonical_index: 3, canonical_page: 2 },
    ] as const
    mocks.evaluationCriteriaByOptionAndFilter["option-1:fails"] = matchingCriteria
    mocks.assessmentsByOptionId["option-1"] = {
      ...mocks.assessmentsByOptionId["option-1"],
      "criterion-1": createEvaluationAssessment("option-1", "criterion-1", "fails", null),
      "criterion-3": createEvaluationAssessment("option-1", "criterion-3", "fails", null),
    }
    mocks.save.mockRejectedValueOnce(new Error("save_failed"))

    render(<TechnicalConfigurationEvaluationWorkspace dossier={dossier} />)

    await user.click(screen.getByLabelText("Lọc trạng thái đánh giá"))
    await user.click(await screen.findByRole("option", { name: "Không đạt" }))
    await user.click(getCriterion("criterion-1"))
    await user.type(screen.getByLabelText("Ghi chú"), "Giữ draft khi lỗi")
    mocks.loadEvaluationCriteria.mockClear()

    await user.click(screen.getByRole("button", { name: "Lưu & tiếp tục" }))

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
    expect(mocks.loadEvaluationCriteria).not.toHaveBeenCalled()
    expect(screen.getByLabelText("Lọc trạng thái đánh giá")).toHaveTextContent("Không đạt")
    expect(getCriterion("criterion-1")).toHaveAttribute("aria-current", "true")
    expect(screen.getByLabelText("Ghi chú")).toHaveValue("Giữ draft khi lỗi")
    expect(screen.queryByText("Không còn tiêu chí phù hợp với bộ lọc.")).not.toBeInTheDocument()
  })

  it("keeps Lưu on the criterion and advances Lưu & tiếp tục across page boundaries", async () => {
    const user = userEvent.setup()

    render(<TechnicalConfigurationEvaluationWorkspace dossier={dossier} />)

    await openCurrentCriterion(user)
    await user.type(screen.getByLabelText("Ghi chú"), "Giữ tiêu chí hiện tại")
    await user.click(screen.getByRole("button", { name: "Lưu", exact: true }))

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
    expect(getCriterion("criterion-1")).toHaveAttribute("aria-current", "true")

    await user.type(screen.getByLabelText("Ghi chú"), " rồi tiếp tục")
    await user.click(screen.getByRole("button", { name: "Lưu & tiếp tục" }))

    await waitFor(() => expect(getCriterion("criterion-2")).toHaveAttribute("aria-current", "true"))

    await user.type(screen.getByLabelText("Ghi chú"), "Qua trang kế")
    await user.click(screen.getByRole("button", { name: "Lưu & tiếp tục" }))

    expect(await screen.findByText("Trang 2/2")).toBeInTheDocument()
    expect(getCriterion("criterion-3")).toHaveAttribute("data-criterion-id", "criterion-3")
    expect(getCriterion("criterion-3")).toHaveAttribute("aria-current", "true")

    await user.type(screen.getByLabelText("Ghi chú"), "Tiêu chí cuối")
    await user.click(screen.getByRole("button", { name: "Lưu & tiếp tục" }))

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(4))
    expect(screen.getByText("Trang 2/2")).toBeInTheDocument()
    expect(getCriterion("criterion-3")).toHaveAttribute("data-criterion-id", "criterion-3")
  })

  it("guards dirty criterion, option and page navigation while preserving cancel state", async () => {
    const user = userEvent.setup()
    const addEventListener = vi.spyOn(window, "addEventListener")

    render(<TechnicalConfigurationEvaluationWorkspace dossier={dossier} />)

    await openCurrentCriterion(user)
    await user.type(screen.getByLabelText("Ghi chú"), "Không được mất")

    const beforeUnloadHandler = addEventListener.mock.calls.find(
      ([eventName]) => eventName === "beforeunload"
    )?.[1]
    expect(beforeUnloadHandler).toEqual(expect.any(Function))
    const beforeUnloadEvent = new Event("beforeunload", { cancelable: true })
    act(() => {
      beforeUnloadHandler?.(beforeUnloadEvent)
    })
    expect(beforeUnloadEvent.defaultPrevented).toBe(true)

    await user.click(screen.getByRole("button", { name: "Đóng chi tiết tiêu chí" }))
    await user.click(getCriterion("criterion-2"))
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Bỏ thay đổi chưa lưu?")
    await user.click(screen.getByRole("button", { name: "Hủy" }))

    await user.click(getCriterion("criterion-1"))
    expect(screen.getByLabelText("Ghi chú")).toHaveValue("Không được mất")
    expect(getCriterion("criterion-1")).toHaveAttribute("data-criterion-id", "criterion-1")
    await user.click(screen.getByRole("button", { name: "Đóng chi tiết tiêu chí" }))

    await user.click(screen.getByLabelText("Phương án đánh giá"))
    await user.click(await screen.findByRole("option", { name: "Nhà cung cấp B · Model B" }))
    await user.click(screen.getByRole("button", { name: "Hủy" }))
    expect(screen.getByLabelText("Phương án đánh giá")).toHaveTextContent(
      "Nhà cung cấp A · Model A"
    )

    await user.click(screen.getByRole("button", { name: "Trang tiếp theo" }))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Bỏ thay đổi" }))

    expect(mocks.discard).toHaveBeenCalledTimes(1)
    expect(await screen.findByText("Trang 2/2")).toBeInTheDocument()
    expect(getCriterion("criterion-3")).toHaveAttribute("data-criterion-id", "criterion-3")
  })

  it("hard-blocks navigation while a save is pending", async () => {
    let resolveSave!: (value: object) => void
    mocks.save.mockReturnValue(
      new Promise<object>((resolve) => {
        resolveSave = resolve
      })
    )
    const user = userEvent.setup()

    render(<TechnicalConfigurationEvaluationWorkspace dossier={dossier} />)

    await openCurrentCriterion(user)
    await user.type(screen.getByLabelText("Ghi chú"), "Đang lưu")
    await user.click(screen.getByRole("button", { name: "Lưu", exact: true }))

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Trang tiếp theo", hidden: true })).toBeDisabled()
    )
    expect(screen.getByLabelText("Phương án đánh giá")).toBeDisabled()
    expect(screen.getByLabelText("Lọc trạng thái đánh giá")).toBeDisabled()
    for (const criterion of screen.getAllByTestId("evaluation-criterion")) {
      expect(criterion).toBeDisabled()
    }
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()

    await act(async () => {
      resolveSave({})
    })
  })

  it("surfaces assessment read failures with an explicit retry", async () => {
    mocks.assessmentQueryError = new Error("assessment read failed")
    const user = userEvent.setup()

    render(<TechnicalConfigurationEvaluationWorkspace dossier={dossier} />)

    expect(await screen.findByText("Không thể tải dữ liệu đánh giá")).toBeInTheDocument()
    expect(screen.getByText("Chưa thể tính tiến độ đánh giá.")).toBeInTheDocument()
    expect(screen.queryByText(/Đã đánh giá \d+ \/ 3 tiêu chí/)).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Thử lại" }))

    expect(mocks.refetchAssessment).toHaveBeenCalledTimes(1)
    expect(mocks.refetchComparisonSet).not.toHaveBeenCalled()
  })
})
