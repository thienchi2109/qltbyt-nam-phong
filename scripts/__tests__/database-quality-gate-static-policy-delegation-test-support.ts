import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"
import {
  fixtureWithStaticMetadata,
  migration,
  runStatic,
  StaticLaneModule,
} from "./database-quality-gate-static-test-support"

export const CANONICAL_GUARD = [
  "CREATE OR REPLACE FUNCTION public._require_authorized_user() RETURNS bigint",
  "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
  "DECLARE",
  "  v_claims jsonb;",
  "  v_role text;",
  "  v_user_id bigint;",
  "BEGIN",
  "  BEGIN",
  "    v_claims := COALESCE(",
  "      NULLIF(current_setting('request.jwt.claims', true), ''),",
  "      '{}'",
  "    )::jsonb;",
  "    v_role := lower(NULLIF(v_claims->>'app_role', ''));",
  "    v_user_id := NULLIF(v_claims->>'user_id', '')::bigint;",
  "  EXCEPTION",
  "    WHEN invalid_text_representation THEN",
  "      RAISE EXCEPTION 'permission_denied' USING errcode = '42501';",
  "  END;",
  "  IF v_role IS NULL",
  "     OR v_user_id IS NULL",
  "     OR NOT EXISTS (SELECT 1 FROM public.nhan_vien WHERE id = v_user_id) THEN",
  "    RAISE EXCEPTION 'permission_denied' USING errcode = '42501';",
  "  END IF;",
  "  RETURN v_user_id;",
  "END;",
  "$$;",
  "REVOKE ALL ON FUNCTION public._require_authorized_user()",
  "  FROM PUBLIC, anon, authenticated;",
].join("\n")

export function candidateSql(...statements: string[]): string {
  return ["-- migration", "BEGIN;", ...statements, "COMMIT;", ""].join("\n")
}

export async function runCandidate(
  sql: string,
  path = "supabase/migrations/20270101000000_candidate.sql"
) {
  return runCandidateWithHistory([{ path, sql }], path)
}

export async function runCandidateWithHistory(
  migrations: Array<{ path: string; sql: string }>,
  candidatePath = migrations.at(-1)?.path
) {
  if (candidatePath === undefined) {
    throw new Error("Candidate migration is required")
  }

  const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
  const candidate = migrations.find((entry) => entry.path === candidatePath)
  if (candidate === undefined) {
    throw new Error(`Candidate migration not found: ${candidatePath}`)
  }
  const repository = fixtureWithStaticMetadata(
    ...migrations.map((entry) => migration(entry.sql, entry.path))
  )

  return runStatic(source, repository.root, [candidate.path])
}
