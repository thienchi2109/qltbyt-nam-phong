import { act, render, renderHook, waitFor } from "@testing-library/react"
import { useQuery, type QueryKey } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { callRpc } from "@/lib/rpc-client"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"
import { useDeviceQuotaDraftCatalog } from "../useDeviceQuotaDraftCatalog"

const mockUseSession = vi.hoisted(() => vi.fn())

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: vi.fn(),
}))

const mockCallRpc = vi.mocked(callRpc)

function ActiveSurfaceProbe({
  queryKey,
  contract,
  onFetch,
}: {
  queryKey: QueryKey
  contract: string
  onFetch: (contract: string) => void
}) {
  useQuery({
    queryKey,
    queryFn: async () => {
      onFetch(contract)
      return contract
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })
  return null
}

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
      display_name_override: null,
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

function setup() {
  mockUseSession.mockReturnValue({
    status: "authenticated",
    data: { user: { id: "user-1", role: "to_qltb", don_vi: 7 } },
  })
  mockCallRpc
    .mockResolvedValueOnce({ data: draft })
    .mockResolvedValueOnce({ data: draft })
    .mockResolvedValueOnce(catalog)
}

describe("useDeviceQuotaDraftCatalog active-surface isolation", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("keeps active quota surfaces and import contracts untouched across draft writes", async () => {
    setup()
    mockCallRpc
      .mockResolvedValueOnce({
        data: {
          ...draft,
          draft: { ...draft.draft, revision: 4 },
          items: [{ ...draft.items[0], applied_quantity: 5 }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          ...draft,
          draft: { ...draft.draft, revision: 5 },
          items: [{ ...draft.items[0], applied_quantity: 5, is_excluded: true }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          ...draft,
          draft: { ...draft.draft, revision: 6 },
          items: [{ ...draft.items[0], applied_quantity: 5, is_excluded: false }],
        },
      })

    const queryClient = createTestQueryClient()
    queryClient.setDefaultOptions({
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    })
    const activeQueryKeys = [
      ["dinh_muc_nhom_list", { donViId: 7 }],
      ["dinh_muc_quyet_dinh_list"],
      ["dinh_muc_thiet_bi_unassigned"],
      ["dinh_muc_compliance_summary"],
      ["reports", "unused-equipment", { selectedDonVi: 7, page: 1 }],
    ] as const
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries")
    const activeFetchCounts = new Map<string, number>()
    const activeQueries = [
      { contract: "dinh_muc_nhom_list", queryKey: activeQueryKeys[0] },
      { contract: "dinh_muc_quyet_dinh_list", queryKey: activeQueryKeys[1] },
      { contract: "dinh_muc_thiet_bi_unassigned", queryKey: activeQueryKeys[2] },
      { contract: "dinh_muc_compliance_summary", queryKey: activeQueryKeys[3] },
      { contract: "unused_equipment_report_for_reports", queryKey: activeQueryKeys[4] },
    ]
    render(
      <>
        {activeQueries.map(({ contract, queryKey }) => (
          <ActiveSurfaceProbe
            key={contract}
            queryKey={queryKey}
            contract={contract}
            onFetch={(name) => activeFetchCounts.set(name, (activeFetchCounts.get(name) ?? 0) + 1)}
          />
        ))}
      </>,
      { wrapper: createReactQueryWrapper(queryClient) }
    )
    const rendered = renderHook(() => useDeviceQuotaDraftCatalog(), {
      wrapper: createReactQueryWrapper(queryClient),
    })
    await waitFor(() => expect(rendered.result.current.status).toBe("ready"))
    await waitFor(() => expect(activeFetchCounts.size).toBe(activeQueries.length))

    act(() => {
      rendered.result.current.updateItem("item-1", { appliedQuantity: 5 })
    })
    await act(async () => {
      await rendered.result.current.save()
      await rendered.result.current.exclude("item-1")
      await rendered.result.current.restore("item-1")
    })

    const activeRpcNames = new Set([
      "dinh_muc_nhom_list",
      "dinh_muc_nhom_bulk_import",
      "dinh_muc_unified_import",
      "dinh_muc_chi_tiet_bulk_import",
      "dinh_muc_quyet_dinh_list",
      "dinh_muc_thiet_bi_unassigned",
      "dinh_muc_thiet_bi_by_nhom",
      "dinh_muc_thiet_bi_link",
      "dinh_muc_thiet_bi_link_batch",
      "dinh_muc_compliance_summary",
      "unused_equipment_report_for_reports",
    ])
    const activeCalls = mockCallRpc.mock.calls.filter(([input]) =>
      activeRpcNames.has(String(input.fn))
    )
    expect(activeCalls).toEqual([])

    const invalidatedActiveKeys = invalidateQueries.mock.calls
      .map(([filters]) => filters.queryKey?.[0])
      .filter((key): key is string => typeof key === "string" && activeRpcNames.has(key))
    expect(invalidatedActiveKeys).toEqual([])
    activeQueryKeys.forEach((queryKey) => {
      expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(false)
    })
    activeQueries.forEach(({ contract }) => {
      expect(activeFetchCounts.get(contract)).toBe(1)
    })
  })
})
