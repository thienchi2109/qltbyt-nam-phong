import { existsSync, readFileSync, readdirSync } from "fs"
import { join } from "path"

import { describe, expect, it } from "vitest"

const repoRoot = process.cwd()

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8")
}

describe("ZBS delivery webhook deprecation", () => {
  it("removes runtime delivery webhook entry points", () => {
    const deprecatedPaths = [
      "src/app/api/webhooks/zalo/zbs/route.ts",
      "src/lib/zbs/delivery-webhook-payload.ts",
      "src/lib/zbs/delivery-webhook-signature.ts",
      "scripts/verify-zbs-delivery-webhook.sql",
    ]

    expect(deprecatedPaths.filter((path) => existsSync(join(repoRoot, path)))).toEqual([])
  })

  it("documents provider success as the terminal ZBS delivery signal", () => {
    const rolloutRunbook = readRepoFile("docs/runbooks/zbs-production-rollout.md")

    expect(rolloutRunbook).not.toContain("/api/webhooks/zalo/zbs")
    expect(rolloutRunbook).not.toContain("user_received_message")
    expect(rolloutRunbook).toContain("delivery webhook is deprecated")
    expect(rolloutRunbook).toContain("provider Success")
  })

  it("adds a migration that drops the delivery webhook RPC", () => {
    const migrationName = readdirSync(join(repoRoot, "supabase/migrations")).find((name) =>
      name.endsWith("_deprecate_zbs_delivery_webhook.sql")
    )

    expect(migrationName).toBeDefined()

    const migrationSql = readRepoFile(`supabase/migrations/${migrationName}`)

    expect(migrationSql).toContain(
      "DROP FUNCTION IF EXISTS public.zbs_notification_outbox_mark_delivered"
    )
    expect(migrationSql).toContain("zbs_notification_outbox_mark_delivered")
    expect(migrationSql).toContain("Rollback")
    expect(migrationSql).toContain("20260702090000_add_zbs_delivery_webhook_rpc.sql")
  })
})
