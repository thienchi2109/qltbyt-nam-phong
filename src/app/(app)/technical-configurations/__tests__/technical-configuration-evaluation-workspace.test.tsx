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
  matrixFocusedOptionId: null as string | null,
  matrixSelectedOptionIds: ["option-1", "option-2"] as string[],
  matrixVisibleOptionIds: ["option-1", "option-2"] as string[],
  refetchEvaluationCriteria: vi.fn(),
  refetchAssessment: vi.fn(),
  refetchComparisonSet: vi.fn(),
  resetResultExport: vi.fn(),
  retryResultExport: vi.fn(),
  save: vi.fn(),
  startResultExport: vi.fn(),
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

async function waitForEvaluationPanelToClose() {
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(document.body.style.pointerEvents).not.toBe("none")
  })
}

function getEvaluationFilterButton(label: string) {
  return within(
    screen.getByRole("group", {
      name: "Bộ lọc trạng thái đánh giá",
      hidden: true,
    })
  ).getByRole("button", {
    name: new RegExp(`^${label} `),
    hidden: true,
  })
}

async function selectEvaluationFilter(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(getEvaluationFilterButton(label))
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

vi.mock("../_hooks/useTechnicalConfigurationComparisonMatrix", () => ({
  useTechnicalConfigurationComparisonMatrix: () => {
    const [page, setPage] = React.useState(1)
    const [visibleOptionIds, setVisibleOptionIds] = React.useState(
      () => mocks.matrixVisibleOptionIds
    )
    const [focusedOptionId, setFocusedOptionId] = React.useState(() => mocks.matrixFocusedOptionId)
    const options = [
      createOption("option-1", "Nhà cung cấp A · Model A"),
      createOption("option-2", "Nhà cung cấp B · Model B"),
    ]
    const versions = [
      {
        id: "baseline-1",
        dossier_id: "dossier-1",
        version_number: 2,
        status: "locked",
        revision: 4,
        groups: createBaselineGroups(),
      },
    ]

    return {
      baselineVersionId: "baseline-1",
      versions,
      versionsQuery: {
        isLoading: false,
        isError: false,
        isFetchingNextPage: false,
        hasNextPage: false,
      },
      options,
      optionsQuery: {
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      },
      selectedOptionIds: mocks.matrixSelectedOptionIds,
      selectedOptions: options.filter((option) =>
        mocks.matrixSelectedOptionIds.includes(option.id)
      ),
      visibleOptionIds,
      pinnedOptionIds: [],
      focusedOptionId,
      page,
      isSelectionLimitReached: false,
      comparison: {
        comparisonQuery: {
          data: createComparisonResult(page, "option-1"),
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        },
      },
      selectBaselineVersion: vi.fn(),
      loadMoreVersions: vi.fn(),
      retryVersions: vi.fn(),
      addOption: vi.fn(),
      removeOption: vi.fn(),
      setPage,
      toggleOptionVisibility: (optionId: string) =>
        setVisibleOptionIds((current) =>
          current.includes(optionId)
            ? current.filter((currentOptionId) => currentOptionId !== optionId)
            : [...current, optionId]
        ),
      toggleOptionPin: vi.fn(),
      focusOption: setFocusedOptionId,
      exitFocusMode: () => setFocusedOptionId(null),
    }
  },
}))

vi.mock("../_hooks/useTechnicalConfigurationResultExport", () => ({
  useTechnicalConfigurationResultExport: () => ({
    status: "idle",
    error: null,
    startExport: mocks.startResultExport,
    retry: mocks.retryResultExport,
    reset: mocks.resetResultExport,
  }),
}))

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: {
        id: "user-1",
        username: "admin",
        full_name: "Nguyễn Văn A",
        role: "admin",
      },
    },
    status: "authenticated",
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

vi.mock("../comparison-matrix-constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../comparison-matrix-constants")>()
  return {
    ...actual,
    TECHNICAL_CONFIGURATION_CRITERION_PAGE_SIZE: 2,
  }
})

vi.mock("../_components/comparison/TechnicalConfigurationMatrix", async () => {
  const { TechnicalConfigurationEvaluationMatrixTestAdapter } =
    await import("./technical-configuration-evaluation-workspace.matrix-test-adapter")
  return {
    TechnicalConfigurationMatrix: TechnicalConfigurationEvaluationMatrixTestAdapter,
  }
})

vi.mock("@/components/shared/SideSheetShell", () => ({
  SideSheetShell: ({
    open,
    title,
    children,
    closeLabel,
    onOpenChange,
    onCloseAutoFocus,
  }: {
    open: boolean
    title?: React.ReactNode
    children: React.ReactNode
    closeLabel?: string
    onOpenChange: (open: boolean) => void
    onCloseAutoFocus?: (event: { preventDefault: () => void }) => void
  }) =>
    open ? (
      <div role="dialog" aria-label={typeof title === "string" ? title : undefined}>
        {children}
        {closeLabel ? (
          <button
            type="button"
            aria-label={closeLabel}
            onClick={() => {
              onOpenChange(false)
              onCloseAutoFocus?.({ preventDefault: () => undefined })
            }}
          />
        ) : null}
      </div>
    ) : null,
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
    document.body.style.pointerEvents = ""
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
    mocks.matrixFocusedOptionId = null
    mocks.matrixSelectedOptionIds = ["option-1", "option-2"]
    mocks.matrixVisibleOptionIds = ["option-1", "option-2"]
    mocks.save.mockResolvedValue({})
  })

  it("renders progress only for the selected option across the complete baseline universe", async () => {
    const user = userEvent.setup()

    render(<TechnicalConfigurationEvaluationWorkspace dossier={dossier} />)

    expect(screen.getByTestId("reference-ranking-scope")).toHaveTextContent("dossier-1:baseline-1")
    expect(screen.getByTestId("evaluation-matrix-adapter")).toHaveAttribute(
      "data-viewport-height-class-name",
      "max-h-[calc(100dvh-12rem)]"
    )
    expect(screen.getByRole("progressbar", { name: "Tiến độ đánh giá" })).toHaveAttribute(
      "aria-valuetext",
      "2 trên 3 tiêu chí đã đánh giá"
    )
    expect(screen.getByText("2 / 3 tiêu chí")).toBeInTheDocument()

    await user.click(screen.getByLabelText("Phương án đánh giá"))
    await user.click(await screen.findByRole("option", { name: "Nhà cung cấp B · Model B" }))

    expect(screen.getByRole("progressbar", { name: "Tiến độ đánh giá" })).toHaveAttribute(
      "aria-valuetext",
      "1 trên 3 tiêu chí đã đánh giá"
    )
    expect(screen.getByText("1 / 3 tiêu chí")).toBeInTheDocument()
    expect(screen.queryByText("2 / 3 tiêu chí")).not.toBeInTheDocument()
  })

  it("exports the active option and current criterion page without changing navigator state", async () => {
    const user = userEvent.setup()

    render(<TechnicalConfigurationEvaluationWorkspace dossier={dossier} />)

    expect(mocks.startResultExport).not.toHaveBeenCalled()
    await user.click(screen.getByLabelText("Phương án đánh giá"))
    await user.click(await screen.findByRole("option", { name: "Nhà cung cấp B · Model B" }))
    await user.click(screen.getByRole("button", { name: "Trang tiếp theo" }))

    expect(await screen.findByText("Trang 2/2")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Xuất kết quả Excel" }))

    expect(screen.queryByRole("radio", { name: /đang hiển thị/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole("radio", { name: "1 phương án đã chọn" }))
    await user.click(screen.getByRole("radio", { name: "Trang tiêu chí hiện tại · 1 tiêu chí" }))
    await user.click(screen.getByRole("button", { name: "Xuất file .xlsx" }))

    expect(mocks.startResultExport).toHaveBeenCalledWith({
      mode: "full",
      dossierId: "dossier-1",
      baselineVersionId: "baseline-1",
      optionIds: ["option-2"],
      criterionIds: ["criterion-3"],
    })
    expect(screen.getByLabelText("Phương án đánh giá")).toHaveTextContent(
      "Nhà cung cấp B · Model B"
    )
    expect(screen.getByText("Trang 2/2")).toBeInTheDocument()
    expect(getCriterion("criterion-3")).toHaveAttribute("data-criterion-id", "criterion-3")
  })

  it("does not render false progress counters while complete assessments are loading", () => {
    mocks.assessmentQueryLoading = true

    render(<TechnicalConfigurationEvaluationWorkspace dossier={dossier} />)

    expect(screen.getByText("Đang tải tiến độ đánh giá...")).toBeInTheDocument()
    expect(screen.queryByTestId("evaluation-progress-kpi-grid")).not.toBeInTheDocument()
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
    "marks only canonical IDs returned by the server-side $statusFilter filter",
    async ({ label, statusFilter, expectedCriterionIds }) => {
      const user = userEvent.setup()

      render(<TechnicalConfigurationEvaluationWorkspace dossier={dossier} />)

      await selectEvaluationFilter(user, label)

      await waitFor(() =>
        expect(mocks.loadEvaluationCriteria).toHaveBeenCalledWith({
          optionId: "option-1",
          statusFilter,
        })
      )
      expect(
        screen
          .queryAllByTestId("evaluation-criterion")
          .filter((criterion) => criterion.getAttribute("data-filter-match") === "true")
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

    await selectEvaluationFilter(user, "Không đạt")
    await user.click(getCriterion("criterion-2"))
    await user.type(screen.getByLabelText("Ghi chú"), "Lưu rồi rời bộ lọc")
    mocks.save.mockImplementationOnce(async () => {
      mocks.evaluationCriteriaByOptionAndFilter["option-1:fails"] = []
      return {}
    })

    await user.click(screen.getByRole("button", { name: "Lưu", exact: true }))

    expect(
      await screen.findByText("Tiêu chí đang mở không còn thuộc luồng đánh giá hiện tại.")
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
    await waitForEvaluationPanelToClose()

    await selectEvaluationFilter(user, "Không đạt")
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Bỏ thay đổi chưa lưu?")
    await user.click(screen.getByRole("button", { name: "Hủy" }))

    expect(getEvaluationFilterButton("Tất cả")).toHaveAttribute("aria-pressed", "true")
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
    await waitForEvaluationPanelToClose()
    await selectEvaluationFilter(user, "Không đạt")

    await waitFor(() => expect(mocks.loadEvaluationCriteria).toHaveBeenCalledTimes(1))
    expect(screen.getByLabelText("Phương án đánh giá")).toBeDisabled()
    expect(screen.getByLabelText("Lọc trạng thái đánh giá")).toBeDisabled()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()

    deferred.resolve(mocks.evaluationCriteriaByOptionAndFilter["option-1:fails"])

    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Bỏ thay đổi chưa lưu?")
    await user.click(screen.getByRole("button", { name: "Bỏ thay đổi" }))
    await waitFor(() => expect(getCriterion("criterion-2")).toHaveAttribute("aria-current", "true"))
    expect(getEvaluationFilterButton("Không đạt")).toHaveAttribute("aria-pressed", "true")
  })

  it("keeps the active filter and resolves selection deterministically when option changes", async () => {
    const user = userEvent.setup()

    render(<TechnicalConfigurationEvaluationWorkspace dossier={dossier} />)

    await selectEvaluationFilter(user, "Không đạt")
    expect(getCriterion("criterion-2")).toHaveAttribute("aria-current", "true")

    await user.click(screen.getByLabelText("Phương án đánh giá"))
    await user.click(await screen.findByRole("option", { name: "Nhà cung cấp B · Model B" }))

    expect(getEvaluationFilterButton("Không đạt")).toHaveAttribute("aria-pressed", "true")
    expect(getCriterion("criterion-1")).toHaveAttribute("aria-current", "true")
  })

  it("keeps the evaluator synchronized with the canonical matrix page before option changes", async () => {
    const user = userEvent.setup()

    render(<TechnicalConfigurationEvaluationWorkspace dossier={dossier} />)

    expect(getCriterion("criterion-1")).toHaveAttribute("aria-current", "true")
    await user.click(screen.getByRole("button", { name: "Trang tiếp theo" }))
    expect(await screen.findByText("Trang 2/2")).toBeInTheDocument()
    expect(getCriterion("criterion-3")).toHaveAttribute("aria-current", "true")

    await user.click(screen.getByLabelText("Phương án đánh giá"))
    await user.click(await screen.findByRole("option", { name: "Nhà cung cấp B · Model B" }))

    expect(screen.getByText("Trang 2/2")).toBeInTheDocument()
    expect(getCriterion("criterion-3")).toHaveAttribute("aria-current", "true")
  })

  it("keeps sparse filtered navigation anchored to the canonical matrix page", async () => {
    const user = userEvent.setup()

    render(<TechnicalConfigurationEvaluationWorkspace dossier={dossier} />)

    await selectEvaluationFilter(user, "Không đạt")
    expect(getCriterion("criterion-2")).toHaveAttribute("aria-current", "true")

    await user.click(screen.getByRole("button", { name: "Trang tiếp theo" }))
    expect(await screen.findByText("Trang 2/2")).toBeInTheDocument()
    expect(getCriterion("criterion-3")).not.toHaveAttribute("aria-current", "true")

    await user.click(screen.getByLabelText("Phương án đánh giá"))
    await user.click(await screen.findByRole("option", { name: "Nhà cung cấp B · Model B" }))

    expect(screen.getByText("Trang 2/2")).toBeInTheDocument()
    expect(getCriterion("criterion-3")).not.toHaveAttribute("aria-current", "true")
  })

  it("keeps the focused supplier active after restoring all matrix columns", async () => {
    const user = userEvent.setup()

    render(<TechnicalConfigurationEvaluationWorkspace dossier={dossier} />)

    await user.click(screen.getByRole("button", { name: "Tùy chỉnh cột so sánh" }))
    await user.click(
      await screen.findByRole("button", {
        name: "Tập trung Nhà cung cấp B · Model B",
      })
    )
    await waitFor(() =>
      expect(screen.getByLabelText("Phương án đánh giá")).toHaveTextContent(
        "Nhà cung cấp B · Model B"
      )
    )

    await openCurrentCriterion(user)
    await user.type(screen.getByLabelText("Ghi chú"), "Giữ bản nháp của B")
    await user.click(screen.getByRole("button", { name: "Đóng chi tiết tiêu chí" }))
    await waitForEvaluationPanelToClose()

    await user.click(screen.getByRole("button", { name: "Thoát chế độ tập trung" }))

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Phương án đánh giá")).toHaveTextContent(
      "Nhà cung cấp B · Model B"
    )
    await openCurrentCriterion(user)
    expect(screen.getByLabelText("Ghi chú")).toHaveValue("Giữ bản nháp của B")
  })

  it("offers evaluation only for supplier columns currently displayed in the matrix", async () => {
    mocks.matrixVisibleOptionIds = ["option-1"]
    const user = userEvent.setup()

    render(<TechnicalConfigurationEvaluationWorkspace dossier={dossier} />)

    await user.click(screen.getByLabelText("Phương án đánh giá"))
    expect(
      screen.queryByRole("option", { name: "Nhà cung cấp B · Model B" })
    ).not.toBeInTheDocument()
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

    await selectEvaluationFilter(user, "Không đạt")
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

    expect(
      await screen.findByText("Không còn tiêu chí phù hợp với luồng đánh giá.")
    ).toBeInTheDocument()
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

    await selectEvaluationFilter(user, "Không đạt")
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

    await selectEvaluationFilter(user, "Không đạt")
    await user.click(getCriterion("criterion-1"))
    await user.type(screen.getByLabelText("Ghi chú"), "Giữ draft khi lỗi")
    mocks.loadEvaluationCriteria.mockClear()

    await user.click(screen.getByRole("button", { name: "Lưu & tiếp tục" }))

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
    expect(mocks.loadEvaluationCriteria).not.toHaveBeenCalled()
    expect(getEvaluationFilterButton("Không đạt")).toHaveAttribute("aria-pressed", "true")
    expect(getCriterion("criterion-1")).toHaveAttribute("aria-current", "true")
    expect(screen.getByLabelText("Ghi chú")).toHaveValue("Giữ draft khi lỗi")
    expect(
      screen.queryByText("Không còn tiêu chí phù hợp với luồng đánh giá.")
    ).not.toBeInTheDocument()
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

  it("keeps hierarchy on demand and closes the drawer only after guarded navigation commits", async () => {
    const user = userEvent.setup()

    render(<TechnicalConfigurationEvaluationWorkspace dossier={dossier} />)

    expect(
      screen.queryByRole("navigation", { name: "Danh sách tiêu chí đánh giá" })
    ).not.toBeInTheDocument()

    await openCurrentCriterion(user)
    await user.type(screen.getByLabelText("Ghi chú"), "Giữ bản nháp khi điều hướng drawer")
    await user.click(screen.getByRole("button", { name: "Đóng chi tiết tiêu chí" }))
    await waitForEvaluationPanelToClose()

    const trigger = screen.getByRole("button", { name: "Mục lục tiêu chí" })
    await user.click(trigger)

    const navigator = screen.getByRole("navigation", { name: "Danh sách tiêu chí đánh giá" })
    const drawerCriterion = within(navigator)
      .getAllByTestId("evaluation-criterion")
      .find((item) => item.getAttribute("data-criterion-id") === "criterion-2")
    expect(drawerCriterion).toBeDefined()

    await user.click(drawerCriterion!)
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Bỏ thay đổi chưa lưu?")
    expect(navigator).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Hủy" }))
    expect(
      screen.getByRole("navigation", { name: "Danh sách tiêu chí đánh giá" })
    ).toBeInTheDocument()

    await user.click(drawerCriterion!)
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Bỏ thay đổi" }))

    await waitFor(() =>
      expect(
        screen.queryByRole("navigation", { name: "Danh sách tiêu chí đánh giá" })
      ).not.toBeInTheDocument()
    )
    expect(await screen.findByText("Phản hồi TC-02")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Đóng chi tiết tiêu chí" }))
    await waitForEvaluationPanelToClose()
    await waitFor(() => expect(trigger).toHaveFocus())
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
    await waitForEvaluationPanelToClose()
    await user.click(getCriterion("criterion-2"))
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Bỏ thay đổi chưa lưu?")
    await user.click(screen.getByRole("button", { name: "Hủy" }))

    await user.click(getCriterion("criterion-1"))
    expect(screen.getByLabelText("Ghi chú")).toHaveValue("Không được mất")
    expect(getCriterion("criterion-1")).toHaveAttribute("data-criterion-id", "criterion-1")
    await user.click(screen.getByRole("button", { name: "Đóng chi tiết tiêu chí" }))
    await waitForEvaluationPanelToClose()

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
    expect(screen.queryByTestId("evaluation-progress-kpi-grid")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Thử lại" }))

    expect(mocks.refetchAssessment).toHaveBeenCalledTimes(1)
    expect(mocks.refetchComparisonSet).not.toHaveBeenCalled()
  })
})
