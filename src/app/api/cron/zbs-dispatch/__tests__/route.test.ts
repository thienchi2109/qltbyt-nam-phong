import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const dispatcherMocks = vi.hoisted(() => ({
  dispatchPendingZbsNotifications: vi.fn(),
}))
const supabaseMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock("@/lib/zbs/live-dispatcher", () => ({
  dispatchPendingZbsNotifications: dispatcherMocks.dispatchPendingZbsNotifications,
}))
vi.mock("@supabase/supabase-js", () => ({
  createClient: supabaseMocks.createClient,
}))

const ORIGINAL_ENV = { ...process.env }

async function loadRoute() {
  try {
    const routeModulePath = ["..", "route"].join("/")
    return await import(/* @vite-ignore */ routeModulePath)
  } catch {
    return null
  }
}

describe("/api/cron/zbs-dispatch", () => {
  beforeEach(() => {
    vi.resetModules()
    dispatcherMocks.dispatchPendingZbsNotifications.mockReset()
    supabaseMocks.createClient.mockReset()
    supabaseMocks.rpc.mockReset()
    supabaseMocks.createClient.mockReturnValue({ rpc: supabaseMocks.rpc })
    process.env = {
      ...ORIGINAL_ENV,
      CRON_SECRET: "cron-secret",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
      ZALO_ZBS_DISPATCH_ENABLED: "false",
      ZALO_ZBS_ACCESS_TOKEN: "zalo-access-token",
      ZALO_ZBS_REPAIR_TEMPLATE_ID: "template-123",
      NEXT_PUBLIC_APP_URL: "https://app.example.test",
    }
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it("rejects requests without the cron bearer token", async () => {
    const mod = await loadRoute()
    expect(mod?.GET).toBeTypeOf("function")

    const response = await mod!.GET(new Request("https://example.test/api/cron/zbs-dispatch"))

    expect(response.status).toBe(401)
    expect(dispatcherMocks.dispatchPendingZbsNotifications).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" })
  })

  it("invokes the dispatcher with disabled gate config and targeted outbox ids", async () => {
    dispatcherMocks.dispatchPendingZbsNotifications.mockResolvedValue({
      dispatch_state: "disabled-dispatch",
      attempted: 0,
      sent: 0,
      retryable_failed: 0,
      failed: 0,
      results: [],
    })
    const mod = await loadRoute()
    expect(mod?.GET).toBeTypeOf("function")

    const response = await mod!.GET(
      new Request("https://example.test/api/cron/zbs-dispatch?outboxId=outbox-1", {
        headers: { Authorization: "Bearer cron-secret" },
      })
    )

    expect(response.status).toBe(200)
    expect(supabaseMocks.createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-role-secret",
      { auth: { persistSession: false } }
    )
    expect(dispatcherMocks.dispatchPendingZbsNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        dispatchEnabled: false,
        accessToken: "zalo-access-token",
        repairTemplateId: "template-123",
        appBaseUrl: "https://app.example.test",
        outboxIds: ["outbox-1"],
        rpcClient: expect.any(Function),
      })
    )
    await expect(response.json()).resolves.toEqual({
      success: true,
      result: {
        dispatch_state: "disabled-dispatch",
        attempted: 0,
        sent: 0,
        retryable_failed: 0,
        failed: 0,
        results: [],
      },
    })
  })

  it("does not leak dispatcher errors in the response", async () => {
    dispatcherMocks.dispatchPendingZbsNotifications.mockRejectedValue(
      new Error("zalo-access-token should not leak")
    )
    const mod = await loadRoute()
    expect(mod?.GET).toBeTypeOf("function")

    const response = await mod!.GET(
      new Request("https://example.test/api/cron/zbs-dispatch", {
        headers: { Authorization: "Bearer cron-secret" },
      })
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: "ZBS dispatch failed" })
  })
})
