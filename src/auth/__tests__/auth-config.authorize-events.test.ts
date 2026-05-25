import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const requestHeadersState = vi.hoisted(() => ({
  values: new Map<string, string>(),
}))

const supabaseState = vi.hoisted(() => ({
  authRpcRows: [] as unknown[],
  authRpcError: null as unknown,
  auditRpcError: null as unknown,
  throttleCheckRows: [] as unknown[],
  throttleCheckError: null as unknown,
  throttleRecordFailureData: true as boolean | null,
  throttleRecordFailureError: null as unknown,
  throttleRecordSuccessData: true as boolean | null,
  throttleRecordSuccessError: null as unknown,
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
}))

const supabaseClient = vi.hoisted(() => ({
  rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
    supabaseState.rpcCalls.push({ fn, args })

    if (fn === "authenticate_user_dual_mode") {
      return {
        data: supabaseState.authRpcError ? null : supabaseState.authRpcRows,
        error: supabaseState.authRpcError,
      }
    }

    if (fn === "auth_audit_log_insert") {
      return {
        data: supabaseState.auditRpcError ? null : true,
        error: supabaseState.auditRpcError,
      }
    }

    if (fn === "auth_login_throttle_check") {
      return {
        data: supabaseState.throttleCheckError ? null : supabaseState.throttleCheckRows,
        error: supabaseState.throttleCheckError,
      }
    }

    if (fn === "auth_login_throttle_record_failure") {
      return {
        data: supabaseState.throttleRecordFailureError ? null : supabaseState.throttleRecordFailureData,
        error: supabaseState.throttleRecordFailureError,
      }
    }

    if (fn === "auth_login_throttle_record_success") {
      return {
        data: supabaseState.throttleRecordSuccessError ? null : supabaseState.throttleRecordSuccessData,
        error: supabaseState.throttleRecordSuccessError,
      }
    }

    return {
      data: null,
      error: { message: `unexpected rpc ${fn}` },
    }
  }),
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

type DeferredRpcResult = {
  promise: Promise<{ data: boolean | null; error: unknown }>
  resolve: (result: { data: boolean | null; error: unknown }) => void
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
      "x-real-ip": "203.0.113.1",
      "x-forwarded-for": "198.51.100.99, 10.0.0.1",
      "user-agent": "VitestBrowser/1.0",
    },
  })
}

function createDeferredRpcResult(): DeferredRpcResult {
  let resolve!: DeferredRpcResult["resolve"]
  const promise = new Promise<{ data: boolean | null; error: unknown }>((innerResolve) => {
    resolve = innerResolve
  })

  return { promise, resolve }
}

async function flushMicrotasks(count = 3) {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve()
  }
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
      ["x-real-ip", "203.0.113.1"],
      ["x-forwarded-for", "198.51.100.99, 10.0.0.1"],
      ["user-agent", "VitestBrowser/1.0"],
    ])
    supabaseState.authRpcRows = []
    supabaseState.authRpcError = null
    supabaseState.auditRpcError = null
    supabaseState.throttleCheckRows = [{
      allowed: true,
      blocked_until: null,
      retry_after_seconds: 0,
      blocked_scope: null,
    }]
    supabaseState.throttleCheckError = null
    supabaseState.throttleRecordFailureData = true
    supabaseState.throttleRecordFailureError = null
    supabaseState.throttleRecordSuccessData = true
    supabaseState.throttleRecordSuccessError = null
    supabaseState.rpcCalls = []
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
    supabaseState.authRpcRows = [{
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

  it("emits authorize_exception for unexpected runtime errors before rethrowing", async () => {
    const runtimeError = new Error("database exploded")
    supabaseClient.rpc.mockImplementationOnce(async (fn: string, args: Record<string, unknown>) => {
      supabaseState.rpcCalls.push({ fn, args })
      return {
        data: supabaseState.throttleCheckRows,
        error: null,
      }
    })
    supabaseClient.rpc.mockImplementationOnce(async () => {
      throw runtimeError
    })

    const authorize = getAuthorizeHandler()

    await expect(authorize({
      username: "NQMinh",
      password: "secret",
    }, buildAuthorizeRequest())).rejects.toThrow("database exploded")

    expect(authLifecycleLogs(consoleInfoSpy)).toEqual([
      expect.objectContaining({
        event: "login_failure",
        source: "authorize",
        reason_code: "authorize_exception",
        username: "nqminh",
        request_id: "req-123",
        ip_address: "203.0.113.1",
        user_agent: "VitestBrowser/1.0",
        metadata: expect.objectContaining({
          error_message: "database exploded",
        }),
      }),
    ])
  })

  it("keeps authorize outcome stable when the auth audit sink insert fails", async () => {
    supabaseState.authRpcRows = [{
      is_authenticated: false,
      authentication_mode: "tenant_inactive",
    }]
    supabaseState.auditRpcError = { message: "audit insert failed" }

    const authorize = getAuthorizeHandler()

    await expect(authorize({
      username: "LOCKED.USER",
      password: "secret",
    }, buildAuthorizeRequest())).rejects.toThrow("tenant_inactive")

    expect(supabaseState.rpcCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fn: "auth_audit_log_insert",
        }),
      ])
    )
  })

  it("blocks credentials before password verification when login throttle denies the request", async () => {
    supabaseState.throttleCheckRows = [{
      allowed: false,
      blocked_until: "2026-05-04T03:30:00.000Z",
      retry_after_seconds: 1800,
      blocked_scope: "username_ip",
    }]

    const authorize = getAuthorizeHandler()

    await expect(authorize({
      username: "LOCKED.USER",
      password: "secret",
    }, buildAuthorizeRequest())).rejects.toThrow("rate_limited")

    expect(supabaseState.rpcCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fn: "auth_login_throttle_check",
          args: expect.objectContaining({
            p_username: "locked.user",
            p_ip_address: "203.0.113.1",
          }),
        }),
        expect.objectContaining({
          fn: "auth_audit_log_insert",
          args: expect.objectContaining({
            p_event: "login_failure",
            p_source: "authorize",
            p_reason_code: "rate_limited",
            p_username: "locked.user",
            p_ip_address: "203.0.113.1",
            p_metadata: expect.objectContaining({
              blocked_scope: "username_ip",
              retry_after_seconds: 1800,
            }),
          }),
        }),
      ])
    )
    expect(supabaseState.rpcCalls).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fn: "authenticate_user_dual_mode" }),
      ])
    )
  })

  it("records throttle failure after invalid credentials", async () => {
    const authorize = getAuthorizeHandler()

    await expect(authorize({
      username: "NQMinh",
      password: "wrong-password",
    }, buildAuthorizeRequest())).rejects.toThrow("invalid_credentials")

    expect(supabaseState.rpcCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fn: "authenticate_user_dual_mode" }),
        expect.objectContaining({
          fn: "auth_login_throttle_record_failure",
          args: expect.objectContaining({
            p_username: "nqminh",
            p_ip_address: "203.0.113.1",
          }),
        }),
      ])
    )
  })

  it("warns when throttle failure accounting returns false", async () => {
    supabaseState.throttleRecordFailureData = false
    const authorize = getAuthorizeHandler()

    await expect(authorize({
      username: "NQMinh",
      password: "wrong-password",
    }, buildAuthorizeRequest())).rejects.toThrow("invalid_credentials")

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Login throttle failure record failed",
      expect.objectContaining({
        error: expect.any(Error),
      })
    )
  })

  it("resets the username throttle bucket after successful credentials", async () => {
    supabaseState.authRpcRows = [{
      is_authenticated: true,
      user_id: 42,
      username: "NQMinh",
      full_name: "Nguyen Quang Minh",
      role: "to_qltb",
      khoa_phong: "CNTT",
      don_vi: 17,
      authentication_mode: "hashed",
    }]

    const authorize = getAuthorizeHandler()

    await expect(authorize({
      username: "NQMinh",
      password: "correct-password",
    }, buildAuthorizeRequest())).resolves.toEqual(
      expect.objectContaining({
        id: "42",
        username: "NQMinh",
        auth_mode: "hashed",
      })
    )

    expect(supabaseState.rpcCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fn: "auth_login_throttle_record_success",
          args: expect.objectContaining({
            p_username: "nqminh",
            p_ip_address: "203.0.113.1",
          }),
        }),
      ])
    )
  })

  it("warns when throttle success reset returns false", async () => {
    supabaseState.throttleRecordSuccessData = false
    supabaseState.authRpcRows = [{
      is_authenticated: true,
      user_id: 42,
      username: "NQMinh",
      full_name: "Nguyen Quang Minh",
      role: "to_qltb",
      khoa_phong: "CNTT",
      don_vi: 17,
      authentication_mode: "hashed",
    }]
    const authorize = getAuthorizeHandler()

    await expect(authorize({
      username: "NQMinh",
      password: "correct-password",
    }, buildAuthorizeRequest())).resolves.toEqual(
      expect.objectContaining({
        id: "42",
        username: "NQMinh",
      })
    )

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Login throttle success reset failed",
      expect.objectContaining({
        error: expect.any(Error),
      })
    )
  })

  it("fails open when login throttle check is unavailable", async () => {
    supabaseState.throttleCheckError = { message: "throttle unavailable" }
    supabaseState.authRpcRows = [{
      is_authenticated: true,
      user_id: 42,
      username: "NQMinh",
      role: "to_qltb",
      authentication_mode: "hashed",
    }]

    const authorize = getAuthorizeHandler()

    await expect(authorize({
      username: "NQMinh",
      password: "correct-password",
    }, buildAuthorizeRequest())).resolves.toEqual(
      expect.objectContaining({
        id: "42",
        username: "NQMinh",
      })
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Login throttle check failed",
      expect.objectContaining({ error: supabaseState.throttleCheckError })
    )
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
    await flushMicrotasks()

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
    expect(supabaseState.rpcCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fn: "auth_audit_log_insert",
          args: expect.objectContaining({
            p_event: "login_success",
            p_source: "events_signin",
            p_user_id: "42",
            p_username: "nqminh",
            p_tenant_id: "17",
            p_request_id: "req-123",
            p_ip_address: "203.0.113.1",
            p_user_agent: "VitestBrowser/1.0",
          }),
        }),
      ])
    )
    expect(JSON.stringify(authLifecycleLogs(consoleInfoSpy))).not.toContain("super-secret")
  })

  it("does not block signIn completion on auth audit persistence", async () => {
    const signInEvent = getSignInEventHandler()
    const deferredAuditInsert = createDeferredRpcResult()

    supabaseClient.rpc.mockImplementationOnce(async (fn: string, args: Record<string, unknown>) => {
      supabaseState.rpcCalls.push({ fn, args })

      if (fn === "auth_audit_log_insert") {
        return deferredAuditInsert.promise
      }

      return {
        data: null,
        error: { message: `unexpected rpc ${fn}` },
      }
    })

    const signInPromise = signInEvent({
      user: {
        id: "42",
        username: "NQMinh",
        don_vi: 17,
      } as never,
      account: null,
      isNewUser: false,
    })

    const settled = vi.fn()
    void signInPromise.then(settled)
    await Promise.resolve()
    expect(settled).toHaveBeenCalledTimes(1)

    deferredAuditInsert.resolve({ data: true, error: null })
    await signInPromise
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
    expect(supabaseState.rpcCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fn: "auth_audit_log_insert",
          args: expect.objectContaining({
            p_event: "forced_signout",
            p_source: "events_signout",
            p_signout_reason: "session_expired",
            p_user_id: "42",
            p_metadata: expect.objectContaining({
              session_duration_ms: 120000,
            }),
          }),
        }),
      ])
    )
  })

  it("emits signout/user_initiated when signOut receives a persisted user intent", async () => {
    const signOutEvent = getSignOutEventHandler()

    await signOutEvent({
      token: {
        id: "42",
        username: "nqminh",
        don_vi: 17,
        loginTime: Date.now() - 30_000,
        pending_signout_reason: "user_initiated",
      } as never,
      session: undefined as never,
    })

    expect(authLifecycleLogs(consoleInfoSpy)).toEqual([
      expect.objectContaining({
        event: "signout",
        source: "events_signout",
        signout_reason: "user_initiated",
        user_id: "42",
        username: "nqminh",
        tenant_id: "17",
        request_id: "req-123",
        metadata: expect.objectContaining({
          session_duration_ms: 30000,
        }),
      }),
    ])
    expect(supabaseState.rpcCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fn: "auth_audit_log_insert",
          args: expect.objectContaining({
            p_event: "signout",
            p_source: "events_signout",
            p_signout_reason: "user_initiated",
            p_user_id: "42",
          }),
        }),
      ])
    )
  })

  it("falls back to augmented session fields when signOut token no longer carries auth claims", async () => {
    const signOutEvent = getSignOutEventHandler()

    await signOutEvent({
      token: {
        loginTime: Date.now() - 60_000,
      } as never,
      session: {
        user: {
          id: "42",
          username: "NQMinh",
          don_vi: 17,
          name: "Nguyen Quang Minh",
        },
      } as never,
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
          session_duration_ms: 60000,
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
