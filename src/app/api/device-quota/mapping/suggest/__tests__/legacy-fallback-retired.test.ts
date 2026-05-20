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
    expect(existsSync(path.join(repoRoot, "src/lib/refresh-category-embeddings.ts"))).toBe(false)
    expect(existsSync(path.join(repoRoot, "src/lib/__tests__/refresh-category-embeddings.test.ts"))).toBe(
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

  test("keeps category mutation flows free of stale embedding refresh calls", async () => {
    const mutationSource = await readRepoFile(
      "src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryMutations.ts",
    )
    const importDialogSource = await readRepoFile(
      "src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryImportDialog.tsx",
    )
    const combinedSource = `${mutationSource}\n${importDialogSource}`

    expect(combinedSource).not.toContain("refreshCategoryEmbeddings")
    expect(combinedSource).not.toContain("/api/embeddings/refresh-categories")
  })
})
