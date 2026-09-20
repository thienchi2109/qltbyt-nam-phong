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

/** Exact Phase 4.5 live/source mappings read back from live metadata in #1001. */
const REVIEWED_PHASE45 = [
  {
    liveName: "20260913020000_web_push_recipient_config_phase45",
    liveVersion: "20260913094624",
    path: "supabase/migrations/20260913020000_web_push_recipient_config_phase45.sql",
    sha256: "6466cfc8cc29bf88c389c9c7884b03cd263b9db7f549d4f79e1658e350151ef9",
    liveSqlSha256: "6466cfc8cc29bf88c389c9c7884b03cd263b9db7f549d4f79e1658e350151ef9",
    liveSqlPath: "supabase/migrations/20260913020000_web_push_recipient_config_phase45.sql",
  },
  {
    liveName: "20260913020100_web_push_enqueue_recipient_eligibility",
    liveVersion: "20260913094625",
    path: "supabase/migrations/20260913020100_web_push_enqueue_recipient_eligibility.sql",
    sha256: "2460048b13ceceb7dae2b7b51dc6deb5bafe6269b1632f31f8ba478fa18cb396",
    liveSqlSha256: "2460048b13ceceb7dae2b7b51dc6deb5bafe6269b1632f31f8ba478fa18cb396",
    liveSqlPath: "supabase/migrations/20260913020100_web_push_enqueue_recipient_eligibility.sql",
  },
  {
    liveName: "web_push_claim_recipient_eligibility_retry_20260913",
    liveVersion: "20260913094634",
    path: "supabase/migrations/20260913020200_web_push_claim_recipient_eligibility.sql",
    sha256: "1113905a63d5f45e4fb8c2ecb5a8f29c19260e934326a4527afb4d6498d57585",
    liveSqlSha256: "1113905a63d5f45e4fb8c2ecb5a8f29c19260e934326a4527afb4d6498d57585",
    liveSqlPath: "supabase/migrations/20260913020200_web_push_claim_recipient_eligibility.sql",
  },
] as const

/** Exact live/source mapping for the Issue #1002 message-copy migration. */
const REVIEWED_ISSUE1002 = {
  liveName: "web_push_repair_message_copy",
  liveVersion: "20260920013050",
  path: "supabase/migrations/20260919120000_web_push_repair_message_copy.sql",
  sha256: "a771382ab0e70a002794fdf9ba1477f8bba12aab605d1db5fd277ff9fc45f1b9",
  liveSqlSha256: "d6fc5276f729c35a8f8d535265a0b4dc27e7859c11aef7c609bc1b5017d8ca15",
  liveSqlPath: "supabase/db-quality-gate-live-sql/20260920013050.sql",
} as const

const REVIEWED_IDENTITIES = [REVIEWED_FOUNDATION, ...REVIEWED_PHASE45, REVIEWED_ISSUE1002] as const

/** Matches all four identity fields; a mismatch retains the strict default contract. */
export function reviewedLiveSqlIdentity(migration: ConfirmedLiveMigration) {
  return REVIEWED_IDENTITIES.find(
    (reviewed) =>
      migration.liveName === reviewed.liveName &&
      migration.liveVersion === reviewed.liveVersion &&
      migration.path === reviewed.path &&
      migration.sha256 === reviewed.sha256
  )
}

/** Hash of SQL actually applied, distinct from the immutable repository file hash. */
export function confirmedLiveSqlSha256(migration: ConfirmedLiveMigration): string {
  return reviewedLiveSqlIdentity(migration)?.liveSqlSha256 ?? migration.sha256
}
