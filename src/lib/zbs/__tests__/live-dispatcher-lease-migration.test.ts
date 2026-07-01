import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260701133000_tolerate_zbs_dispatch_lease_precision.sql"
)

describe("ZBS live dispatch lease migration", () => {
  it("keeps post-provider mark RPCs leased while tolerating timestamp precision drift", () => {
    expect(existsSync(migrationPath)).toBe(true)

    const migrationSource = readFileSync(migrationPath, "utf8")

    expect(migrationSource).toContain("p_claimed_at timestamptz")
    expect(migrationSource).toContain("p_claimed_at IS NOT NULL")
    expect(migrationSource).toContain("interval '1 millisecond'")
    expect(migrationSource).toContain(
      "CREATE OR REPLACE FUNCTION public.zbs_notification_outbox_mark_sent"
    )
    expect(migrationSource).toContain(
      "CREATE OR REPLACE FUNCTION public.zbs_notification_outbox_mark_failed"
    )
    expect(migrationSource).not.toContain("AND last_attempt_at = p_claimed_at")
    expect(migrationSource).not.toContain("AND outbox.last_attempt_at = p_claimed_at")
  })
})
