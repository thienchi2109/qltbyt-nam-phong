import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const withAuthMock = vi.hoisted(() => vi.fn((handler: unknown, _options: unknown) => handler))
const nextResponseNextMock = vi.hoisted(() => vi.fn(() => ({ type: "next" })))
const nextResponseRedirectMock = vi.hoisted(() =>
  vi.fn((url: unknown) => ({ type: "redirect", url }))
)

vi.mock("next-auth/middleware", () => ({
  withAuth: withAuthMock,
}))

vi.mock("next/server", () => ({
  NextResponse: {
    next: nextResponseNextMock,
    redirect: nextResponseRedirectMock,
  },
}))

async function loadMiddleware() {
  vi.resetModules()
  return import("@/middleware")
}

type MiddlewareToken = {
  id?: string
  role?: string
}

type MiddlewareHandler = (request: {
  nextauth?: { token?: MiddlewareToken }
  nextUrl: {
    pathname: string
    search: string
    searchParams: URLSearchParams
    clone: () => URL
  }
}) => unknown

function createMiddlewareRequest(path: string, token: MiddlewareToken) {
  const url = new URL(path, "https://example.test")

  return {
    nextauth: { token },
    nextUrl: {
      pathname: url.pathname,
      search: url.search,
      searchParams: url.searchParams,
      clone: () => new URL(url),
    },
  }
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

  it("authorizes tokens with a user id and unmapped public static assets", async () => {
    vi.stubEnv("NODE_ENV", "production")

    await loadMiddleware()

    const options = withAuthMock.mock.calls[0]?.[1] as {
      callbacks?: {
        authorized?: (args: {
          token: { id?: string } | null
          req: { nextUrl: { pathname: string } }
        }) => boolean
      }
    }
    const authorized = options.callbacks?.authorized
    const protectedRequest = { nextUrl: { pathname: "/dashboard" } }
    const nextDataRequest = { nextUrl: { pathname: "/_next/data/abc/dashboard.json" } }
    const staticAssetRequest = { nextUrl: { pathname: "/login-illustration.png" } }

    expect(authorized?.({ token: { id: "42" }, req: protectedRequest })).toBe(true)
    expect(authorized?.({ token: {}, req: protectedRequest })).toBe(false)
    expect(authorized?.({ token: null, req: protectedRequest })).toBe(false)
    expect(authorized?.({ token: null, req: nextDataRequest })).toBe(false)
    expect(authorized?.({ token: null, req: staticAssetRequest })).toBe(true)
  })

  describe("route-level RBAC", () => {
    async function loadHandler() {
      vi.stubEnv("NODE_ENV", "production")
      await loadMiddleware()
      return withAuthMock.mock.calls[0]?.[0] as MiddlewareHandler
    }

    it("redirects a denied role before the target route continues", async () => {
      const handler = await loadHandler()

      const response = handler(
        createMiddlewareRequest("/users?tab=active", {
          id: "42",
          role: "user",
        })
      )

      expect(response).toEqual({
        type: "redirect",
        url: expect.any(URL),
      })
      expect(nextResponseNextMock).not.toHaveBeenCalled()

      const redirectUrl = nextResponseRedirectMock.mock.calls[0]?.[0] as URL
      expect(redirectUrl.pathname).toBe("/access-denied")
      expect(redirectUrl.search).toBe("")
    })

    it.each([
      ["/users", "admin"],
      ["/technical-configurations/dossiers", "global"],
      ["/technical-configurations/dossiers/123.pdf", "chuyen_gia"],
      ["/device-quota/categories", "regional_leader"],
      ["/device-quota/decisions/123", "to_qltb"],
      ["/dashboard", "user"],
      ["/access-denied", "user"],
      ["/access-denied", "chuyen_gia"],
      ["/not-a-real-page", "chuyen_gia"],
      ["/_next/data/abc/dashboard.json", "chuyen_gia"],
    ])("allows %s to continue for role %s", async (pathname, role) => {
      const handler = await loadHandler()

      const response = handler(
        createMiddlewareRequest(pathname, {
          id: "42",
          role,
        })
      )

      expect(response).toEqual({ type: "next" })
      expect(nextResponseRedirectMock).not.toHaveBeenCalled()
    })

    it.each([
      "/dashboard",
      "/equipment",
      "/forms/handover",
      "/maintenance",
      "/qr-scanner",
      "/repair-requests",
      "/reports",
      "/transfers",
      "/activity-logs",
      "/tenants",
      "/users",
      "/device-quota/categories",
      "/device-quota/decisions/123.pdf",
    ])("redirects an expert away from mapped non-module route %s", async (pathname) => {
      const handler = await loadHandler()

      const response = handler(
        createMiddlewareRequest(`${pathname}?returnTo=hidden`, {
          id: "42",
          role: "chuyen_gia",
        })
      )

      expect(response).toEqual({
        type: "redirect",
        url: expect.any(URL),
      })

      const redirectUrl = nextResponseRedirectMock.mock.calls[0]?.[0] as URL
      expect(redirectUrl.pathname).toBe("/access-denied")
      expect(redirectUrl.search).toBe("")
    })

    it("fails closed for a protected route when the role claim is missing", async () => {
      const handler = await loadHandler()

      const response = handler(
        createMiddlewareRequest("/activity-logs", {
          id: "42",
        })
      )

      expect(response).toEqual({
        type: "redirect",
        url: expect.any(URL),
      })
    })

    it("lets an unmapped public static asset continue without authentication", async () => {
      const handler = await loadHandler()

      const response = handler(createMiddlewareRequest("/login-illustration.png", {}))

      expect(response).toEqual({ type: "next" })
    })

    it("does not treat a Next data request as a public static asset", async () => {
      const handler = await loadHandler()

      const response = handler(createMiddlewareRequest("/_next/data/abc/dashboard.json", {}))

      expect(response).toEqual({
        type: "redirect",
        url: expect.any(URL),
      })
    })
  })

  describe("matcher config", () => {
    async function loadMatcher() {
      vi.stubEnv("NODE_ENV", "production")
      const mod = await loadMiddleware()
      const { unstable_doesMiddlewareMatch } = await import("next/experimental/testing/server")

      return (pathname: string) =>
        unstable_doesMiddlewareMatch({
          config: mod.config,
          url: new URL(pathname, "https://example.test").toString(),
        })
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
      "/device-quota/decisions/123.pdf",
      "/_next/data/abc/dashboard.json",
      "/technical-configurations",
      "/technical-configurations/dossiers/123.pdf",
      "/not-a-real-page",
      "/reports",
      "/qr-scanner",
      "/activity-logs",
      "/tenants",
      "/users",
    ]

    const matcherExcludedPaths = [
      "/",
      "/api/auth/callback/credentials",
      "/api/rpc/foo",
      "/_next/static/chunks/main.js",
      "/_next/image",
      "/favicon.ico",
      "/manifest.json",
      "/assets/logo.svg",
      "/sw.js",
      "/workbox-runtime.js",
      "/icons/icon-192x192.png",
      "/icons/icon-maskable-512x512.png",
      "/screenshots/placeholder-mobile.png",
    ]

    const middlewareBypassedStaticPaths = [
      "/Logo master.png",
      "/login-illustration.png",
      "/robots.txt",
      "/sitemap.xml",
      "/some/nested/example.webp",
      "/deeply/nested/path/with.dots/resource.svg",
    ]

    it.each(protectedPaths)("matcher includes protected path %s", async (p) => {
      const matches = await loadMatcher()
      expect(matches(p)).toBe(true)
    })

    it.each(matcherExcludedPaths)("matcher excludes infrastructure path %s", async (p) => {
      const matches = await loadMatcher()
      expect(matches(p)).toBe(false)
    })

    it.each(middlewareBypassedStaticPaths)(
      "matcher includes static-looking path %s for policy-aware bypass",
      async (p) => {
        const matches = await loadMatcher()
        expect(matches(p)).toBe(true)
      }
    )
  })
})
