import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Build a chainable Supabase mock that records every .from() call.
type ProfileRow = {
  password_changed_at: string | null
  current_don_vi: number | null
  don_vi: number | null
  khoa_phong: string | null
  full_name: string | null
  dia_ban_id: number | null
}

const profileRowDefault: ProfileRow = {
  password_changed_at: null,
  current_don_vi: 17,
  don_vi: 17,
  khoa_phong: "KT",
  full_name: "Nguyen Quang Minh",
  dia_ban_id: 9,
}

type QueryResult = { data: unknown; error: unknown }
type Resolver = () => Promise<QueryResult>

// Build the chain `from(table).select().eq(...).single|limit(...)` from a
// single async resolver so the deepest user code sits at one level of nesting
// instead of four. Tests configure responses through `supabaseState` below.
function buildChain(resolver: Resolver, method: "single" | "limit") {
  const terminal = vi.fn(resolver)
  return {
    select: () => ({
      eq: () => ({ [method]: terminal }),
    }),
  }
}

const supabaseState = vi.hoisted(() => ({
  fromCalls: [] as string[],
  profileRow: null as unknown,
  donViRows: [] as unknown[],
  donViError: null as unknown,
  diaBanMaRows: [] as unknown[],
  diaBanError: null as unknown,
}))

const resolvers = vi.hoisted(() => ({
  nhanVien: async () => ({
    data: supabaseState.profileRow,
    error: supabaseState.profileRow ? null : { message: "no row" },
  }),
  donVi: async () => ({
    data: supabaseState.donViError ? null : supabaseState.donViRows,
    error: supabaseState.donViError,
  }),
  diaBan: async () => ({
    data: supabaseState.diaBanError ? null : supabaseState.diaBanMaRows,
    error: supabaseState.diaBanError,
  }),
  unknownLimit: async () => ({ data: [], error: null }),
  unknownSingle: async () => ({ data: null, error: null }),
}))

const supabaseClient = vi.hoisted(() => ({
  from: vi.fn((table: string) => {
    supabaseState.fromCalls.push(table)
    if (table === "nhan_vien") return buildChain(resolvers.nhanVien, "single")
    if (table === "don_vi") return buildChain(resolvers.donVi, "limit")
    if (table === "dia_ban") return buildChain(resolvers.diaBan, "limit")
    return {
      select: () => ({
        eq: () => ({
          limit: vi.fn(resolvers.unknownLimit),
          single: vi.fn(resolvers.unknownSingle),
        }),
      }),
    }
  }),
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
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
    supabaseState.fromCalls = []
    supabaseState.profileRow = { ...profileRowDefault }
    supabaseState.donViRows = [{ dia_ban_id: 9 }]
    supabaseState.donViError = null
    supabaseState.diaBanMaRows = [{ ma_dia_ban: "HN-01" }]
    supabaseState.diaBanError = null
    supabaseClient.from.mockClear()
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

    expect(supabaseState.fromCalls).toContain("nhan_vien")
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

    expect(supabaseClient.from).not.toHaveBeenCalled()
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

    expect(supabaseClient.from).toHaveBeenCalled()
    expect(supabaseState.fromCalls).toContain("nhan_vien")
    expect(result).toMatchObject({ lastRefreshAt: now })
  })

  it("force-refreshes when trigger === 'update' even within cooldown", async () => {
    const now = Date.now()
    supabaseState.profileRow = {
      ...profileRowDefault,
      current_don_vi: 99,
      don_vi: 99,
    }
    const token = {
      ...baseToken,
      loginTime: now - 10_000,
      lastRefreshAt: now - 10_000,
    }

    const result = await runJwt({ token, trigger: "update" })

    expect(supabaseClient.from).toHaveBeenCalled()
    expect(result).toMatchObject({
      don_vi: 99,
      lastRefreshAt: now,
    })
  })

  it("returns the token untouched when token has no id (anonymous)", async () => {
    const result = await runJwt({ token: { name: "anon" } as JwtArgs["token"] })

    expect(supabaseClient.from).not.toHaveBeenCalled()
    expect(result).toEqual({ name: "anon" })
  })

  it("invalidates token when password_changed_at is after loginTime (no cooldown bypass)", async () => {
    const now = Date.now()
    const loginTime = now - 60 * 60_000 // 1h ago
    const passwordChangedAt = new Date(now - 5 * 60_000).toISOString() // 5min ago
    supabaseState.profileRow = {
      ...profileRowDefault,
      password_changed_at: passwordChangedAt,
    }

    const token = {
      ...baseToken,
      loginTime,
      lastRefreshAt: now - 5 * 60_000, // cooldown elapsed → fetch runs
    }

    const result = await runJwt({ token })

    expect(supabaseClient.from).toHaveBeenCalled()
    expect(result).toEqual({})
  })

  it("does not advance lastRefreshAt when the profile fetch fails", async () => {
    const now = Date.now()
    supabaseState.profileRow = null // forces error path

    const token = {
      ...baseToken,
      loginTime: now - 5 * 60_000,
      lastRefreshAt: now - 5 * 60_000,
    }

    const result = await runJwt({ token })

    expect(supabaseClient.from).toHaveBeenCalled()
    expect(result).toMatchObject({
      id: "42",
      lastRefreshAt: now - 5 * 60_000, // still the old value
    })
  })

  it("logs and skips lastRefreshAt stamp when don_vi secondary lookup returns an error", async () => {
    const now = Date.now()
    // Primary row forces the don_vi lookup: dia_ban_id null but don_vi set
    supabaseState.profileRow = {
      ...profileRowDefault,
      dia_ban_id: null,
      current_don_vi: 17,
      don_vi: 17,
    }
    supabaseState.donViError = { message: "don_vi table boom" }
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const prevRefresh = now - 5 * 60_000

    const token = {
      ...baseToken,
      dia_ban_id: null,
      loginTime: now - 60 * 60_000,
      lastRefreshAt: prevRefresh,
    }

    const result = await runJwt({ token })

    expect(supabaseState.fromCalls).toContain("don_vi")
    expect(warnSpy).toHaveBeenCalled()
    const logged = warnSpy.mock.calls
      .map((args) => args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "))
      .join("\n")
    expect(logged).toMatch(/don_vi/)
    expect(result).toMatchObject({
      id: "42",
      lastRefreshAt: prevRefresh, // not advanced
    })
    warnSpy.mockRestore()
  })

  it("logs and skips lastRefreshAt stamp when dia_ban secondary lookup returns an error", async () => {
    const now = Date.now()
    supabaseState.diaBanError = { message: "dia_ban table boom" }
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const prevRefresh = now - 5 * 60_000

    const token = {
      ...baseToken,
      dia_ban_ma: null, // ensure the dia_ban lookup runs
      loginTime: now - 60 * 60_000,
      lastRefreshAt: prevRefresh,
    }

    const result = await runJwt({ token })

    expect(supabaseState.fromCalls).toContain("dia_ban")
    expect(warnSpy).toHaveBeenCalled()
    const logged = warnSpy.mock.calls
      .map((args) => args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "))
      .join("\n")
    expect(logged).toMatch(/dia_ban/)
    expect(result).toMatchObject({
      id: "42",
      lastRefreshAt: prevRefresh, // not advanced
    })
    warnSpy.mockRestore()
  })
})
