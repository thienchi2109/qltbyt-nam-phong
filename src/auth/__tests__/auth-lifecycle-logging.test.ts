import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const sanitizerState = vi.hoisted(() => ({
  shouldThrow: false,
}))

const persistAuthLifecycleLogMock = vi.hoisted(() => vi.fn(async () => undefined))

vi.mock("@/lib/log-sanitizer", async () => {
  const actual = await vi.importActual<typeof import("@/lib/log-sanitizer")>("@/lib/log-sanitizer")

  return {
    ...actual,
    sanitizeForLog: vi.fn((value: unknown) => {
      if (sanitizerState.shouldThrow) {
        throw new Error("sanitize failed")
      }

      return actual.sanitizeForLog(value)
    }),
  }
})

vi.mock("@/auth/persistence", () => ({
  persistAuthLifecycleLog: persistAuthLifecycleLogMock,
}))

import {
  buildAuthLifecycleLog,
  emitAuthLifecycleLog,
} from "@/auth/logging"
import { recordAuthLifecycleEvent } from "@/auth/observability"

describe("auth lifecycle logging", () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-04T01:30:00Z"))
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined)
    sanitizerState.shouldThrow = false
    persistAuthLifecycleLogMock.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    consoleInfoSpy.mockRestore()
  })

  it("maps config_error to login_failure and redacts nested metadata", () => {
    const payload = buildAuthLifecycleLog({
      source: "authorize",
      username: "NQMinh",
      reason_code: "config_error",
      metadata: {
        password: "plaintext",
        nested: {
          token: "jwt-secret",
          keep: "visible",
        },
      },
    })

    expect(payload).toEqual({
      scope: "auth.lifecycle",
      ts: "2026-05-04T01:30:00.000Z",
      event: "login_failure",
      source: "authorize",
      username: "NQMinh",
      reason_code: "config_error",
      metadata: {
        password: "[REDACTED]",
        nested: {
          token: "[REDACTED]",
          keep: "visible",
        },
      },
    })
  })

  it("emits one structured JSON line per event", () => {
    emitAuthLifecycleLog({
      event: "profile_refresh_failed",
      source: "jwt_callback",
      user_id: "42",
      username: "nqminh",
      tenant_id: "17",
      metadata: {
        authorization: "Bearer private",
      },
    })

    expect(consoleInfoSpy).toHaveBeenCalledTimes(1)

    const [message] = consoleInfoSpy.mock.calls[0] ?? []
    expect(typeof message).toBe("string")
    expect(message?.includes("\n")).toBe(false)

    expect(JSON.parse(String(message))).toEqual({
      scope: "auth.lifecycle",
      ts: "2026-05-04T01:30:00.000Z",
      event: "profile_refresh_failed",
      source: "jwt_callback",
      user_id: "42",
      username: "nqminh",
      tenant_id: "17",
      metadata: {
        authorization: "[REDACTED]",
      },
    })
  })

  it("derives tenant_inactive from the reason_code contract", () => {
    const payload = buildAuthLifecycleLog({
      source: "authorize",
      reason_code: "tenant_inactive",
      username: "locked-user",
    })

    expect(payload).toEqual({
      scope: "auth.lifecycle",
      ts: "2026-05-04T01:30:00.000Z",
      event: "tenant_inactive",
      source: "authorize",
      reason_code: "tenant_inactive",
      username: "locked-user",
    })
  })

  it("swallows payload-build failures when emitting auth lifecycle logs", () => {
    sanitizerState.shouldThrow = true

    expect(() =>
      emitAuthLifecycleLog({
        source: "authorize",
        username: "nqminh",
      })
    ).not.toThrow()
    expect(consoleInfoSpy).not.toHaveBeenCalled()
  })

  it("keeps auth lifecycle recording fail-safe when payload building throws", async () => {
    sanitizerState.shouldThrow = true

    await expect(
      recordAuthLifecycleEvent({
        source: "jwt_callback",
        username: "nqminh",
      })
    ).resolves.toBeUndefined()

    expect(consoleInfoSpy).not.toHaveBeenCalled()
    expect(persistAuthLifecycleLogMock).not.toHaveBeenCalled()
  })
})
