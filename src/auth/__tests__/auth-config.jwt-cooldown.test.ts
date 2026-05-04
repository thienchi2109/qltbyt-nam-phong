import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Build a Supabase mock that records profile refresh RPC calls.
type ProfileRow = {
  password_changed_at: string | null
  current_don_vi: number | null
  don_vi: number | null
  khoa_phong: string | null
  full_name: string | null
  dia_ban_id: number | null
  ma_dia_ban: string | null
}

const profileRowDefault: ProfileRow = {
  password_changed_at: null,
  current_don_vi: 17,
  don_vi: 17,
  khoa_phong: "KT",
  full_name: "Nguyen Quang Minh",
  dia_ban_id: 9,
  ma_dia_ban: "HN-01",
}

const supabaseState = vi.hoisted(() => ({
  fromCalls: [] as string[],
  rpcRows: [] as unknown[],
  rpcError: null as unknown,
}))

const supabaseClient = vi.hoisted(() => ({
  from: vi.fn((table: string) => {
    supabaseState.fromCalls.push(table)
    return {
      select: () => ({
        eq: () => ({
          limit: vi.fn(async () => ({ data: [], error: { message: `unexpected ${table}` } })),
          single: vi.fn(async () => ({ data: null, error: { message: `unexpected ${table}` } })),
        }),
      }),
    }
  }),
  rpc: vi.fn(async () => ({
    data: supabaseState.rpcError ? null : supabaseState.rpcRows,
    error: supabaseState.rpcError,
  })),
}))

const requestHeadersState = vi.hoisted(() => ({
  values: new Map<string, string>(),
}))

type AuthJwtTelemetryLog = {
  scope: string
  event: string
  userId?: string
  trigger?: string
  refreshReason?: string
  invalidatedReason?: string
  username?: string
  full_name?: string
  password?: string
}

type AuthLifecycleLog = {
  scope: string
  event: string
  source: string
  signout_reason?: string
  user_id?: string
  username?: string
  tenant_id?: string
  request_id?: string | null
  ip_address?: string | null
  user_agent?: string | null
  metadata?: Record<string, unknown>
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => supabaseClient),
}))

vi.mock("next/headers", () => ({
  headers: () => ({
    get(name: string) {
      return requestHeadersState.values.get(name.toLowerCase()) ?? null
    },
  }),
}))

import { authOptions } from "@/auth/config"

type JwtCb = NonNullable<NonNullable<typeof authOptions.callbacks>["jwt"]>
type JwtArgs = Parameters<JwtCb>[0]

const baseToken = {
  id: "42",
  username: "nqminh",
  role: "to_qltb",
  khoa_phong: "KT",
  don_vi: 17,
  dia_ban_id: 9,
  full_name: "Nguyen Quang Minh",
  auth_mode: "dual_mode",
}

async function runJwt(args: Partial<JwtArgs> & Pick<JwtArgs, "token">) {
  const cb = authOptions.callbacks?.jwt
  if (!cb) throw new Error("jwt callback not configured")
  return cb({
    account: null,
    profile: undefined,
    isNewUser: undefined,
    session: undefined,
    trigger: undefined,
    ...args,
  } as JwtArgs)
}

function authJwtTelemetryLogs(infoSpy: ReturnType<typeof vi.spyOn>): AuthJwtTelemetryLog[] {
  return infoSpy.mock.calls
    .map(([message]) => (typeof message === "string" ? message : ""))
    .filter((message) => message.includes("\"scope\":\"auth.jwt\""))
    .map((message) => JSON.parse(message) as AuthJwtTelemetryLog)
}

function authLifecycleLogs(infoSpy: ReturnType<typeof vi.spyOn>): AuthLifecycleLog[] {
  return infoSpy.mock.calls
    .map(([message]) => (typeof message === "string" ? message : ""))
    .filter((message) => message.includes("\"scope\":\"auth.lifecycle\""))
    .map((message) => JSON.parse(message) as AuthLifecycleLog)
}

describe("authOptions.jwt cooldown + trigger gate", () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-02T12:00:00Z"))
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined)
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
    vi.stubEnv("SUPABASE_JWT_SECRET", "test-jwt-secret")
    requestHeadersState.values = new Map([
      ["x-request-id", "jwt-req-42"],
      ["x-forwarded-for", "198.51.100.9"],
      ["user-agent", "VitestJwt/1.0"],
    ])
    supabaseState.fromCalls = []
    supabaseState.rpcRows = [{ ...profileRowDefault }]
    supabaseState.rpcError = null
    supabaseClient.from.mockClear()
    supabaseClient.rpc.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    consoleInfoSpy.mockRestore()
    consoleWarnSpy.mockRestore()
  })

  it("fetches profile on sign-in and stamps lastRefreshAt + loginTime", async () => {
    const result = await runJwt({
      token: { ...baseToken },
      user: { ...baseToken } as JwtArgs["user"],
    })

    expect(supabaseClient.rpc).toHaveBeenCalledWith("get_session_profile_for_jwt", { p_user_id: "42" })
    expect(supabaseClient.from).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      id: "42",
      username: "nqminh",
      loginTime: Date.now(),
      lastRefreshAt: Date.now(),
    })
  })

  it("skips DB fetch on subsequent calls within cooldown window", async () => {
    const now = Date.now()
    supabaseState.fromCalls = []
    supabaseClient.from.mockClear()

    const token = {
      ...baseToken,
      loginTime: now - 30_000, // 30s ago
      lastRefreshAt: now - 30_000, // refreshed 30s ago, well inside cooldown
    }

    const result = await runJwt({ token })

    expect(supabaseClient.rpc).not.toHaveBeenCalled()
    expect(supabaseState.fromCalls).toEqual([])
    expect(result).toMatchObject({
      id: "42",
      lastRefreshAt: now - 30_000, // unchanged
    })
  })

  it("re-fetches when cooldown has elapsed", async () => {
    const now = Date.now()
    const token = {
      ...baseToken,
      loginTime: now - 5 * 60_000,
      lastRefreshAt: now - 5 * 60_000, // 5 minutes ago
    }

    const result = await runJwt({ token })

    expect(supabaseClient.rpc).toHaveBeenCalled()
    expect(supabaseClient.from).not.toHaveBeenCalled()
    expect(result).toMatchObject({ lastRefreshAt: now })
  })

  it("force-refreshes when trigger === 'update' even within cooldown", async () => {
    const now = Date.now()
    supabaseState.rpcRows = [{
      ...profileRowDefault,
      current_don_vi: 99,
      don_vi: 99,
    }]
    const token = {
      ...baseToken,
      loginTime: now - 10_000,
      lastRefreshAt: now - 10_000,
    }

    const result = await runJwt({ token, trigger: "update" })

    expect(supabaseClient.rpc).toHaveBeenCalled()
    expect(result).toMatchObject({
      don_vi: 99,
      lastRefreshAt: now,
    })
  })

  it("returns the token untouched when token has no id (anonymous)", async () => {
    const result = await runJwt({ token: { name: "anon" } as JwtArgs["token"] })

    expect(supabaseClient.rpc).not.toHaveBeenCalled()
    expect(supabaseClient.from).not.toHaveBeenCalled()
    expect(result).toEqual({ name: "anon" })
  })

  it("invalidates token when password_changed_at is after loginTime (no cooldown bypass)", async () => {
    const now = Date.now()
    const loginTime = now - 60 * 60_000 // 1h ago
    const passwordChangedAt = new Date(now - 5 * 60_000).toISOString() // 5min ago
    supabaseState.rpcRows = [{
      ...profileRowDefault,
      password_changed_at: passwordChangedAt,
    }]

    const token = {
      ...baseToken,
      loginTime,
      lastRefreshAt: now - 5 * 60_000, // cooldown elapsed → fetch runs
    }

    const result = await runJwt({ token })

    expect(supabaseClient.rpc).toHaveBeenCalled()
    expect(result).toEqual({})
  })

  it("persists pending_signout_reason from session.update payloads into the JWT", async () => {
    const now = Date.now()

    const result = await runJwt({
      token: {
        ...baseToken,
        loginTime: now - 10_000,
        lastRefreshAt: now - 10_000,
      },
      trigger: "update",
      session: {
        pending_signout_reason: "user_initiated",
      } as JwtArgs["session"],
    })

    expect(result).toMatchObject({
      id: "42",
      pending_signout_reason: "user_initiated",
    })
  })

  it("clears stale pending_signout_reason when a later session.update omits it", async () => {
    const now = Date.now()

    const result = await runJwt({
      token: {
        ...baseToken,
        loginTime: now - 10_000,
        lastRefreshAt: now - 10_000,
        pending_signout_reason: "user_initiated",
      } as JwtArgs["token"],
      trigger: "update",
      session: {} as JwtArgs["session"],
    })

    expect(result).not.toHaveProperty("pending_signout_reason")
  })

  it("preserves pending_signout_reason when update-trigger invalidation would otherwise empty the token", async () => {
    const now = Date.now()
    supabaseState.rpcRows = [{
      ...profileRowDefault,
      password_changed_at: new Date(now - 5_000).toISOString(),
    }]

    const result = await runJwt({
      token: {
        ...baseToken,
        loginTime: now - 10_000,
        lastRefreshAt: now - 10_000,
      },
      trigger: "update",
      session: {
        pending_signout_reason: "forced_password_change",
      } as JwtArgs["session"],
    })

    expect(result).toMatchObject({
      pending_signout_reason: "forced_password_change",
    })
    expect(result).not.toHaveProperty("id")
    expect(result).not.toHaveProperty("username")
    expect(result).not.toHaveProperty("role")

    expect(authLifecycleLogs(consoleInfoSpy)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "token_invalidated_password_change",
          source: "jwt_callback",
          user_id: "42",
          username: "nqminh",
          tenant_id: "17",
          signout_reason: "forced_password_change",
          request_id: "jwt-req-42",
          ip_address: "198.51.100.9",
          user_agent: "VitestJwt/1.0",
        }),
      ])
    )
  })

  it("does not advance lastRefreshAt when the profile fetch fails", async () => {
    const now = Date.now()
    supabaseState.rpcRows = []
    supabaseState.rpcError = { message: "no row" }

    const token = {
      ...baseToken,
      loginTime: now - 5 * 60_000,
      lastRefreshAt: now - 5 * 60_000,
    }

    const result = await runJwt({ token })

    expect(supabaseClient.rpc).toHaveBeenCalled()
    expect(result).toMatchObject({
      id: "42",
      lastRefreshAt: now - 5 * 60_000, // still the old value
    })
  })

  it("emits profile_refresh_failed lifecycle log when the profile RPC fails", async () => {
    const now = Date.now()
    supabaseState.rpcRows = []
    supabaseState.rpcError = { message: "rpc boom" }

    await runJwt({
      token: {
        ...baseToken,
        loginTime: now - 5 * 60_000,
        lastRefreshAt: now - 5 * 60_000,
      },
    })

    expect(authLifecycleLogs(consoleInfoSpy)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "profile_refresh_failed",
          source: "jwt_callback",
          user_id: "42",
          username: "nqminh",
          tenant_id: "17",
          request_id: "jwt-req-42",
          ip_address: "198.51.100.9",
          user_agent: "VitestJwt/1.0",
        }),
      ])
    )
  })

  it("keeps steady-session profile refreshes at or below 0.05 RPC calls per jwt callback", async () => {
    const callbackCount = 40
    let token: JwtArgs["token"] = {
      ...baseToken,
      loginTime: Date.now() - 10 * 60_000,
      lastRefreshAt: Date.now(),
    }

    for (let index = 0; index < callbackCount; index += 1) {
      token = await runJwt({ token }) as JwtArgs["token"]
      vi.advanceTimersByTime(2_000)
    }

    const logs = authJwtTelemetryLogs(consoleInfoSpy)
    const jwtCallbackCount = logs.filter((log) => log.event === "jwt_callback_invoked").length
    const refreshAttemptCount = logs.filter((log) => log.event === "jwt_refresh_attempted").length

    expect(jwtCallbackCount).toBe(callbackCount)
    expect(refreshAttemptCount).toBe(1)
    expect(refreshAttemptCount / jwtCallbackCount).toBeLessThanOrEqual(0.05)
    expect(supabaseClient.rpc).toHaveBeenCalledTimes(refreshAttemptCount)
  })

  it("emits prod-safe telemetry for cooldown skip, forced refresh, and password-change invalidation", async () => {
    const now = Date.now()
    await runJwt({
      token: {
        ...baseToken,
        loginTime: now - 10_000,
        lastRefreshAt: now - 10_000,
      },
    })

    await runJwt({
      token: {
        ...baseToken,
        loginTime: now - 10_000,
        lastRefreshAt: now - 10_000,
      },
      trigger: "update",
    })

    supabaseState.rpcRows = [{
      ...profileRowDefault,
      password_changed_at: new Date(now - 5_000).toISOString(),
    }]
    await runJwt({
      token: {
        ...baseToken,
        loginTime: now - 10_000,
        lastRefreshAt: now - 5 * 60_000,
      },
    })

    const logs = authJwtTelemetryLogs(consoleInfoSpy)
    expect(logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "jwt_refresh_skipped_cooldown",
          userId: "42",
          refreshReason: "cooldown",
        }),
        expect.objectContaining({
          event: "jwt_refresh_forced_update_trigger",
          userId: "42",
          trigger: "update",
          refreshReason: "update_trigger",
        }),
        expect.objectContaining({
          event: "jwt_token_invalidated_password_change",
          userId: "42",
          invalidatedReason: "password_changed_after_login",
        }),
      ])
    )
    expect(JSON.stringify(logs)).not.toContain("nqminh")
    expect(JSON.stringify(logs)).not.toContain("Nguyen Quang Minh")
  })
})
