import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { callRpc } from "@/lib/rpc-client"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"
import { useDeviceQuotaDraftCatalog } from "../useDeviceQuotaDraftCatalog"

const mockUseSession = vi.fn()
vi.mock("next-auth/react", () => ({ useSession: () => mockUseSession() }))
vi.mock("@/lib/rpc-client", () => ({ callRpc: vi.fn() }))

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

beforeEach(() => {
  vi.clearAllMocks()
  mockUseSession.mockReturnValue({
    status: "authenticated",
    data: { user: { id: "user-1", role: "to_qltb", don_vi: 7 } },
  })
  mockCallRpc
    .mockResolvedValueOnce({ data: draft })
    .mockResolvedValueOnce({ data: draft })
    .mockResolvedValueOnce(catalog)
})

describe("useDeviceQuotaDraftCatalog quantity validation", () => {
  it.each([-1, 1.5])("rejects invalid applied quantity %s before save", async (quantity) => {
    const rendered = renderHook(() => useDeviceQuotaDraftCatalog(), {
      wrapper: createReactQueryWrapper(createTestQueryClient()),
    })
    await waitFor(() => expect(rendered.result.current.status).toBe("ready"))

    act(() => rendered.result.current.updateItem("item-1", { appliedQuantity: quantity }))

    await expect(
      act(async () => {
        await rendered.result.current.save()
      })
    ).rejects.toThrow()

    expect(rendered.result.current.validationErrors["item-1"]).toMatch(/nguyên|âm/i)
    expect(mockCallRpc).toHaveBeenCalledTimes(3)
    expect(rendered.result.current.rows[0]?.appliedQuantity).toBe(quantity)
    expect(rendered.result.current.lastSavedRows[0]?.appliedQuantity).toBe(2)
  })
})
