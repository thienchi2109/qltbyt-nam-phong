import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, test } from "vitest"

const repoRoot = path.resolve(__dirname, "..", "..")

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8")
}

describe("device quota 768 embedding rollout artifacts", () => {
  test("adds a side-by-side 768-vector table without replacing nhom_thiet_bi.embedding", () => {
    const migration = readRepoFile(
      "supabase/migrations/20260520043000_add_device_quota_category_embeddings_768.sql",
    )

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.device_quota_category_embeddings")
    expect(migration).toContain("category_id BIGINT NOT NULL")
    expect(migration).toContain("model_name TEXT NOT NULL")
    expect(migration).toContain("dimension INTEGER NOT NULL CHECK (dimension = 768)")
    expect(migration).toContain("content_hash TEXT NOT NULL")
    expect(migration).toContain("embedding extensions.vector(768) NOT NULL")
    expect(migration).toContain("UNIQUE (category_id, model_name, dimension, content_hash)")
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY")
    expect(migration).toContain("USING (false)")
    expect(migration).not.toMatch(/ALTER TABLE public\\.nhom_thiet_bi\\s+ALTER COLUMN embedding/i)
    expect(migration).not.toMatch(/DROP COLUMN IF EXISTS embedding/i)
  })

  test("ships a dry-run-first refresh script for the side-by-side table", () => {
    const script = readRepoFile("scripts/device-quota/refresh-category-embeddings-768.ts")

    expect(script).toContain("DEVICE_QUOTA_768_REFRESH_DRY_RUN")
    expect(script).toContain("dryRun = readBooleanEnv")
    expect(script).toContain("device_quota_category_embeddings")
    expect(script).toContain("dimension: 768")
    expect(script).toContain("content_hash")
    expect(script).toContain("DRY RUN")
    expect(script).not.toContain(".from('nhom_thiet_bi').update({ embedding")
    expect(script).not.toContain('.from("nhom_thiet_bi").update({ embedding')
  })

  test("documents refresh and rollback operations in Vietnamese", () => {
    const runbook = readRepoFile("docs/runbooks/device-quota-768-embeddings.md")

    expect(runbook).toContain("Làm mới embedding 768 chiều")
    expect(runbook).toContain("dry-run")
    expect(runbook).toContain("DEVICE_QUOTA_768_REFRESH_DRY_RUN=false")
    expect(runbook).toContain("Rollback")
    expect(runbook).toContain("public.device_quota_category_embeddings")
  })
})
