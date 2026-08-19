import "@testing-library/jest-dom"

import { QueryClient } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { TechnicalConfigurationBaselineDraftWire } from "../baseline-types"
import { useTechnicalConfigurationBaselineCrossDossierCopy } from "../_hooks/useTechnicalConfigurationBaselineCrossDossierCopy"
import { technicalConfigurationDossierDetailQueryKey } from "../technical-configuration-query-keys"
import type {
  TechnicalConfigurationDossierWire,
  TechnicalConfigurationDossierWireResponse,
} from "../types"
import { createReactQueryWrapper } from "@/test-utils/react-query"

const rpc = vi.hoisted(() => ({
  applyCopy: vi.fn(),
  listSources: vi.fn(),
  previewCopy: vi.fn(),
}))

vi.mock("../technical-configuration-baseline-cross-dossier-rpc", () => ({
  applyTechnicalConfigurationBaselineCrossDossierCopy: (...args: unknown[]) =>
    rpc.applyCopy(...args),
  listTechnicalConfigurationBaselineCrossDossierSources: (...args: unknown[]) =>
    rpc.listSources(...args),
  previewTechnicalConfigurationBaselineCrossDossierCopy: (...args: unknown[]) =>
    rpc.previewCopy(...args),
}))

const dossier: TechnicalConfigurationDossierWire = {
  id: "target-1",
  device_type_name: "Máy thở",
  name: "Hồ sơ đích",
  description: null,
  revision: 7,
  archived_at: null,
  archived_by: null,
  created_at: "2026-08-19T00:00:00.000Z",
  created_by: 1,
  updated_at: "2026-08-19T00:00:00.000Z",
  updated_by: 1,
}

const dossierRevision = dossier.revision + 1

const draft = {
  id: "draft-1",
  revision: 4,
  status: "draft",
} as TechnicalConfigurationBaselineDraftWire

const source = {
  baseline_version_id: "source-1",
  dossier_id: "source-dossier-1",
  device_type_name: "Máy thở",
  dossier_name: "Hồ sơ nguồn",
  dossier_archived_at: "2026-08-18T00:00:00.000Z",
  version_number: 3,
  locked_at: "2026-08-18T01:00:00.000Z",
  main_section_count: 2,
  subgroup_count: 4,
  criterion_count: 12,
}

function createPreview(mode: "create" | "replace") {
  return {
    data: {
      mode,
      requires_replacement_confirmation: mode === "replace",
      preview_fingerprint: "b".repeat(64),
      source,
      target: {
        dossier_id: dossier.id,
        dossier_revision: dossier.revision,
        baseline_version_id: mode === "replace" ? draft.id : null,
        baseline_revision: mode === "replace" ? draft.revision : null,
        version_number: mode === "replace" ? 2 : null,
      },
      copy_counts: {
        main_sections: 2,
        subgroups: 4,
        criteria: 12,
        reference_products: 1,
        reference_responses: 1,
        baseline_documents: 1,
        baseline_citations: 1,
        reference_documents: 1,
        reference_citations: 1,
      },
      delete_counts: {
        main_sections: 1,
        subgroups: 1,
        criteria: 2,
        reference_products: 0,
        reference_responses: 0,
        baseline_documents: 0,
        baseline_citations: 0,
        reference_documents: 0,
        reference_citations: 0,
        option_responses: 3,
        option_citations: 2,
        manual_assessments: 4,
      },
      preserved_counts: {
        suppliers: 2,
        options: 3,
        option_documents: 1,
        comparison_sets: 1,
      },
    },
  } as const
}

function createApplyResponse(mode: "create" | "replace", targetDossierRevision = 8) {
  return {
    data: {
      mode,
      target_dossier_id: dossier.id,
      target_dossier_revision: targetDossierRevision,
      target_baseline_version_id: mode === "replace" ? draft.id : "created-draft-1",
      target_baseline_revision: mode === "replace" ? 5 : 1,
      source_baseline_version_id: source.baseline_version_id,
      copied_counts: {},
      deleted_counts: {},
      preserved_counts: {},
    },
  } as const
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

describe("cross-dossier baseline copy workflow", () => {
  beforeEach(() => {
    Object.values(rpc).forEach((mock) => mock.mockReset())
    rpc.listSources.mockResolvedValue({
      data: [source],
      total: 1,
      page: 1,
      page_size: 20,
    })
  })

  it("lists locked sources and previews create mode with a paired-null target draft", async () => {
    rpc.previewCopy.mockResolvedValue(createPreview("create"))
    const queryClient = createQueryClient()
    const { result } = renderHook(
      () =>
        useTechnicalConfigurationBaselineCrossDossierCopy({
          dossier,
          dossierRevision,
          targetDraft: null,
          onApplied: vi.fn(),
        }),
      { wrapper: createReactQueryWrapper(queryClient) }
    )

    act(() => result.current.openDialog())
    await waitFor(() => expect(result.current.sources).toEqual([source]))
    await act(() => result.current.selectSource(source.baseline_version_id))

    expect(rpc.previewCopy).toHaveBeenCalledWith({
      p_source_baseline_version_id: source.baseline_version_id,
      p_target_dossier_id: dossier.id,
      p_expected_dossier_revision: dossierRevision,
      p_expected_target_baseline_version_id: null,
      p_expected_target_baseline_revision: null,
    })
    expect(result.current.preview?.mode).toBe("create")
  })

  it("loads additional bounded source pages without per-dossier version requests", async () => {
    const secondSource = {
      ...source,
      baseline_version_id: "source-2",
      dossier_id: "source-dossier-2",
      dossier_name: "Hồ sơ nguồn 2",
    }
    rpc.listSources.mockImplementation((args: { p_page: number }) =>
      Promise.resolve({
        data: args.p_page === 1 ? [source] : [secondSource],
        total: 2,
        page: args.p_page,
        page_size: 1,
      })
    )
    const queryClient = createQueryClient()
    const { result } = renderHook(
      () =>
        useTechnicalConfigurationBaselineCrossDossierCopy({
          dossier,
          dossierRevision,
          targetDraft: null,
          onApplied: vi.fn(),
        }),
      { wrapper: createReactQueryWrapper(queryClient) }
    )

    act(() => result.current.openDialog())
    await waitFor(() => expect(result.current.sources).toEqual([source]))
    await act(() => result.current.loadMoreSources())

    await waitFor(() => expect(result.current.sources).toEqual([source, secondSource]))
    expect(rpc.listSources).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        p_target_dossier_id: dossier.id,
        p_page: 2,
        p_page_size: 20,
      }),
      expect.any(AbortSignal)
    )
  })

  it("requires confirmation for replacement and applies the returned fingerprint", async () => {
    rpc.previewCopy.mockResolvedValue(createPreview("replace"))
    rpc.applyCopy.mockResolvedValue(createApplyResponse("replace"))
    const onApplied = vi.fn()
    const queryClient = createQueryClient()
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(
      () =>
        useTechnicalConfigurationBaselineCrossDossierCopy({
          dossier,
          dossierRevision,
          targetDraft: draft,
          onApplied,
        }),
      { wrapper: createReactQueryWrapper(queryClient) }
    )

    act(() => result.current.openDialog())
    await waitFor(() => expect(result.current.sources).toHaveLength(1))
    await act(() => result.current.selectSource(source.baseline_version_id))

    expect(result.current.canApply).toBe(false)
    act(() => result.current.setReplacementConfirmed(true))
    expect(result.current.canApply).toBe(true)
    await act(() => result.current.apply())

    expect(rpc.applyCopy).toHaveBeenCalledWith(
      expect.objectContaining({
        p_preview_fingerprint: "b".repeat(64),
        p_confirm_replace: true,
      })
    )
    expect(onApplied).toHaveBeenCalled()
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["technical-configurations"],
    })
  })

  it("forces a fresh preview after stale_preview while preserving the selected source", async () => {
    rpc.previewCopy
      .mockResolvedValueOnce(createPreview("replace"))
      .mockResolvedValueOnce(createPreview("replace"))
    rpc.applyCopy.mockRejectedValueOnce(
      Object.assign(new Error("stale_preview"), { code: "PT409" })
    )
    const queryClient = createQueryClient()
    const { result } = renderHook(
      () =>
        useTechnicalConfigurationBaselineCrossDossierCopy({
          dossier,
          dossierRevision,
          targetDraft: draft,
          onApplied: vi.fn(),
        }),
      { wrapper: createReactQueryWrapper(queryClient) }
    )

    act(() => result.current.openDialog())
    await waitFor(() => expect(result.current.sources).toHaveLength(1))
    await act(() => result.current.selectSource(source.baseline_version_id))
    act(() => result.current.setReplacementConfirmed(true))
    await act(() => result.current.apply())

    expect(rpc.previewCopy).toHaveBeenCalledTimes(2)
    expect(result.current.selectedSourceId).toBe(source.baseline_version_id)
    expect(result.current.operationError).toMatch(/bản xem trước mới/i)
    expect(result.current.replacementConfirmed).toBe(false)
  })

  it.each(["stale_revision", "target_draft_changed"])(
    "refreshes target state and rebuilds preview after %s",
    async (conflict) => {
      const refreshedDraft = { ...draft, revision: 5 }
      const refreshedPreview = {
        ...createPreview("replace"),
        data: {
          ...createPreview("replace").data,
          target: {
            ...createPreview("replace").data.target,
            dossier_revision: dossierRevision + 1,
            baseline_revision: refreshedDraft.revision,
          },
        },
      }
      rpc.previewCopy
        .mockResolvedValueOnce(createPreview("replace"))
        .mockResolvedValueOnce(refreshedPreview)
      rpc.applyCopy.mockRejectedValueOnce(Object.assign(new Error(conflict), { code: "PT409" }))
      const onTargetStateStale = vi.fn().mockResolvedValue({
        dossierRevision: dossierRevision + 1,
        targetDraft: refreshedDraft,
      })
      const queryClient = createQueryClient()
      const { result } = renderHook(
        () =>
          useTechnicalConfigurationBaselineCrossDossierCopy({
            dossier,
            dossierRevision,
            targetDraft: draft,
            onApplied: vi.fn(),
            onTargetStateStale,
          }),
        { wrapper: createReactQueryWrapper(queryClient) }
      )

      act(() => result.current.openDialog())
      await waitFor(() => expect(result.current.sources).toHaveLength(1))
      await act(() => result.current.selectSource(source.baseline_version_id))
      act(() => result.current.setReplacementConfirmed(true))
      await act(() => result.current.apply())

      expect(onTargetStateStale).toHaveBeenCalledTimes(1)
      expect(rpc.previewCopy).toHaveBeenCalledTimes(2)
      expect(rpc.previewCopy).toHaveBeenLastCalledWith({
        p_source_baseline_version_id: source.baseline_version_id,
        p_target_dossier_id: dossier.id,
        p_expected_dossier_revision: dossierRevision + 1,
        p_expected_target_baseline_version_id: refreshedDraft.id,
        p_expected_target_baseline_revision: refreshedDraft.revision,
      })
      expect(result.current.selectedSourceId).toBe(source.baseline_version_id)
      expect(result.current.preview).toEqual(refreshedPreview.data)
      expect(result.current.replacementConfirmed).toBe(false)
      expect(result.current.operationError).toMatch(/bản xem trước mới/i)
    }
  )

  it("ignores a rejected preview response that settles after the dialog closes", async () => {
    const pendingPreview = deferred<ReturnType<typeof createPreview>>()
    rpc.previewCopy.mockReturnValue(pendingPreview.promise)
    const queryClient = createQueryClient()
    const { result } = renderHook(
      () =>
        useTechnicalConfigurationBaselineCrossDossierCopy({
          dossier,
          dossierRevision,
          targetDraft: null,
          onApplied: vi.fn(),
        }),
      { wrapper: createReactQueryWrapper(queryClient) }
    )

    act(() => result.current.openDialog())
    await waitFor(() => expect(result.current.sources).toHaveLength(1))
    let selectPromise!: Promise<void>
    act(() => {
      selectPromise = result.current.selectSource(source.baseline_version_id)
    })
    act(() => result.current.closeDialog())
    pendingPreview.reject(new Error("late_preview_failed"))
    await act(() => selectPromise)

    expect(result.current.open).toBe(false)
    expect(result.current.operationError).toBeNull()
  })

  it("does not restart stale-target recovery after the dialog closes", async () => {
    const refreshedTargetState = deferred<{
      dossierRevision: number
      targetDraft: TechnicalConfigurationBaselineDraftWire | null
    }>()
    rpc.previewCopy
      .mockResolvedValueOnce(createPreview("replace"))
      .mockResolvedValueOnce(createPreview("replace"))
    rpc.applyCopy.mockRejectedValueOnce(
      Object.assign(new Error("stale_revision"), { code: "PT409" })
    )
    const onTargetStateStale = vi.fn().mockReturnValue(refreshedTargetState.promise)
    const queryClient = createQueryClient()
    const { result } = renderHook(
      () =>
        useTechnicalConfigurationBaselineCrossDossierCopy({
          dossier,
          dossierRevision,
          targetDraft: draft,
          onApplied: vi.fn(),
          onTargetStateStale,
        }),
      { wrapper: createReactQueryWrapper(queryClient) }
    )

    act(() => result.current.openDialog())
    await waitFor(() => expect(result.current.sources).toHaveLength(1))
    await act(() => result.current.selectSource(source.baseline_version_id))
    act(() => result.current.setReplacementConfirmed(true))
    let applyPromise!: Promise<void>
    act(() => {
      applyPromise = result.current.apply()
    })
    await waitFor(() => expect(onTargetStateStale).toHaveBeenCalledTimes(1))

    act(() => result.current.closeDialog())
    refreshedTargetState.resolve({
      dossierRevision: dossierRevision + 1,
      targetDraft: { ...draft, revision: draft.revision + 1 },
    })
    await act(() => applyPromise)

    expect(rpc.previewCopy).toHaveBeenCalledTimes(1)
    expect(result.current.open).toBe(false)
    expect(result.current.selectedSourceId).toBeNull()
    expect(result.current.preview).toBeNull()
    expect(result.current.operationError).toBeNull()
  })

  it("does not lower a newer dossier revision already present in the detail cache", async () => {
    rpc.previewCopy.mockResolvedValue(createPreview("create"))
    rpc.applyCopy.mockResolvedValue(createApplyResponse("create", 8))
    const queryClient = createQueryClient()
    queryClient.setQueryData<TechnicalConfigurationDossierWireResponse>(
      technicalConfigurationDossierDetailQueryKey(dossier.id),
      { data: { ...dossier, revision: 9 } }
    )
    const { result } = renderHook(
      () =>
        useTechnicalConfigurationBaselineCrossDossierCopy({
          dossier,
          dossierRevision,
          targetDraft: null,
          onApplied: vi.fn(),
        }),
      { wrapper: createReactQueryWrapper(queryClient) }
    )

    act(() => result.current.openDialog())
    await waitFor(() => expect(result.current.sources).toHaveLength(1))
    await act(() => result.current.selectSource(source.baseline_version_id))
    await act(() => result.current.apply())

    expect(
      queryClient.getQueryData<TechnicalConfigurationDossierWireResponse>(
        technicalConfigurationDossierDetailQueryKey(dossier.id)
      )?.data.revision
    ).toBe(9)
  })

  it("closes after server success even when the optional UI refresh fails", async () => {
    rpc.previewCopy.mockResolvedValue(createPreview("create"))
    const applyResponse = createApplyResponse("create")
    rpc.applyCopy.mockResolvedValue(applyResponse)
    const queryClient = createQueryClient()
    vi.spyOn(queryClient, "invalidateQueries").mockRejectedValueOnce(new Error("refresh_failed"))
    const onApplied = vi.fn().mockRejectedValue(new Error("editor_refresh_failed"))
    const { result } = renderHook(
      () =>
        useTechnicalConfigurationBaselineCrossDossierCopy({
          dossier,
          dossierRevision,
          targetDraft: null,
          onApplied,
        }),
      { wrapper: createReactQueryWrapper(queryClient) }
    )

    act(() => result.current.openDialog())
    await waitFor(() => expect(result.current.sources).toHaveLength(1))
    await act(() => result.current.selectSource(source.baseline_version_id))
    await act(() => result.current.apply())

    expect(rpc.applyCopy).toHaveBeenCalledTimes(1)
    expect(onApplied).toHaveBeenCalledWith(applyResponse.data)
    expect(result.current.open).toBe(false)
    expect(result.current.preview).toBeNull()
  })

  it("resets selection and preview when the user cancels", async () => {
    rpc.previewCopy.mockResolvedValue(createPreview("create"))
    const queryClient = createQueryClient()
    const { result } = renderHook(
      () =>
        useTechnicalConfigurationBaselineCrossDossierCopy({
          dossier,
          dossierRevision,
          targetDraft: null,
          onApplied: vi.fn(),
        }),
      { wrapper: createReactQueryWrapper(queryClient) }
    )

    act(() => result.current.openDialog())
    await waitFor(() => expect(result.current.sources).toHaveLength(1))
    await act(() => result.current.selectSource(source.baseline_version_id))
    act(() => result.current.closeDialog())

    expect(result.current.open).toBe(false)
    expect(result.current.selectedSourceId).toBeNull()
    expect(result.current.preview).toBeNull()
  })

  it("ignores a preview response that resolves after the dialog closes", async () => {
    const pendingPreview = deferred<ReturnType<typeof createPreview>>()
    rpc.previewCopy.mockReturnValue(pendingPreview.promise)
    const queryClient = createQueryClient()
    const { result } = renderHook(
      () =>
        useTechnicalConfigurationBaselineCrossDossierCopy({
          dossier,
          dossierRevision,
          targetDraft: null,
          onApplied: vi.fn(),
        }),
      { wrapper: createReactQueryWrapper(queryClient) }
    )

    act(() => result.current.openDialog())
    await waitFor(() => expect(result.current.sources).toHaveLength(1))
    let selectPromise!: Promise<void>
    act(() => {
      selectPromise = result.current.selectSource(source.baseline_version_id)
    })
    act(() => result.current.closeDialog())
    pendingPreview.resolve(createPreview("create"))
    await act(() => selectPromise)

    expect(result.current.open).toBe(false)
    expect(result.current.selectedSourceId).toBeNull()
    expect(result.current.preview).toBeNull()
  })
})
