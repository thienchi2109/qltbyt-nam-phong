import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const withAuthMock = vi.hoisted(() =>
  vi.fn((handler: unknown, _options: unknown) => handler),
)

vi.mock("next-auth/middleware", () => ({
  withAuth: withAuthMock,
}))

vi.mock("next/server", () => ({
  NextResponse: {
    next: () => ({ type: "next" }),
    redirect: (url: unknown) => ({ type: "redirect", url }),
  },
}))

async function loadMiddleware() {
  vi.resetModules()
  return import("@/middleware")
}

describe("auth middleware kill switch", () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    vi.unstubAllEnvs()
  })

  it("enforces withAuth in production even when AUTH_MIDDLEWARE_ENABLED=false", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("AUTH_MIDDLEWARE_ENABLED", "false")

    await loadMiddleware()

    expect(withAuthMock).toHaveBeenCalledTimes(1)
    expect(consoleErrorSpy).toHaveBeenCalled()
    const errorMessage = String(consoleErrorSpy.mock.calls[0]?.[0] ?? "")
    expect(errorMessage).toMatch(/AUTH_MIDDLEWARE_ENABLED/)
    expect(errorMessage).toMatch(/ignored/i)
  })

  it("enforces withAuth in production when AUTH_MIDDLEWARE_ENABLED is unset", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("AUTH_MIDDLEWARE_ENABLED", "")

    await loadMiddleware()

    expect(withAuthMock).toHaveBeenCalledTimes(1)
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it("disables withAuth in non-production when AUTH_MIDDLEWARE_ENABLED=false and warns", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("AUTH_MIDDLEWARE_ENABLED", "false")

    await loadMiddleware()

    expect(withAuthMock).not.toHaveBeenCalled()
    expect(consoleWarnSpy).toHaveBeenCalled()
    const warnMessage = String(consoleWarnSpy.mock.calls[0]?.[0] ?? "")
    expect(warnMessage).toMatch(/AUTH_MIDDLEWARE_ENABLED/)
    expect(warnMessage).toMatch(/disabled/i)
  })

  it("enforces withAuth in non-production when AUTH_MIDDLEWARE_ENABLED is unset", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("AUTH_MIDDLEWARE_ENABLED", "")

    await loadMiddleware()

    expect(withAuthMock).toHaveBeenCalledTimes(1)
    expect(consoleWarnSpy).not.toHaveBeenCalled()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it("enforces withAuth in non-production when AUTH_MIDDLEWARE_ENABLED=true", async () => {
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("AUTH_MIDDLEWARE_ENABLED", "true")

    await loadMiddleware()

    expect(withAuthMock).toHaveBeenCalledTimes(1)
    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it("authorizes only tokens with a user id", async () => {
    vi.stubEnv("NODE_ENV", "production")

    await loadMiddleware()

    const options = withAuthMock.mock.calls[0]?.[1] as {
      callbacks?: {
        authorized?: (args: { token: { id?: string } | null }) => boolean
      }
    }
    const authorized = options.callbacks?.authorized

    expect(authorized?.({ token: { id: "42" } })).toBe(true)
    expect(authorized?.({ token: {} })).toBe(false)
    expect(authorized?.({ token: null })).toBe(false)
  })

  describe("matcher config", () => {
    async function loadMatcher() {
      vi.stubEnv("NODE_ENV", "production")
      const mod = await loadMiddleware()
      const matcher = Array.isArray(mod.config.matcher)
        ? mod.config.matcher
        : [mod.config.matcher]
      const regexes = matcher.map(
        (pattern: string) => new RegExp(`^${pattern}$`),
      )
      return (pathname: string) => regexes.some((re) => re.test(pathname))
    }

    // Real URLs (route groups like (app) do NOT appear in the URL path,
    // so the previous "/(app)/(.*)" matcher was ineffective for these).
    const protectedPaths = [
      "/dashboard",
      "/equipment",
      "/equipment/123",
      "/repair-requests",
      "/repair-requests/new",
      "/maintenance",
      "/transfers",
      "/device-quota",
      "/reports",
      "/qr-scanner",
      "/activity-logs",
      "/tenants",
      "/users",
    ]

    const publicPaths = [
      "/",
      "/api/auth/callback/credentials",
      "/api/rpc/foo",
      "/_next/static/chunks/main.js",
      "/_next/image",
      "/favicon.ico",
      "/manifest.json",
      "/assets/logo.svg",
    ]

    it.each(protectedPaths)("matcher includes protected path %s", async (p) => {
      const matches = await loadMatcher()
      expect(matches(p)).toBe(true)
    })

    it.each(publicPaths)("matcher excludes public path %s", async (p) => {
      const matches = await loadMatcher()
      expect(matches(p)).toBe(false)
    })
  })
})
