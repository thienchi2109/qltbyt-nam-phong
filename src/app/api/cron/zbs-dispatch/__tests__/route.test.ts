import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const dispatcherMocks = vi.hoisted(() => ({
  dispatchPendingZbsNotifications: vi.fn(),
}))
const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/zbs/live-dispatcher", () => ({
  dispatchPendingZbsNotifications: dispatcherMocks.dispatchPendingZbsNotifications,
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
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
    process.env = {
      ...ORIGINAL_ENV,
      CRON_SECRET: "cron-secret",
      SUPABASE_JWT_SECRET: "test-jwt-secret",
      ZALO_ZBS_DISPATCH_ENABLED: "false",
      ZALO_ZBS_ACCESS_TOKEN: "zalo-access-token",
      ZALO_ZBS_REPAIR_TEMPLATE_ID: "template-123",
      NEXT_PUBLIC_APP_URL: "https://app.example.test",
    }
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it("rejects requests without the cron bearer token", async () => {
    const mod = await loadRoute()
    expect(mod?.GET).toBeTypeOf("function")

    const response = await mod!.GET(new Request("https://example.test/api/cron/zbs-dispatch"))

    expect(response.status).toBe(401)
    expect(dispatcherMocks.dispatchPendingZbsNotifications).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" })
  })

  it("invokes the dispatcher through the internal RPC proxy with disabled gate config and targeted outbox ids", async () => {
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

  it("calls the RPC proxy with cron credentials when the dispatcher uses rpcClient", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: "outbox-1" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    )
    dispatcherMocks.dispatchPendingZbsNotifications.mockImplementationOnce(async (options) => {
      const rows = await options.rpcClient({
        fn: "zbs_notification_outbox_claim_for_dispatch",
        args: { p_limit: 1 },
      })
      return {
        dispatch_state: "live-dispatch",
        attempted: Array.isArray(rows) ? rows.length : 0,
        sent: 0,
        retryable_failed: 0,
        failed: 0,
        results: [],
      }
    })
    const mod = await loadRoute()
    expect(mod?.GET).toBeTypeOf("function")

    const response = await mod!.GET(
      new Request("https://example.test/api/cron/zbs-dispatch", {
        headers: { Authorization: "Bearer cron-secret" },
      })
    )

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/api/rpc/zbs_notification_outbox_claim_for_dispatch",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer cron-secret",
          "Content-Type": "application/json",
          "Content-Length": String(Buffer.byteLength(JSON.stringify({ p_limit: 1 }))),
          Origin: "https://example.test",
          "x-qltbyt-internal-rpc": "zbs-dispatch",
          "x-qltbyt-internal-rpc-body-sha256": expect.any(String),
          "x-qltbyt-internal-rpc-signature": expect.any(String),
          "x-qltbyt-internal-rpc-timestamp": expect.any(String),
        }),
        signal: expect.any(AbortSignal),
        body: JSON.stringify({ p_limit: 1 }),
      })
    )
    await expect(response.json()).resolves.toEqual({
      success: true,
      result: {
        dispatch_state: "live-dispatch",
        attempted: 1,
        sent: 0,
        retryable_failed: 0,
        failed: 0,
        results: [],
      },
    })
  })

  it("aborts hung internal RPC proxy calls", async () => {
    vi.useFakeTimers()
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    fetchMock.mockImplementationOnce((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new Error("internal rpc request aborted"))
        })
      })
    })
    dispatcherMocks.dispatchPendingZbsNotifications.mockImplementationOnce(async (options) => {
      await options.rpcClient({
        fn: "zbs_notification_outbox_claim_for_dispatch",
        args: { p_limit: 1 },
      })
    })
    const mod = await loadRoute()
    expect(mod?.GET).toBeTypeOf("function")

    const responsePromise = mod!.GET(
      new Request("https://example.test/api/cron/zbs-dispatch", {
        headers: { Authorization: "Bearer cron-secret" },
      })
    )
    await vi.advanceTimersByTimeAsync(10_000)
    const response = await responsePromise

    expect(response.status).toBe(500)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/api/rpc/zbs_notification_outbox_claim_for_dispatch",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    )
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" })
    consoleErrorSpy.mockRestore()
    vi.useRealTimers()
  })

  it("preserves structured RPC failure details in the cron response", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            message: "Validation failed",
            details: { code: "bad_zbs_claim", field: "p_outbox_ids" },
          },
        }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      )
    )
    dispatcherMocks.dispatchPendingZbsNotifications.mockImplementationOnce(async (options) => {
      await options.rpcClient({
        fn: "zbs_notification_outbox_claim_for_dispatch",
        args: { p_outbox_ids: ["not-a-uuid"] },
      })
    })
    const mod = await loadRoute()
    expect(mod?.GET).toBeTypeOf("function")

    const response = await mod!.GET(
      new Request("https://example.test/api/cron/zbs-dispatch", {
        headers: { Authorization: "Bearer cron-secret" },
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "ZBS dispatch failed",
      details: { code: "bad_zbs_claim", field: "p_outbox_ids" },
    })
  })

  it("sanitizes 5xx RPC failure details in the cron response", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            message: "Database role failed",
            details: { code: "service_role_missing", secret: "do-not-leak" },
          },
        }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        }
      )
    )
    dispatcherMocks.dispatchPendingZbsNotifications.mockImplementationOnce(async (options) => {
      await options.rpcClient({
        fn: "zbs_notification_outbox_claim_for_dispatch",
        args: { p_limit: 1 },
      })
    })
    const mod = await loadRoute()
    expect(mod?.GET).toBeTypeOf("function")

    const response = await mod!.GET(
      new Request("https://example.test/api/cron/zbs-dispatch", {
        headers: { Authorization: "Bearer cron-secret" },
      })
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" })
  })

  it("sanitizes missing cron secret configuration failures", async () => {
    delete process.env.CRON_SECRET
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const mod = await loadRoute()
    expect(mod?.GET).toBeTypeOf("function")

    const response = await mod!.GET(new Request("https://example.test/api/cron/zbs-dispatch"))

    expect(response.status).toBe(500)
    expect(dispatcherMocks.dispatchPendingZbsNotifications).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" })
    consoleErrorSpy.mockRestore()
  })

  it("does not leak dispatcher errors in the response", async () => {
    const dispatchError = new Error("zalo-access-token should not leak")
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    dispatcherMocks.dispatchPendingZbsNotifications.mockRejectedValue(dispatchError)
    const mod = await loadRoute()
    expect(mod?.GET).toBeTypeOf("function")

    const response = await mod!.GET(
      new Request("https://example.test/api/cron/zbs-dispatch", {
        headers: { Authorization: "Bearer cron-secret" },
      })
    )

    expect(response.status).toBe(500)
    expect(consoleErrorSpy).toHaveBeenCalledWith("ZBS dispatch cron failed", {
      error: {
        name: "Error",
      },
    })
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" })
    consoleErrorSpy.mockRestore()
  })
})
