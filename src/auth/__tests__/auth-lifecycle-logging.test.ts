import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  buildAuthLifecycleLog,
  emitAuthLifecycleLog,
} from "@/auth/logging"

describe("auth lifecycle logging", () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-04T01:30:00Z"))
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined)
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
})
