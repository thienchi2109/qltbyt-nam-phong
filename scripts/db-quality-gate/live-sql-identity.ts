import type { ConfirmedLiveMigration } from "./baseline-state"

/** Exact historical mapping reviewed in #987; never infer equivalence from a name or timestamp. */
const REVIEWED_FOUNDATION = {
  liveName: "20260831120000_device_quota_regulatory_catalog_foundation",
  liveVersion: "20260831141415",
  path: "supabase/migrations/20260831120000_device_quota_regulatory_catalog_foundation.sql",
  sha256: "eba9dad8b8ec092405ed6beb2ff2e8c6e32123f1a7e541c205798c721fcba780",
  liveSqlSha256: "da4ebe2c8b596c8078adbb6e80bf674349dcc6b1d88370989ab46281f392c746",
  liveSqlPath: "supabase/db-quality-gate-live-sql/20260831141415.sql",
}

/** Matches all four identity fields; a mismatch retains the strict default contract. */
export function reviewedLiveSqlIdentity(migration: ConfirmedLiveMigration) {
  return migration.liveName === REVIEWED_FOUNDATION.liveName &&
    migration.liveVersion === REVIEWED_FOUNDATION.liveVersion &&
    migration.path === REVIEWED_FOUNDATION.path &&
    migration.sha256 === REVIEWED_FOUNDATION.sha256
    ? REVIEWED_FOUNDATION
    : undefined
}

/** Hash of SQL actually applied, distinct from the immutable repository file hash. */
export function confirmedLiveSqlSha256(migration: ConfirmedLiveMigration): string {
  return reviewedLiveSqlIdentity(migration)?.liveSqlSha256 ?? migration.sha256
}
