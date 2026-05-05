import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { AuthLifecycleLogPayload } from "@/auth/logging"
import { persistAuthLifecycleLog } from "@/auth/persistence"

const supabaseState = vi.hoisted(() => ({
  rpcError: null as unknown,
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
}))

const supabaseClient = vi.hoisted(() => ({
  rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
    supabaseState.rpcCalls.push({ fn, args })
    return {
      data: supabaseState.rpcError ? null : true,
      error: supabaseState.rpcError,
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
    supabaseState.rpcCalls = []
    createClientSpy.mockClear()
    supabaseClient.rpc.mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    consoleErrorSpy.mockRestore()
  })

  it("uses the service role client and forwards the auth audit payload to auth_audit_log_insert", async () => {
    await persistAuthLifecycleLog(samplePayload)

    expect(createClientSpy).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "test-service-role-key"
    )
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
})
