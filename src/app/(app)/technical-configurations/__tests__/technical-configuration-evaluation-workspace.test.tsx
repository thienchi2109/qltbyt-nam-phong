import * as React from "react"
import "@testing-library/jest-dom"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationEvaluationWorkspace } from "../_components/evaluation/TechnicalConfigurationEvaluationWorkspace"
import {
  createComparisonResult,
  createDraft,
  createOption,
  dossier,
  getCriterion,
  openCurrentCriterion,
} from "./technical-configuration-evaluation-workspace.test-support"

const mocks = vi.hoisted(() => ({
  assessmentQueryError: null as Error | null,
  comparisonSetQueryError: null as Error | null,
  discard: vi.fn(),
  refetchAssessment: vi.fn(),
  refetchComparisonSet: vi.fn(),
  save: vi.fn(),
  synchronizeVersion: vi.fn(),
}))

vi.mock("../_hooks/useTechnicalConfigurationBaselineVersionSelection", () => ({
  useTechnicalConfigurationBaselineVersionSelection: () => ({
    selectedVersion: {
      id: "baseline-1",
      dossier_id: "dossier-1",
      version_number: 2,
      status: "locked",
      revision: 4,
      groups: [],
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
        assessmentsByCriterionId: {},
        assessmentQuery: {
          isLoading: false,
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
    mocks.assessmentQueryError = null
    mocks.comparisonSetQueryError = null
    mocks.save.mockResolvedValue({})
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
    await user.click(screen.getByRole("button", { name: "Thử lại" }))

    expect(mocks.refetchAssessment).toHaveBeenCalledTimes(1)
    expect(mocks.refetchComparisonSet).not.toHaveBeenCalled()
  })
})
