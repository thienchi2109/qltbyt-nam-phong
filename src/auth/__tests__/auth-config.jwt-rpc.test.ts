import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import jwt from "jsonwebtoken"

type RpcProfileRow = {
  password_changed_at: string | null
  current_don_vi: number | null
  don_vi: number | null
  khoa_phong: string | null
  full_name: string | null
  dia_ban_id: number | null
  ma_dia_ban: string | null
}

const rpcProfileRowDefault: RpcProfileRow = {
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
  rpcCalls: [] as Array<{ fn: string; args: unknown }>,
  createClientCalls: [] as Array<{ url: string; key: string; options: unknown }>,
  rpcRows: [] as unknown[],
  rpcError: null as unknown,
}))

const supabaseClient = vi.hoisted(() => ({
  from: vi.fn((table: string) => {
    supabaseState.fromCalls.push(table)
    return {
      select: () => ({
        eq: () => ({
          single: vi.fn(async () => ({ data: null, error: { message: `unexpected ${table}` } })),
          limit: vi.fn(async () => ({ data: [], error: { message: `unexpected ${table}` } })),
        }),
      }),
    }
  }),
  rpc: vi.fn(async (fn: string, args: unknown) => {
    supabaseState.rpcCalls.push({ fn, args })
    return {
      data: supabaseState.rpcError ? null : supabaseState.rpcRows,
      error: supabaseState.rpcError,
    }
  }),
}))

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn((url: string, key: string, options?: unknown) => {
    supabaseState.createClientCalls.push({ url, key, options })
    return supabaseClient
  }),
}))

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn(() => "signed-profile-jwt"),
  },
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

function getRefreshClientCall() {
  const call = supabaseState.createClientCalls.at(-1)
  if (!call) throw new Error("Supabase client was not created")
  return call
}

describe("authOptions.jwt session profile RPC refresh", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-02T12:00:00Z"))
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
    vi.stubEnv("SUPABASE_JWT_SECRET", "test-jwt-secret")
    supabaseState.fromCalls = []
    supabaseState.rpcCalls = []
    supabaseState.createClientCalls = []
    supabaseState.rpcRows = [{ ...rpcProfileRowDefault }]
    supabaseState.rpcError = null
    supabaseClient.from.mockClear()
    supabaseClient.rpc.mockClear()
    vi.mocked(jwt.sign).mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it("refreshes profile with one RPC and no table SELECT chain", async () => {
    const now = Date.now()
    const result = await runJwt({
      token: {
        ...baseToken,
        loginTime: now - 5 * 60_000,
        lastRefreshAt: now - 5 * 60_000,
        dia_ban_ma: null,
      },
    })

    expect(supabaseClient.rpc).toHaveBeenCalledTimes(1)
    expect(supabaseState.rpcCalls).toEqual([
      {
        fn: "get_session_profile_for_jwt",
        args: { p_user_id: "42" },
      },
    ])
    expect(supabaseClient.from).not.toHaveBeenCalled()
    expect(supabaseState.fromCalls).toEqual([])
    expect(result).toMatchObject({
      don_vi: 17,
      khoa_phong: "KT",
      full_name: "Nguyen Quang Minh",
      dia_ban_id: 9,
      dia_ban_ma: "HN-01",
      lastRefreshAt: now,
    })
  })

  it("uses anon key with signed Authorization header instead of service role", async () => {
    await runJwt({
      token: {
        ...baseToken,
        loginTime: Date.now() - 5 * 60_000,
        lastRefreshAt: Date.now() - 5 * 60_000,
      },
    })

    const refreshClientCall = getRefreshClientCall()

    expect(refreshClientCall.key).toBe("test-anon-key")
    expect(refreshClientCall.key).not.toBe("test-service-role-key")
    expect(refreshClientCall.options).toMatchObject({
      global: {
        headers: {
          Authorization: "Bearer signed-profile-jwt",
        },
      },
    })
  })

  it("signs a short-lived authenticated PostgREST JWT for the token user id", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000)

    await runJwt({
      token: {
        ...baseToken,
        loginTime: Date.now() - 5 * 60_000,
        lastRefreshAt: Date.now() - 5 * 60_000,
      },
    })

    expect(jwt.sign).toHaveBeenCalledWith(
      {
        role: "authenticated",
        iat: nowSeconds - 60,
        exp: nowSeconds + 120,
        sub: "42",
        user_id: "42",
        app_role: "to_qltb",
      },
      "test-jwt-secret",
      { algorithm: "HS256" }
    )
  })

  it("normalizes admin app_role before signing the refresh JWT", async () => {
    await runJwt({
      token: {
        ...baseToken,
        role: "admin",
        loginTime: Date.now() - 5 * 60_000,
        lastRefreshAt: Date.now() - 5 * 60_000,
      },
    })

    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        app_role: "global",
      }),
      "test-jwt-secret",
      { algorithm: "HS256" }
    )
  })

  it("fails closed when refresh JWT env is missing", async () => {
    vi.stubEnv("SUPABASE_JWT_SECRET", "")

    await expect(
      runJwt({
        token: {
          ...baseToken,
          loginTime: Date.now() - 5 * 60_000,
          lastRefreshAt: Date.now() - 5 * 60_000,
        },
      })
    ).rejects.toThrow("SUPABASE_JWT_SECRET is not configured")
  })

  it("fails closed when refresh anon key is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")

    await expect(
      runJwt({
        token: {
          ...baseToken,
          loginTime: Date.now() - 5 * 60_000,
          lastRefreshAt: Date.now() - 5 * 60_000,
        },
      })
    ).rejects.toThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured")
  })

  it("fails closed when token role is malformed", async () => {
    await expect(
      runJwt({
        token: {
          ...baseToken,
          role: {} as unknown as string,
          loginTime: Date.now() - 5 * 60_000,
          lastRefreshAt: Date.now() - 5 * 60_000,
        },
      })
    ).rejects.toThrow("JWT app_role is not configured")
  })
})
