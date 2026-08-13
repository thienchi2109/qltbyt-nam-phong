import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useTechnicalConfigurationResultExport } from "../_hooks/useTechnicalConfigurationResultExport"
import type { TechnicalConfigurationResultExportDialogRequest } from "../technical-configuration-result-export-state"
import { createBaselineGroups } from "./technical-configuration-evaluation-workspace.test-support"

const mocks = vi.hoisted(() => ({
  collectDataset: vi.fn(),
  createModel: vi.fn(),
  downloadBlob: vi.fn(),
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

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe("useTechnicalConfigurationResultExport identity", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("invalidates stale work and retry when only the baseline revision changes", async () => {
    const deferred = createDeferred<null>()
    let signal: AbortSignal | undefined
    mocks.collectDataset.mockImplementation(
      (
        exportRequest: TechnicalConfigurationResultExportDialogRequest & { signal?: AbortSignal }
      ) => {
        signal = exportRequest.signal
        return deferred.promise
      }
    )
    const baselineRevision = 3
    const request: TechnicalConfigurationResultExportDialogRequest = {
      mode: "full",
      dossierId: "dossier-1",
      baselineVersionId: "baseline-1",
      optionIds: ["option-2"],
      criterionIds: ["criterion-3"],
    }
    const { result, rerender } = renderHook(
      ({ revision }) =>
        useTechnicalConfigurationResultExport({
          dossierId: "dossier-1",
          baselineVersionId: "baseline-1",
          baselineRevision: revision,
          baselineGroups: createBaselineGroups(),
          generatedBy: "Nguyễn Văn A",
        }),
      { initialProps: { revision: baselineRevision } }
    )

    let exportPromise: Promise<void> | undefined
    act(() => {
      exportPromise = result.current.startExport(request)
    })
    rerender({ revision: baselineRevision + 1 })

    expect(signal?.aborted).toBe(true)
    expect(result.current.status).toBe("idle")
    await act(async () => {
      await result.current.retry()
    })
    expect(mocks.collectDataset).toHaveBeenCalledTimes(1)

    deferred.resolve(null)
    await act(async () => {
      await exportPromise
    })
    expect(mocks.createModel).not.toHaveBeenCalled()
    expect(mocks.serializeWorkbook).not.toHaveBeenCalled()
    expect(mocks.downloadBlob).not.toHaveBeenCalled()
  })
})
