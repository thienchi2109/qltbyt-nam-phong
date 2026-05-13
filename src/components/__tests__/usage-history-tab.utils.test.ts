import { describe, expect, it } from "vitest"

import {
  formatUsageDuration,
  getUsageLogPageSignature,
} from "../usage-history-tab.utils"
import type { UsageLog } from "@/types/database"

function createUsageLog(overrides: Partial<UsageLog>): UsageLog {
  return {
    id: 1,
    thiet_bi_id: 1,
    thoi_gian_bat_dau: "2026-05-13T00:00:00Z",
    trang_thai: "hoan_thanh",
    created_at: "2026-05-13T00:00:00Z",
    updated_at: "2026-05-13T00:00:00Z",
    ...overrides,
  }
}

describe("usage history utilities", () => {
  it("keeps page signatures distinct when text fields contain delimiters", () => {
    const first = getUsageLogPageSignature([
      createUsageLog({
        updated_at: "u",
        ghi_chu: "note",
      }),
      createUsageLog({
        id: 2,
        updated_at: "u",
      }),
    ])
    const second = getUsageLogPageSignature([
      createUsageLog({
        updated_at: "u",
        ghi_chu: "note|2:u:hoan_thanh:::::",
      }),
    ])

    expect(first).not.toBe(second)
  })

  it("returns a zero duration for invalid timestamps", () => {
    expect(formatUsageDuration("not-a-date", undefined, Date.parse("2026-05-13T00:10:00Z"))).toBe("0m")
  })
})
