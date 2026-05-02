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

  it("exposes a stable matcher config that protects /(app)/*", async () => {
    vi.stubEnv("NODE_ENV", "production")

    const mod = await loadMiddleware()

    expect(mod.config).toBeDefined()
    expect(mod.config.matcher).toEqual(expect.arrayContaining(["/(app)/(.*)"]))
  })
})
