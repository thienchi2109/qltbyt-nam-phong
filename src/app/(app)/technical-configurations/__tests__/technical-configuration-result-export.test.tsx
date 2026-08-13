import "@testing-library/jest-dom"
import { act, render, renderHook, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationResultExportControl } from "../_components/evaluation/TechnicalConfigurationResultExportControl"
import { useTechnicalConfigurationResultExport } from "../_hooks/useTechnicalConfigurationResultExport"
import { TechnicalConfigurationResultExportError } from "../technical-configuration-result-export-decoders"
import type { TechnicalConfigurationResultExportDialogRequest } from "../technical-configuration-result-export-state"
import type { TechnicalConfigurationResultExportDataset } from "../technical-configuration-result-export-types"
import {
  createBaselineGroups,
  createOption,
} from "./technical-configuration-evaluation-workspace.test-support"

const mocks = vi.hoisted(() => ({
  collectDataset: vi.fn(),
  createModel: vi.fn(),
  downloadBlob: vi.fn(),
  session: {
    user: {
      id: "user-1",
      username: "admin" as string | null,
      full_name: "Nguyễn Văn A" as string | null,
      name: null as string | null,
      role: "admin",
    },
  },
  serializeWorkbook: vi.fn(),
}))

vi.mock("../technical-configuration-result-export-data", () => ({
  collectTechnicalConfigurationResultExportDataset: mocks.collectDataset,
}))

vi.mock("@/lib/technical-configuration-result-excel-contract", () => ({
  createTechnicalConfigurationResultWorkbookModel: mocks.createModel,
}))

vi.mock("@/lib/technical-configuration-result-excel-export", () => ({
  serializeTechnicalConfigurationResultWorkbook: mocks.serializeWorkbook,
}))

vi.mock("@/lib/excel-workbook", () => ({
  downloadBlob: mocks.downloadBlob,
}))

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: mocks.session,
    status: "authenticated",
  }),
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

function createDataset(
  deviceTypeName = "Máy siêu âm / Doppler"
): TechnicalConfigurationResultExportDataset {
  const optionIdentity = {
    option_id: "option-2",
    supplier_id: "supplier-2",
    supplier_name: "Nhà cung cấp A",
    display_label: "Nhà cung cấp A · Model A",
  } as const
  const optionAxisItem = {
    ...optionIdentity,
    model: "Model A",
    manufacturer: "Hãng A",
    option_name: "Máy siêu âm",
  } as const
  const criterionAxisItem = {
    group_id: "group-1",
    group_name: "Nhóm tiêu chí 1",
    group_order: 1,
    criterion_id: "criterion-3",
    criterion_code: "TC-003",
    criterion_title: "Tiêu chí 3",
    requirement_text: "Yêu cầu cấu hình 3",
    criterion_order: 3,
  } as const

  return {
    mode: "full",
    manifest: {
      dossier: {
        id: "dossier-1",
        device_type_name: deviceTypeName,
        name: "Hồ sơ siêu âm",
        revision: 5,
        archived_at: null,
      },
      baseline_version: {
        id: "baseline-1",
        dossier_id: "dossier-1",
        version_number: 2,
        status: "locked",
        revision: 3,
        locked_at: "2026-08-01T08:00:00.000Z",
      },
      option_total: 1,
      criterion_total: 1,
      snapshot_token: "snapshot-1",
      ranking_snapshot_token: "ranking-snapshot-1",
    },
    optionAxis: [optionAxisItem],
    criterionAxis: [criterionAxisItem],
    ranking: [
      {
        ...optionIdentity,
        eligibility: "eligible",
        incomplete_criterion_count: 0,
        failed_count: 0,
        insufficient_evidence_count: 0,
        exceeds_count: 1,
        rank: 1,
      },
    ],
    hierarchyRows: [{ kind: "criterion", criterion: criterionAxisItem }],
    matrix: [
      {
        ...criterionAxisItem,
        ...optionAxisItem,
        response_text: "Đáp ứng",
        supplementary_information: null,
        document_links: [],
        technical_axis: "meets",
        evidence_axis: "complete",
        assessment_notes: null,
        conclusion: "meets",
      },
    ],
  }
}

const baselineGroups = createBaselineGroups()
const baselineRevision = 3
const request: TechnicalConfigurationResultExportDialogRequest = {
  mode: "full",
  dossierId: "dossier-1",
  baselineVersionId: "baseline-1",
  optionIds: ["option-2"],
  criterionIds: ["criterion-3"],
}

describe("useTechnicalConfigurationResultExport", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createModel.mockReturnValue({
      template_kind: "technical_configuration_result",
      template_version: 1,
      sheets: [],
    })
    mocks.serializeWorkbook.mockResolvedValue(new Uint8Array([1, 2, 3]).buffer)
  })

  it("uses an internally complete dataset for the successful export path", () => {
    const dataset = createDataset()

    expect(dataset.optionAxis.map((option) => option.option_id)).toEqual(["option-2"])
    expect(dataset.criterionAxis.map((criterion) => criterion.criterion_id)).toEqual([
      "criterion-3",
    ])
    expect(dataset.ranking.map((row) => row.option_id)).toEqual(["option-2"])
    expect(dataset.matrix.map((cell) => [cell.option_id, cell.criterion_id])).toEqual([
      ["option-2", "criterion-3"],
    ])
  })

  it("does no work on mount, then serializes and downloads one complete stable dataset", async () => {
    const deferred = createDeferred<TechnicalConfigurationResultExportDataset>()
    mocks.collectDataset.mockReturnValue(deferred.promise)
    const { result } = renderHook(() =>
      useTechnicalConfigurationResultExport({
        dossierId: "dossier-1",
        baselineVersionId: "baseline-1",
        baselineRevision,
        baselineGroups,
        generatedBy: "Nguyễn Văn A",
      })
    )

    expect(mocks.collectDataset).not.toHaveBeenCalled()

    let exportPromise: Promise<void> | undefined
    act(() => {
      exportPromise = result.current.startExport(request)
    })
    expect(result.current.status).toBe("loading")

    deferred.resolve(createDataset())
    await act(async () => {
      await exportPromise
    })

    expect(mocks.collectDataset).toHaveBeenCalledWith(
      {
        ...request,
        signal: expect.any(AbortSignal),
      },
      { baselineRevision, baselineGroups }
    )
    expect(mocks.createModel).toHaveBeenCalledWith({
      ...createDataset(),
      option_ids: ["option-2"],
      criterion_ids: ["criterion-3"],
      generated_at: expect.any(String),
      generated_by: "Nguyễn Văn A",
    })
    expect(mocks.serializeWorkbook).toHaveBeenCalledTimes(1)
    expect(mocks.downloadBlob).toHaveBeenCalledTimes(1)
    const generatedAt = mocks.createModel.mock.calls[0]?.[0]?.generated_at
    expect(mocks.downloadBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      `Ket_qua_so_sanh_cau_hinh_May_sieu_am_Doppler_${generatedAt.slice(0, 10)}.xlsx`
    )
    expect(result.current.status).toBe("success")
  })

  it("keeps the filesystem-safe filename within the common 255-byte limit", async () => {
    mocks.collectDataset.mockResolvedValue(createDataset("Thiết bị siêu âm ".repeat(80)))
    const { result } = renderHook(() =>
      useTechnicalConfigurationResultExport({
        dossierId: "dossier-1",
        baselineVersionId: "baseline-1",
        baselineRevision,
        baselineGroups,
        generatedBy: "Nguyễn Văn A",
      })
    )

    await act(async () => {
      await result.current.startExport(request)
    })

    const filename = mocks.downloadBlob.mock.calls[0]?.[1]
    expect(filename).toMatch(
      /^Ket_qua_so_sanh_cau_hinh_Thiet_bi_sieu_am_[A-Za-z0-9_]+_\d{4}-\d{2}-\d{2}\.xlsx$/
    )
    expect(new TextEncoder().encode(filename).byteLength).toBeLessThanOrEqual(255)
  })

  it("keeps a typed failure retryable and reuses the exact confirmed request", async () => {
    mocks.collectDataset
      .mockRejectedValueOnce(
        new TechnicalConfigurationResultExportError("transport", "Result export RPC failed.")
      )
      .mockResolvedValueOnce(createDataset())
    const { result } = renderHook(() =>
      useTechnicalConfigurationResultExport({
        dossierId: "dossier-1",
        baselineVersionId: "baseline-1",
        baselineRevision,
        baselineGroups,
        generatedBy: "Nguyễn Văn A",
      })
    )

    await act(async () => {
      await result.current.startExport(request)
    })

    expect(result.current.status).toBe("error")
    expect(result.current.error?.kind).toBe("transport")

    await act(async () => {
      await result.current.retry()
    })

    expect(mocks.collectDataset).toHaveBeenNthCalledWith(
      2,
      {
        ...request,
        signal: expect.any(AbortSignal),
      },
      { baselineRevision, baselineGroups }
    )
    expect(mocks.downloadBlob).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe("success")
  })

  it("never serializes or downloads when final manifest revalidation reports a change", async () => {
    mocks.collectDataset.mockRejectedValue(
      new TechnicalConfigurationResultExportError(
        "snapshot_changed",
        "Result export snapshot changed."
      )
    )
    const { result } = renderHook(() =>
      useTechnicalConfigurationResultExport({
        dossierId: "dossier-1",
        baselineVersionId: "baseline-1",
        baselineRevision,
        baselineGroups,
        generatedBy: "Nguyễn Văn A",
      })
    )

    await act(async () => {
      await result.current.startExport(request)
    })

    expect(result.current.error?.kind).toBe("snapshot_changed")
    expect(mocks.createModel).not.toHaveBeenCalled()
    expect(mocks.serializeWorkbook).not.toHaveBeenCalled()
    expect(mocks.downloadBlob).not.toHaveBeenCalled()
  })

  it("aborts and ignores obsolete work after dossier or baseline identity changes", async () => {
    const deferred = createDeferred<TechnicalConfigurationResultExportDataset>()
    let signal: AbortSignal | undefined
    mocks.collectDataset.mockImplementation(
      (
        exportRequest: TechnicalConfigurationResultExportDialogRequest & { signal?: AbortSignal }
      ) => {
        signal = exportRequest.signal
        return deferred.promise
      }
    )
    const { result, rerender } = renderHook(
      ({ dossierId, baselineVersionId }) =>
        useTechnicalConfigurationResultExport({
          dossierId,
          baselineVersionId,
          baselineRevision,
          baselineGroups,
          generatedBy: "Nguyễn Văn A",
        }),
      {
        initialProps: {
          dossierId: "dossier-1",
          baselineVersionId: "baseline-1",
        },
      }
    )

    let exportPromise: Promise<void> | undefined
    act(() => {
      exportPromise = result.current.startExport(request)
    })
    rerender({ dossierId: "dossier-2", baselineVersionId: "baseline-2" })

    expect(signal?.aborted).toBe(true)
    expect(result.current.status).toBe("idle")

    deferred.resolve(createDataset())
    await act(async () => {
      await exportPromise
    })
    await waitFor(() => expect(mocks.downloadBlob).not.toHaveBeenCalled())
    expect(mocks.createModel).not.toHaveBeenCalled()
    expect(mocks.serializeWorkbook).not.toHaveBeenCalled()
  })
})

describe("TechnicalConfigurationResultExportControl", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.session.user.username = "admin"
    mocks.session.user.full_name = "Nguyễn Văn A"
    mocks.session.user.name = null
    mocks.createModel.mockReturnValue({
      template_kind: "technical_configuration_result",
      template_version: 1,
      sheets: [],
    })
    mocks.serializeWorkbook.mockResolvedValue(new Uint8Array([1, 2, 3]).buffer)
  })

  function renderControl() {
    return render(
      <TechnicalConfigurationResultExportControl
        dossierId="dossier-1"
        baselineVersionId="baseline-1"
        baselineRevision={baselineRevision}
        options={[createOption("option-1", "Nhà cung cấp A · Model A")]}
        baselineGroups={baselineGroups}
        activeOptionId="option-1"
        currentCriteria={[{ criterion: { id: "criterion-1" } }]}
      />
    )
  }

  it("falls back safely when every session display-name field is null", async () => {
    const user = userEvent.setup()
    mocks.session.user.username = null
    mocks.session.user.full_name = null
    mocks.session.user.name = null
    mocks.collectDataset.mockResolvedValue(createDataset())
    renderControl()

    await user.click(screen.getByRole("button", { name: "Xuất kết quả Excel" }))
    await user.click(screen.getByRole("button", { name: "Xuất file .xlsx" }))

    await waitFor(() => expect(mocks.createModel).toHaveBeenCalledTimes(1))
    expect(mocks.createModel.mock.calls[0]?.[0]?.generated_by).toBe("Không xác định")
  })

  it("does not collect data on mount or dialog cancellation", async () => {
    const user = userEvent.setup()
    renderControl()

    expect(mocks.collectDataset).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Xuất kết quả Excel" }))
    await user.click(screen.getByRole("button", { name: "Hủy" }))

    expect(mocks.collectDataset).not.toHaveBeenCalled()
  })

  it("shows loading and a typed error before an explicit successful retry", async () => {
    const user = userEvent.setup()
    const deferred = createDeferred<TechnicalConfigurationResultExportDataset>()
    mocks.collectDataset
      .mockReturnValueOnce(deferred.promise)
      .mockResolvedValueOnce(createDataset())
    renderControl()

    await user.click(screen.getByRole("button", { name: "Xuất kết quả Excel" }))
    await user.click(screen.getByRole("button", { name: "Xuất file .xlsx" }))

    const loadingTrigger = screen.getByRole("button", { name: "Đang xuất kết quả..." })
    expect(loadingTrigger).toHaveFocus()
    expect(loadingTrigger).not.toBeDisabled()
    expect(loadingTrigger).toHaveAttribute("aria-disabled", "true")
    expect(screen.getByRole("status")).toHaveTextContent("Đang tạo tệp Excel")

    await act(async () => {
      deferred.reject(
        new TechnicalConfigurationResultExportError("transport", "Result export RPC failed.")
      )
    })

    expect(await screen.findByText("Không thể tải dữ liệu xuất")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Thử lại" }))

    await waitFor(() => expect(mocks.downloadBlob).toHaveBeenCalledTimes(1))
    expect(screen.getByRole("status")).toHaveTextContent("Đã tải tệp Excel")
  })
})
