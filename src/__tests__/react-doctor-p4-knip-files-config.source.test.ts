import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const phaseOneIntentionalFiles = [
  "src/hooks/use-audit-logs.types.assert.ts",
  "src/hooks/use-cached-repair.complete.typecheck.ts",
  "src/hooks/use-cached-repair.legacy-list.typecheck.ts",
  "src/lib/chart-utils.types.assert.ts",
  "src/lib/ai/tools/query-catalog.types.assert.ts",
  "src/app/(app)/reports/hooks/use-maintenance-data.types.assert.ts",
  "supabase/functions/auth-audit-cleanup/handler.ts",
  "supabase/functions/auth-audit-cleanup/index.ts",
]

describe("React Doctor P4 knip/files config", () => {
  it("ignores intentional Phase 1 typecheck guards and active Edge Function files", () => {
    const config = JSON.parse(
      readFileSync(join(process.cwd(), "react-doctor.config.json"), "utf8"),
    ) as { ignore?: { files?: string[] } }
    const ignoredFiles = config.ignore?.files ?? []

    expect(ignoredFiles).toEqual(
      expect.arrayContaining(phaseOneIntentionalFiles),
    )
  })
})
