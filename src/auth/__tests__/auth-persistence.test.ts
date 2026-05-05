import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { AuthLifecycleLogPayload } from "@/auth/logging"
import { persistAuthLifecycleLog } from "@/auth/persistence"

const supabaseState = vi.hoisted(() => ({
  rpcError: null as unknown,
  rpcData: true as boolean | null,
  rpcMode: "success" as "success" | "hang",
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  abortSignals: [] as AbortSignal[],
}))

const supabaseClient = vi.hoisted(() => ({
  rpc: vi.fn((fn: string, args: Record<string, unknown>) => {
    supabaseState.rpcCalls.push({ fn, args })

    return {
      abortSignal: vi.fn((signal: AbortSignal) => {
        supabaseState.abortSignals.push(signal)

        if (supabaseState.rpcMode === "hang") {
          return new Promise<{
            data: boolean | null
            error: unknown
          }>((_resolve, reject) => {
            signal.addEventListener(
              "abort",
              () => reject(signal.reason ?? new Error("aborted")),
              { once: true }
            )
          })
        }

        return Promise.resolve({
          data: supabaseState.rpcError ? null : supabaseState.rpcData,
          error: supabaseState.rpcError,
        })
      }),
    }
  }),
}))

const createClientSpy = vi.hoisted(() => vi.fn(() => supabaseClient))

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientSpy,
}))

const samplePayload: AuthLifecycleLogPayload = {
  scope: "auth.lifecycle",
  ts: "2026-05-05T00:00:00.000Z",
  event: "forced_signout",
  source: "events_signout",
  signout_reason: "session_expired",
  user_id: "42",
  username: "nqminh",
  tenant_id: "17",
  request_id: "req-123",
  ip_address: "203.0.113.1",
  user_agent: "VitestAuthPersistence/1.0",
  metadata: {
    session_duration_ms: 120000,
  },
}

describe("persistAuthLifecycleLog", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
    supabaseState.rpcError = null
    supabaseState.rpcData = true
    supabaseState.rpcMode = "success"
    supabaseState.rpcCalls = []
    supabaseState.abortSignals = []
    createClientSpy.mockClear()
    supabaseClient.rpc.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    consoleErrorSpy.mockRestore()
  })

  it("uses the service role client and forwards the auth audit payload to auth_audit_log_insert", async () => {
    await persistAuthLifecycleLog(samplePayload)

    expect(createClientSpy).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "test-service-role-key"
    )
    expect(supabaseState.abortSignals).toHaveLength(1)
    expect(supabaseState.abortSignals[0]?.aborted).toBe(false)
    expect(supabaseState.rpcCalls).toEqual([
      {
        fn: "auth_audit_log_insert",
        args: {
          p_created_at: "2026-05-05T00:00:00.000Z",
          p_event: "forced_signout",
          p_source: "events_signout",
          p_reason_code: null,
          p_signout_reason: "session_expired",
          p_user_id: "42",
          p_username: "nqminh",
          p_tenant_id: "17",
          p_request_id: "req-123",
          p_trace_id: null,
          p_ip_address: "203.0.113.1",
          p_user_agent: "VitestAuthPersistence/1.0",
          p_metadata: {
            session_duration_ms: 120000,
          },
        },
      },
    ])
  })

  it("returns without calling Supabase when service-role env is missing", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "")

    await expect(persistAuthLifecycleLog(samplePayload)).resolves.toBeUndefined()

    expect(createClientSpy).not.toHaveBeenCalled()
    expect(supabaseState.rpcCalls).toEqual([])
  })

  it("swallows audit insert RPC failures", async () => {
    supabaseState.rpcError = { message: "insert failed" }

    await expect(persistAuthLifecycleLog(samplePayload)).resolves.toBeUndefined()

    expect(supabaseState.rpcCalls).toEqual([
      expect.objectContaining({
        fn: "auth_audit_log_insert",
      }),
    ])
  })

  it("logs SQL-level insert failures when the RPC returns false without an error payload", async () => {
    supabaseState.rpcData = false

    await expect(persistAuthLifecycleLog(samplePayload)).resolves.toBeUndefined()

    expect(consoleErrorSpy).toHaveBeenCalledWith("Auth audit sink insert failed", { data: false })
  })

  it("aborts a hanging auth audit RPC instead of blocking the caller", async () => {
    vi.useFakeTimers()
    supabaseState.rpcMode = "hang"

    const persistPromise = persistAuthLifecycleLog(samplePayload)

    await vi.advanceTimersByTimeAsync(1_500)
    await expect(persistPromise).resolves.toBeUndefined()

    expect(supabaseState.abortSignals).toHaveLength(1)
    expect(supabaseState.abortSignals[0]?.aborted).toBe(true)
    expect(consoleErrorSpy).toHaveBeenCalledWith("Auth audit persistence failed", expect.anything())
  })
})
