import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { EquipmentDataset } from "@/app/(app)/equipment/_hooks/equipmentDataset"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"
import {
  useActiveUsageLogs,
  useEquipmentUsageLogs,
  useEquipmentUsageLogsMore,
} from "../use-usage-logs"

// The live catalog also reports zero defaults for this overload (2026-10-21).
const migration = readFileSync(
  resolve("supabase/migrations/20261014120000_equipment_dataset_scope.sql"),
  "utf8"
)
const signature = migration.match(
  /CREATE OR REPLACE FUNCTION public\.usage_log_list\((p_thiet_bi_id[^)]*)\)/
)?.[1]
if (!signature) throw new Error("Equipment dataset usage_log_list signature not found")
const requiredArguments = signature
  .split(",")
  .filter((argument) => !/\bDEFAULT\b/i.test(argument))
  .map((argument) => argument.trim().split(/\s+/)[0])

const mockFetch = vi.fn<typeof fetch>()
const datasets: EquipmentDataset[] = ["placed", "regular"]
const queries = [
  {
    name: "initial equipment history",
    useQuery: (equipmentDataset: EquipmentDataset) =>
      useEquipmentUsageLogs("42", { equipmentDataset }),
  },
  {
    name: "older equipment history",
    useQuery: (equipmentDataset: EquipmentDataset) =>
      useEquipmentUsageLogsMore("42", 50, { equipmentDataset }),
  },
  {
    name: "active usage sessions",
    useQuery: (equipmentDataset: EquipmentDataset) => useActiveUsageLogs({ equipmentDataset }),
  },
]

describe("usage log HTTP payload matches the dataset RPC signature", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue(new Response("[]", { status: 200 }))
    vi.stubGlobal("fetch", mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("binds the nine required inputs of the applied equipment dataset overload", () => {
    expect(requiredArguments).toHaveLength(9)
    expect(requiredArguments).toContain("p_equipment_dataset")
  })

  describe.each(queries)("$name", ({ useQuery }) => {
    it.each(datasets)("sends every required RPC argument for %s", async (equipmentDataset) => {
      const { result } = renderHook(() => useQuery(equipmentDataset), {
        wrapper: createReactQueryWrapper(createTestQueryClient()),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toBe("/api/rpc/usage_log_list")
      const body: Record<string, unknown> = JSON.parse(String(options?.body))
      expect(body.p_equipment_dataset).toBe(equipmentDataset)
      expect(
        requiredArguments.filter((argument) => !Object.hasOwn(body, argument)),
        "PostgREST cannot resolve the dataset overload when required arguments are missing"
      ).toEqual([])
    })
  })
})
