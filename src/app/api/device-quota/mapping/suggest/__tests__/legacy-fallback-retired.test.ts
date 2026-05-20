import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"

import { describe, expect, test } from "vitest"

const repoRoot = process.cwd()

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8")
}

describe("retired Supabase embedding fallback", () => {
  test("removes the legacy embedding API and Edge Function sources", () => {
    expect(existsSync(path.join(repoRoot, "src/app/api/embeddings/generate/route.ts"))).toBe(false)
    expect(existsSync(path.join(repoRoot, "src/app/api/embeddings/refresh-categories/route.ts"))).toBe(
      false,
    )
    expect(existsSync(path.join(repoRoot, "supabase/functions/embed-device-name/index.ts"))).toBe(false)
    expect(existsSync(path.join(repoRoot, "scripts/device-quota/backfill-category-embeddings.ts"))).toBe(
      false,
    )
  })

  test("keeps the VM suggestion implementation free of the retired fallback calls", async () => {
    const serviceSource = await readRepoFile("src/app/api/device-quota/mapping/suggest/suggestion-service.ts")
    const vmProviderSource = await readRepoFile(
      "src/app/api/device-quota/mapping/suggest/suggestion-vm-provider.ts",
    )
    const combinedSource = `${serviceSource}\n${vmProviderSource}`

    expect(combinedSource).not.toContain("/functions/v1/embed-device-name")
    expect(combinedSource).not.toContain("hybrid_search_category_batch")
  })
})
