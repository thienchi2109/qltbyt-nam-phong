import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const requestHeadersState = vi.hoisted(() => ({
  values: new Map<string, string>(),
}))

const supabaseState = vi.hoisted(() => ({
  rpcRows: [] as unknown[],
  rpcError: null as unknown,
}))

const supabaseClient = vi.hoisted(() => ({
  rpc: vi.fn(async () => ({
    data: supabaseState.rpcError ? null : supabaseState.rpcRows,
    error: supabaseState.rpcError,
  })),
}))

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

type AuthorizeFn = (credentials?: Record<string, unknown>, req?: Request) => Promise<unknown>
type SignInEvent = NonNullable<NonNullable<typeof authOptions.events>["signIn"]>
type SignOutEvent = NonNullable<NonNullable<typeof authOptions.events>["signOut"]>

type AuthLifecycleLog = {
  scope: string
  event: string
  source: string
  reason_code?: string
  signout_reason?: string
  user_id?: string
  username?: string
  tenant_id?: string
  request_id?: string | null
  ip_address?: string | null
  user_agent?: string | null
  metadata?: Record<string, unknown>
}

function getAuthorizeHandler(): AuthorizeFn {
  const provider = authOptions.providers.find(
    (
      candidate
    ): candidate is { options?: { authorize?: AuthorizeFn } } =>
      "options" in candidate && typeof candidate.options?.authorize === "function"
  )

  if (!provider) {
    throw new Error("credentials authorize handler not configured")
  }

  return provider.options!.authorize!
}

function getSignInEventHandler(): SignInEvent {
  const handler = authOptions.events?.signIn
  if (!handler) {
    throw new Error("signIn event handler not configured")
  }

  return handler
}

function getSignOutEventHandler(): SignOutEvent {
  const handler = authOptions.events?.signOut
  if (!handler) {
    throw new Error("signOut event handler not configured")
  }

  return handler
}

function authLifecycleLogs(infoSpy: ReturnType<typeof vi.spyOn>): AuthLifecycleLog[] {
  return infoSpy.mock.calls
    .map(([message]) => (typeof message === "string" ? message : ""))
    .filter((message) => message.includes("\"scope\":\"auth.lifecycle\""))
    .map((message) => JSON.parse(message) as AuthLifecycleLog)
}

function buildAuthorizeRequest() {
  return new Request("http://localhost/api/auth/callback/credentials", {
    headers: {
      "x-request-id": "req-123",
      "x-forwarded-for": "203.0.113.1, 10.0.0.1",
      "user-agent": "VitestBrowser/1.0",
    },
  })
}

describe("authOptions authorize + auth lifecycle events", () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-04T03:00:00Z"))
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined)
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
    requestHeadersState.values = new Map([
      ["x-request-id", "req-123"],
      ["x-forwarded-for", "203.0.113.1, 10.0.0.1"],
      ["user-agent", "VitestBrowser/1.0"],
    ])
    supabaseState.rpcRows = []
    supabaseState.rpcError = null
    supabaseClient.rpc.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    consoleInfoSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    consoleWarnSpy.mockRestore()
  })

  it("emits login_failure/config_error when auth env is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "")

    const authorize = getAuthorizeHandler()
    const result = await authorize({
      username: "NQMinh",
      password: "super-secret",
    }, buildAuthorizeRequest())

    expect(result).toBeNull()
    expect(authLifecycleLogs(consoleInfoSpy)).toEqual([
      expect.objectContaining({
        event: "login_failure",
        source: "authorize",
        reason_code: "config_error",
        username: "nqminh",
        request_id: "req-123",
        ip_address: "203.0.113.1",
        user_agent: "VitestBrowser/1.0",
      }),
    ])
    expect(JSON.stringify(authLifecycleLogs(consoleInfoSpy))).not.toContain("super-secret")
  })

  it("emits tenant_inactive when rpc auth says tenant is inactive", async () => {
    supabaseState.rpcRows = [{
      is_authenticated: false,
      authentication_mode: "tenant_inactive",
    }]

    const authorize = getAuthorizeHandler()

    await expect(authorize({
      username: "LOCKED.USER",
      password: "secret",
    }, buildAuthorizeRequest())).rejects.toThrow("tenant_inactive")

    expect(authLifecycleLogs(consoleInfoSpy)).toEqual([
      expect.objectContaining({
        event: "tenant_inactive",
        source: "authorize",
        reason_code: "tenant_inactive",
        username: "locked.user",
        request_id: "req-123",
      }),
    ])
  })

  it("emits login_success from events.signIn with lowercased username and no secrets", async () => {
    const signInEvent = getSignInEventHandler()

    await signInEvent({
      user: {
        id: "42",
        username: "NQMinh",
        don_vi: 17,
        password: "super-secret",
      } as never,
      account: null,
      isNewUser: false,
    })

    expect(authLifecycleLogs(consoleInfoSpy)).toEqual([
      expect.objectContaining({
        event: "login_success",
        source: "events_signin",
        user_id: "42",
        username: "nqminh",
        tenant_id: "17",
        request_id: "req-123",
        ip_address: "203.0.113.1",
        user_agent: "VitestBrowser/1.0",
      }),
    ])
    expect(JSON.stringify(authLifecycleLogs(consoleInfoSpy))).not.toContain("super-secret")
  })

  it("emits forced_signout/session_expired on signOut fallback and computes session duration", async () => {
    const signOutEvent = getSignOutEventHandler()

    await signOutEvent({
      token: {
        id: "42",
        username: "nqminh",
        don_vi: 17,
        loginTime: Date.now() - 120_000,
      } as never,
      session: undefined as never,
    })

    expect(authLifecycleLogs(consoleInfoSpy)).toEqual([
      expect.objectContaining({
        event: "forced_signout",
        source: "events_signout",
        signout_reason: "session_expired",
        user_id: "42",
        username: "nqminh",
        tenant_id: "17",
        request_id: "req-123",
        metadata: expect.objectContaining({
          session_duration_ms: 120000,
        }),
      }),
    ])
  })

  it("skips signOut emission for probe traffic with no token identity or reason", async () => {
    const signOutEvent = getSignOutEventHandler()

    await signOutEvent({
      token: {} as never,
      session: undefined as never,
    })

    expect(authLifecycleLogs(consoleInfoSpy)).toEqual([])
  })
})
