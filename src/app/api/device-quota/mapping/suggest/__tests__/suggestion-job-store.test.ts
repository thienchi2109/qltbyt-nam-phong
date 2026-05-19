import fs from "fs"
import path from "path"

import { beforeEach, describe, expect, test, vi } from "vitest"

const rpcMock = vi.fn()
const fromMock = vi.fn()

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: fromMock,
    rpc: rpcMock,
  })),
}))

describe("device quota suggestion job store", () => {
  beforeEach(() => {
    rpcMock.mockReset()
    fromMock.mockReset()
    vi.resetModules()
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.test")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role")
  })

  test("uses RPC-only persistence instead of direct table access", async () => {
    rpcMock.mockResolvedValue({
      data: {
        catalog_signature: "catalog",
        category_snapshot: [],
        created_at: "2026-05-19T00:00:00.000Z",
        data_signature: "signature",
        don_vi_id: 17,
        error: null,
        id: "job-1",
        item_counts: { categories: 0, unassignedDevices: 0, unassignedNames: 0 },
        processed_unique_names: 0,
        provider: "vm",
        result: null,
        scope_key: "user:user-1",
        status: "queued",
        total_unique_names: 0,
        updated_at: "2026-05-19T00:00:00.000Z",
      },
      error: null,
    })
    const { createServerSuggestionJobStore } = await import(
      "@/app/api/device-quota/mapping/suggest/suggestion-job-store"
    )

    await createServerSuggestionJobStore().getJob("job-1")

    expect(rpcMock).toHaveBeenCalledWith("device_quota_suggestion_job_store_rpc", {
      p_action: "get_job",
      p_payload: { job_id: "job-1" },
    })
    expect(fromMock).not.toHaveBeenCalled()
  })

  test("does not contain direct Supabase table queries", () => {
    const filePath = path.join(
      process.cwd(),
      "src/app/api/device-quota/mapping/suggest/suggestion-job-store.ts",
    )
    const source = fs.readFileSync(filePath, "utf8")

    expect(source).not.toContain(".from(")
  })
})
