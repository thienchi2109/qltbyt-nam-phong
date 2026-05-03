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

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => supabaseClient),
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

describe("authOptions.jwt cooldown + trigger gate", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-02T12:00:00Z"))
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
    vi.stubEnv("SUPABASE_JWT_SECRET", "test-jwt-secret")
    supabaseState.fromCalls = []
    supabaseState.rpcRows = [{ ...profileRowDefault }]
    supabaseState.rpcError = null
    supabaseClient.from.mockClear()
    supabaseClient.rpc.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
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
})
