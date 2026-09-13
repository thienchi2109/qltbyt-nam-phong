import { beforeEach, describe, expect, it, vi } from "vitest"
import { request } from "./test-fixtures"

const mocks = vi.hoisted(() => ({ callSessionRpc: vi.fn(), requireSession: vi.fn() }))
vi.mock("@/lib/web-push/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/web-push/api")>()),
  ...mocks,
}))
vi.mock("server-only", () => ({}))
import { GET } from "../candidates/route"
import { WebPushApiError } from "@/lib/web-push/api"

describe("recipient candidate API boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.requireSession.mockResolvedValue({ user: { id: "123" } })
    mocks.callSessionRpc.mockResolvedValue({
      version: 1,
      don_vi_id: "7",
      candidates: [],
      next_cursor: null,
    })
  })
  it.each([
    "don_vi_id=7&don_vi_id=8",
    "don_vi_id=7&limit=101",
    "don_vi_id=7&limit=NaN",
    "don_vi_id=7&cursor=0",
    "don_vi_id=7&role=global",
    "don_vi_id=7&q=a&q=b",
  ])("rejects invalid query %s before RPC", async (query) => {
    expect(
      (await GET(request("https://app.example/api/web-push/candidates?" + query))).status
    ).toBe(400)
    expect(mocks.callSessionRpc).not.toHaveBeenCalled()
  })
  it("forwards bounded search with authenticated identity and returns no-store", async () => {
    const response = await GET(
      request("https://app.example/api/web-push/candidates?don_vi_id=7&q=alice&limit=5&cursor=12")
    )
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(mocks.callSessionRpc).toHaveBeenCalledWith(
      "web_push_recipient_candidates",
      { p_don_vi: "7", p_search: "alice", p_limit: 5, p_cursor: "12" },
      { id: "123" }
    )
  })
  it("requires session and preserves forbidden response", async () => {
    mocks.requireSession.mockRejectedValueOnce(new WebPushApiError(401, "unauthorized"))
    expect(
      (await GET(request("https://app.example/api/web-push/candidates?don_vi_id=7"))).status
    ).toBe(401)
    expect(mocks.callSessionRpc).not.toHaveBeenCalled()
    mocks.callSessionRpc.mockRejectedValueOnce(new WebPushApiError(403, "forbidden"))
    expect(
      (await GET(request("https://app.example/api/web-push/candidates?don_vi_id=7"))).status
    ).toBe(403)
  })
  it("fails closed on cross-unit or over-limit upstream data", async () => {
    mocks.callSessionRpc.mockResolvedValueOnce({
      version: 1,
      don_vi_id: "8",
      candidates: [],
      next_cursor: null,
    })
    expect(
      (await GET(request("https://app.example/api/web-push/candidates?don_vi_id=7"))).status
    ).toBe(503)
    mocks.callSessionRpc.mockResolvedValueOnce({
      version: 1,
      don_vi_id: "7",
      candidates: [
        { user_id: "1", username: "a", full_name: null },
        { user_id: "2", username: "b", full_name: null },
      ],
      next_cursor: null,
    })
    expect(
      (await GET(request("https://app.example/api/web-push/candidates?don_vi_id=7&limit=1"))).status
    ).toBe(503)
  })
})
