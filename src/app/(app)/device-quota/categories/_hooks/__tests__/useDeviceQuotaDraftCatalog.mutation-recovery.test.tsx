import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { callRpc } from "@/lib/rpc-client"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"
import { useDeviceQuotaDraftCatalog } from "../useDeviceQuotaDraftCatalog"

const mockUseSession = vi.fn()

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}))
vi.mock("@/contexts/TenantSelectionContext", () => ({
  useTenantSelection: () => ({ selectedFacilityId: 99, showSelector: true }),
}))
vi.mock("@/lib/rpc-client", () => ({
  callRpc: vi.fn(),
}))

const mockCallRpc = vi.mocked(callRpc)
const catalog = {
  document: {},
  catalog_version: { artifact_id: "artifact-1" },
  completeness: {},
  rows: [
    {
      id: "item-1",
      tt: "1",
      type: "item",
      level: 0,
      parent: null,
      name: "Item 1",
      unit: "regulatory-unit",
      quota: ["1"],
      source_pages: [1],
      source_ref: "ref-1",
    },
  ],
  footnotes: [],
}
const draft = {
  draft: {
    id: "draft-1",
    don_vi: 7,
    catalog_version_id: "catalog-1",
    status: "draft",
    revision: 3,
    created_by: 1,
    updated_by: 1,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  },
  items: [
    {
      id: "draft-item-1",
      regulatory_item_id: "regulatory-1",
      display_name_override: "",
      applied_unit: "unit",
      applied_quantity: 2,
      notes: null,
      is_excluded: false,
      display_order: 1,
      source_identifier: "item-1",
      source_label: "1",
      regulatory_name: "Item 1",
      regulatory_unit: "regulatory-unit",
      regulatory_quota_lines: ["1"],
      regulatory_rules: [],
    },
  ],
}

function rpcSequence() {
  mockCallRpc
    .mockResolvedValueOnce({ data: draft })
    .mockResolvedValueOnce({ data: draft })
    .mockResolvedValueOnce(catalog)
}

describe("useDeviceQuotaDraftCatalog mutation recovery", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockUseSession.mockReturnValue({
      status: "authenticated",
      data: {
        user: {
          id: "user-1",
          role: "to_qltb",
          don_vi: 7,
          current_don_vi: 7,
        },
      },
    })
  })

  it("locks staged edits and item mutations while save is pending", async () => {
    rpcSequence()
    let resolveSave: (value: unknown) => void = () => undefined
    mockCallRpc.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve
      })
    )
    const rendered = renderHook(() => useDeviceQuotaDraftCatalog(), {
      wrapper: createReactQueryWrapper(createTestQueryClient()),
    })
    await waitFor(() => expect(rendered.result.current.status).toBe("ready"))

    act(() => rendered.result.current.updateItem("item-1", { appliedQuantity: 5 }))
    const savePromise = rendered.result.current.save()
    await waitFor(() => expect(rendered.result.current.isSaving).toBe(true))
    act(() => rendered.result.current.updateItem("item-1", { appliedQuantity: 8 }))
    await act(async () => {
      await rendered.result.current.exclude("item-1")
    })

    expect(rendered.result.current.rows[0]?.appliedQuantity).toBe(5)
    expect(mockCallRpc).toHaveBeenCalledTimes(4)

    resolveSave({
      data: {
        ...draft,
        draft: { ...draft.draft, revision: 4 },
        items: [{ ...draft.items[0], applied_quantity: 5 }],
      },
    })
    await expect(savePromise).resolves.toBeDefined()
  })

  it("locks staged edits and save while an item mutation is pending", async () => {
    rpcSequence()
    let resolveExclude: (value: unknown) => void = () => undefined
    mockCallRpc.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveExclude = resolve
      })
    )
    const rendered = renderHook(() => useDeviceQuotaDraftCatalog(), {
      wrapper: createReactQueryWrapper(createTestQueryClient()),
    })
    await waitFor(() => expect(rendered.result.current.status).toBe("ready"))

    const excludePromise = rendered.result.current.exclude("item-1")
    await waitFor(() => expect(rendered.result.current.isExcluding).toBe(true))
    act(() => rendered.result.current.updateItem("item-1", { appliedQuantity: 8 }))
    await act(async () => {
      await rendered.result.current.save()
    })

    expect(rendered.result.current.rows[0]?.appliedQuantity).toBe(2)
    expect(mockCallRpc).toHaveBeenCalledTimes(4)

    resolveExclude({
      data: {
        ...draft,
        draft: { ...draft.draft, revision: 4 },
        items: [{ ...draft.items[0], is_excluded: true }],
      },
    })
    await expect(excludePromise).resolves.toBeDefined()
  })

  it("reloads the latest draft snapshot instead of replaying a stale save on retry", async () => {
    rpcSequence()
    mockCallRpc.mockRejectedValueOnce(new Error("stale_revision")).mockResolvedValueOnce({
      data: {
        ...draft,
        draft: { ...draft.draft, revision: 4 },
        items: [{ ...draft.items[0], applied_quantity: 9 }],
      },
    })
    const rendered = renderHook(() => useDeviceQuotaDraftCatalog(), {
      wrapper: createReactQueryWrapper(createTestQueryClient()),
    })
    await waitFor(() => expect(rendered.result.current.status).toBe("ready"))
    act(() => rendered.result.current.updateItem("item-1", { appliedQuantity: 8 }))

    await expect(
      act(async () => {
        await rendered.result.current.save()
      })
    ).rejects.toThrow()
    await waitFor(() => expect(rendered.result.current.status).toBe("conflict"))
    await act(async () => {
      await rendered.result.current.retry()
    })

    await waitFor(() => expect(rendered.result.current.revision).toBe(4))
    expect(rendered.result.current.rows[0]?.appliedQuantity).toBe(9)
    expect(rendered.result.current.isDirty).toBe(false)
    expect(mockCallRpc).toHaveBeenCalledTimes(5)
    expect(mockCallRpc).not.toHaveBeenLastCalledWith(
      expect.objectContaining({ fn: "device_quota_unit_catalog_draft_save" })
    )
  })

  it("locks editor writes while conflict recovery is refetching", async () => {
    rpcSequence()
    mockCallRpc.mockRejectedValueOnce(new Error("stale_revision"))
    let resolveReload: (value: unknown) => void = () => undefined
    mockCallRpc.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveReload = resolve
      })
    )
    const rendered = renderHook(() => useDeviceQuotaDraftCatalog(), {
      wrapper: createReactQueryWrapper(createTestQueryClient()),
    })
    await waitFor(() => expect(rendered.result.current.status).toBe("ready"))
    act(() => rendered.result.current.updateItem("item-1", { appliedQuantity: 8 }))
    await expect(
      act(async () => {
        await rendered.result.current.save()
      })
    ).rejects.toThrow()
    await waitFor(() => expect(rendered.result.current.status).toBe("conflict"))

    let retryPromise = Promise.resolve()
    act(() => {
      retryPromise = rendered.result.current.retry()
    })
    await waitFor(() => expect(rendered.result.current.isRecovering).toBe(true))
    act(() => rendered.result.current.updateItem("item-1", { appliedQuantity: 10 }))
    await act(async () => {
      await rendered.result.current.exclude("item-1")
    })

    expect(rendered.result.current.rows[0]?.appliedQuantity).toBe(8)
    expect(mockCallRpc).toHaveBeenCalledTimes(5)

    await act(async () => {
      resolveReload({
        data: {
          ...draft,
          draft: { ...draft.draft, revision: 4 },
          items: [{ ...draft.items[0], applied_quantity: 9 }],
        },
      })
      await retryPromise
    })
    expect(rendered.result.current.isRecovering).toBe(false)
    expect(rendered.result.current.rows[0]?.appliedQuantity).toBe(9)
  })

  it("keeps conflict and local edits when conflict recovery refetch fails", async () => {
    rpcSequence()
    mockCallRpc.mockRejectedValueOnce(new Error("stale_revision"))
    mockCallRpc.mockRejectedValueOnce(new Error("reload failed"))
    const rendered = renderHook(() => useDeviceQuotaDraftCatalog(), {
      wrapper: createReactQueryWrapper(createTestQueryClient()),
    })
    await waitFor(() => expect(rendered.result.current.status).toBe("ready"))
    act(() => rendered.result.current.updateItem("item-1", { appliedQuantity: 8 }))
    await expect(
      act(async () => {
        await rendered.result.current.save()
      })
    ).rejects.toThrow()
    await waitFor(() => expect(rendered.result.current.status).toBe("conflict"))

    await act(async () => {
      await rendered.result.current.retry()
    })

    expect(rendered.result.current.status).toBe("conflict")
    expect(rendered.result.current.rows[0]?.appliedQuantity).toBe(8)
    expect(rendered.result.current.isDirty).toBe(true)
    expect(rendered.result.current.isRecovering).toBe(false)
  })
})
