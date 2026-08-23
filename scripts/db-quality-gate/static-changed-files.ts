import { collectChangedFiles } from "../changed-files"
import { isCanonicalMigrationPath } from "./migration-source"
import { INVARIANTS_PATH, SQL_TESTS_PATH } from "./static-lane-expected-state"

/** Default comparison ref for ordinary diff-aware static gate runs. */
export const DEFAULT_STATIC_BASE_REF = "origin/main"
/** Canonical repository directory containing forward migration sources. */
export const DEFAULT_MIGRATION_ROOT = "supabase/migrations"
/** Append-only registry of migrations verified as applied to live. */
export const APPLIED_LOCK_PATH = "supabase/applied-migrations.lock.json"
/** Baseline registry used for no-new-regression static policy checks. */
export const BASELINE_PATH = "supabase/db-quality-gate-baseline.json"
/** Exact-bound approval registry for dangerous migration findings. */
export const WAIVERS_PATH = "supabase/db-quality-gate-waivers.json"

/** Narrows a repository diff to canonical migrations and static-gate metadata. */
export function staticChangedFiles(changedFiles: string[]): string[] {
  return changedFiles.filter(
    (filePath: string) =>
      isCanonicalMigrationPath(filePath) ||
      filePath === APPLIED_LOCK_PATH ||
      filePath === BASELINE_PATH ||
      filePath === INVARIANTS_PATH ||
      filePath === SQL_TESTS_PATH ||
      filePath === WAIVERS_PATH
  )
}

/** Collects the ordinary static-lane diff using the production default base ref. */
export function collectStaticChangedFiles(baseRef = DEFAULT_STATIC_BASE_REF): string[] {
  return staticChangedFiles(collectChangedFiles(baseRef))
}
