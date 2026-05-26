import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

describe("auth login RPC boundary migration", () => {
  it("revokes direct login RPC execution from public PostgREST roles", () => {
    const migrationsDir = join(process.cwd(), "supabase/migrations")
    const migrationFile = readdirSync(migrationsDir)
      .filter((file) => file.includes("harden_authenticate_user_dual_mode_execute"))
      .sort()
      .at(-1)

    if (!migrationFile) {
      throw new Error("Missing harden_authenticate_user_dual_mode_execute migration")
    }

    const migrationSource = readFileSync(join(migrationsDir, migrationFile), "utf8")

    expect(migrationSource).toContain(
      "REVOKE EXECUTE ON FUNCTION public.authenticate_user_dual_mode(TEXT, TEXT) FROM PUBLIC;"
    )
    expect(migrationSource).toContain(
      "REVOKE EXECUTE ON FUNCTION public.authenticate_user_dual_mode(TEXT, TEXT) FROM anon;"
    )
    expect(migrationSource).toContain(
      "REVOKE EXECUTE ON FUNCTION public.authenticate_user_dual_mode(TEXT, TEXT) FROM authenticated;"
    )
    expect(migrationSource).toContain(
      "GRANT EXECUTE ON FUNCTION public.authenticate_user_dual_mode(TEXT, TEXT) TO service_role;"
    )
    expect(migrationSource).not.toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.authenticate_user_dual_mode/i
    )
  })
})
