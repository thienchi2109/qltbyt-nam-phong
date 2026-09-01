import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { callRpc } from "@/lib/rpc-client"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"
import { useDeviceQuotaDraftCatalog } from "../useDeviceQuotaDraftCatalog"

const mockUseSession = vi.fn()
const mockUseTenantSelection = vi.fn()

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}))

vi.mock("@/contexts/TenantSelectionContext", () => ({
  useTenantSelection: () => mockUseTenantSelection(),
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

function setup(role: string, donVi: number | null = 7) {
  mockUseSession.mockReturnValue({
    status: "authenticated",
    data: {
      user: {
        id: "user-1",
        role,
        don_vi: donVi,
        current_don_vi: donVi,
      },
    },
  })
  mockUseTenantSelection.mockReturnValue({
    selectedFacilityId: 99,
    showSelector: true,
  })
}

function rpcSequence() {
  mockCallRpc
    .mockResolvedValueOnce({ data: draft })
    .mockResolvedValueOnce({ data: draft })
    .mockResolvedValueOnce(catalog)
}

describe("useDeviceQuotaDraftCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each(["global", "admin", "to_qltb"])(
    "opens the session-scoped draft and catalog for supported role %s",
    async (role) => {
      setup(role)
      rpcSequence()

      const queryClient = createTestQueryClient()
      const rendered = renderHook(() => useDeviceQuotaDraftCatalog(), {
        wrapper: createReactQueryWrapper(queryClient),
      })

      await waitFor(() => expect(rendered.result.current.status).toBe("ready"))

      expect(mockCallRpc).toHaveBeenNthCalledWith(1, {
        fn: "device_quota_unit_catalog_draft_create_or_open",
        args: {},
      })
      expect(mockCallRpc).toHaveBeenCalledWith({
        fn: "device_quota_unit_catalog_draft_get",
        args: { p_draft_id: "draft-1" },
      })
      expect(mockCallRpc).toHaveBeenCalledWith({
        fn: "device_quota_regulatory_catalog_get",
        args: {},
      })
      expect(rendered.result.current.rows[0]).toMatchObject({
        sourceIdentifier: "item-1",
        appliedQuantity: 2,
      })
      expect(
        queryClient.getQueryCache().find({
          queryKey: ["device-quota-regulatory-catalog", 7, "user-1", "catalog-1"],
        })
      ).toBeDefined()
    }
  )

  it("uses the authenticated session unit and ignores the selected facility", async () => {
    setup("to_qltb", 7)
    rpcSequence()

    const rendered = renderHook(() => useDeviceQuotaDraftCatalog(), {
      wrapper: createReactQueryWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(rendered.result.current.status).toBe("ready"))

    expect(rendered.result.current.donViId).toBe(7)
    expect(JSON.stringify(mockCallRpc.mock.calls)).not.toContain("99")
  })

  it("fails closed for missing unit and unsupported roles without calling an RPC", async () => {
    for (const [role, donVi] of [
      ["to_qltb", null],
      ["regional_leader", 7],
      ["mapping-only", 7],
    ] as const) {
      vi.clearAllMocks()
      setup(role, donVi)

      const rendered = renderHook(() => useDeviceQuotaDraftCatalog(), {
        wrapper: createReactQueryWrapper(createTestQueryClient()),
      })

      await waitFor(() => expect(rendered.result.current.status).toBe("blocked"))
      expect(mockCallRpc).not.toHaveBeenCalled()
    }
  })

  it("saves staged edits with the captured revision and invalidates derived queries", async () => {
    setup("to_qltb")
    rpcSequence()
    mockCallRpc.mockResolvedValueOnce({
      data: {
        ...draft,
        draft: { ...draft.draft, revision: 4 },
        items: [{ ...draft.items[0], applied_quantity: 5 }],
      },
    })

    const queryClient = createTestQueryClient()
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries")
    const rendered = renderHook(() => useDeviceQuotaDraftCatalog(), {
      wrapper: createReactQueryWrapper(queryClient),
    })
    await waitFor(() => expect(rendered.result.current.status).toBe("ready"))

    act(() => {
      rendered.result.current.updateItem("item-1", { appliedQuantity: 5 })
    })
    await act(async () => {
      await rendered.result.current.save()
    })

    expect(mockCallRpc).toHaveBeenCalledWith({
      fn: "device_quota_unit_catalog_draft_save",
      args: {
        p_draft_id: "draft-1",
        p_expected_revision: 3,
        p_items: [
          expect.objectContaining({
            regulatory_item_id: "regulatory-1",
            applied_quantity: 5,
          }),
        ],
      },
    })
    expect(rendered.result.current.revision).toBe(4)
    expect(invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: expect.arrayContaining(["device-quota-draft"]) })
    )
    expect(invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(["device-quota-regulatory-catalog"]),
      })
    )
  })

  it("reports stale conflict without replacing the locally staged value", async () => {
    setup("to_qltb")
    rpcSequence()
    mockCallRpc.mockRejectedValueOnce(new Error("stale_revision"))

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
    expect(rendered.result.current.rows[0]?.appliedQuantity).toBe(8)
    expect(rendered.result.current.errorMessage).toMatch(/thay đổi|tải lại/i)
  })

  it("keeps the previous row state when exclude fails and exposes retry", async () => {
    setup("to_qltb")
    rpcSequence()
    mockCallRpc.mockRejectedValueOnce(new Error("exclude denied"))

    const rendered = renderHook(() => useDeviceQuotaDraftCatalog(), {
      wrapper: createReactQueryWrapper(createTestQueryClient()),
    })
    await waitFor(() => expect(rendered.result.current.status).toBe("ready"))

    await expect(
      act(async () => {
        await rendered.result.current.exclude("item-1")
      })
    ).rejects.toThrow()

    expect(rendered.result.current.rows[0]?.isExcluded).toBe(false)
    await waitFor(() => expect(rendered.result.current.canRetry).toBe(true))
    expect(mockCallRpc).toHaveBeenLastCalledWith({
      fn: "device_quota_unit_catalog_draft_exclude",
      args: {
        p_draft_id: "draft-1",
        p_regulatory_item_id: "regulatory-1",
        p_expected_revision: 3,
      },
    })
  })
})
