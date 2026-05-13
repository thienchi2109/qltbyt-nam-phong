import { describe, expect, it } from "vitest"

import { parseLocalDate } from "@/app/(app)/device-quota/decisions/_components/DeviceQuotaDecisionDialogSchema"

describe("parseLocalDate", () => {
  it("keeps valid local dates on the requested calendar day", () => {
    const date = parseLocalDate("2026-02-28")

    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(1)
    expect(date.getDate()).toBe(28)
  })

  it("rejects invalid calendar dates instead of normalizing them", () => {
    const date = parseLocalDate("2026-02-31")

    expect(Number.isNaN(date.getTime())).toBe(true)
  })
})
