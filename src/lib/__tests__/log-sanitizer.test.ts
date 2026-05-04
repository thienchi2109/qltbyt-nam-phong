import { describe, expect, it } from "vitest"

import { sanitizeForLog } from "@/lib/log-sanitizer"

describe("sanitizeForLog", () => {
  it("deeply redacts nested sensitive keys across objects and arrays", () => {
    const result = sanitizeForLog({
      username: "nqminh",
      password: "super-secret",
      nested: {
        token: "jwt-token",
        profile: {
          api_key: "internal-key",
          keep: "visible",
        },
      },
      attempts: [
        {
          authorization: "Bearer abc",
        },
        {
          mat_khau: "mat-khau",
        },
      ],
    })

    expect(result).toEqual({
      username: "nqminh",
      password: "[REDACTED]",
      nested: {
        token: "[REDACTED]",
        profile: {
          api_key: "[REDACTED]",
          keep: "visible",
        },
      },
      attempts: [
        {
          authorization: "[REDACTED]",
        },
        {
          mat_khau: "[REDACTED]",
        },
      ],
    })
  })

  it("caps recursive depth with a sentinel value", () => {
    const nested = {
      level_0: {
        level_1: {
          level_2: {
            level_3: {
              level_4: {
                level_5: {
                  level_6: {
                    level_7: {
                      level_8: {
                        level_9: {
                          level_10: {
                            level_11: "too-deep",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }

    expect(sanitizeForLog(nested)).toEqual({
      level_0: {
        level_1: {
          level_2: {
            level_3: {
              level_4: {
                level_5: {
                  level_6: {
                    level_7: {
                      level_8: {
                        level_9: {
                          level_10: "[MAX_DEPTH]",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })
  })

  it("preserves log context for Date and Error values", () => {
    const result = sanitizeForLog({
      created_at: new Date("2026-05-04T01:30:00.000Z"),
      error: new Error("rpc failed"),
    })

    expect(result).toEqual({
      created_at: "2026-05-04T01:30:00.000Z",
      error: {
        name: "Error",
        message: "rpc failed",
      },
    })
  })
})
