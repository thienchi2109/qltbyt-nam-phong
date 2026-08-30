import { readFileSync } from "node:fs"

import { afterEach, describe, expect, it } from "vitest"

import { cleanupFixtureRepositories } from "./database-quality-gate-test-support"
import {
  CANONICAL_GUARD,
  candidateSql,
  runCandidate,
  runCandidateWithHistory,
} from "./database-quality-gate-static-policy-delegation-test-support"

afterEach(cleanupFixtureRepositories)

const priorGuardMigrationPath =
  "supabase/migrations/20260712112500_technical_configuration_dossier_foundation.sql"
const candidateMigrationPath =
  "supabase/migrations/20260826120436_technical_configuration_dossier_search.sql"

const canonicalPriorGuard = CANONICAL_GUARD.replaceAll(
  "public._require_authorized_user",
  "public._technical_configuration_require_global_user"
)

const publicListDelegatingToPriorGuard = [
  "CREATE OR REPLACE FUNCTION public.technical_configuration_dossiers_list() RETURNS void",
  "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
  "BEGIN",
  "  PERFORM public._technical_configuration_require_global_user();",
  "  PERFORM public.persist_dossier_change();",
  "END;",
  "$$;",
  "REVOKE EXECUTE ON FUNCTION public.technical_configuration_dossiers_list()",
  "  FROM PUBLIC, anon, authenticated;",
  "GRANT EXECUTE ON FUNCTION public.technical_configuration_dossiers_list() TO authenticated;",
].join("\n")

describe("Issue #966 DB Quality Gate analyzer", () => {
  it("does not require JWT guards for pure immutable internal SQL helpers", async () => {
    const migrationPath =
      "supabase/migrations/20260826120436_technical_configuration_dossier_search.sql"
    const result = await runCandidate(
      readFileSync(migrationPath, "utf8").replace(/\n$/u, ""),
      migrationPath
    )

    expect(result.findings).not.toContainEqual(
      expect.objectContaining({
        evidence: expect.objectContaining({ function: "public._normalize_search_text" }),
        ruleId: "migration.jwt-guards",
      })
    )
  })

  it("recognizes a direct guard delegation from committed migration history", async () => {
    const result = await runCandidateWithHistory([
      {
        path: priorGuardMigrationPath,
        sql: candidateSql(canonicalPriorGuard),
      },
      {
        path: candidateMigrationPath,
        sql: candidateSql(publicListDelegatingToPriorGuard),
      },
    ])

    expect(result.findings).not.toContainEqual(
      expect.objectContaining({
        evidence: expect.objectContaining({
          function: "public.technical_configuration_dossiers_list",
        }),
        ruleId: "migration.jwt-guards",
      })
    )
  })

  it("accepts the real dossier-search migration through its prior canonical guard", async () => {
    const result = await runCandidateWithHistory([
      {
        path: priorGuardMigrationPath,
        sql: readFileSync(priorGuardMigrationPath, "utf8").replace(/\n$/u, ""),
      },
      {
        path: candidateMigrationPath,
        sql: readFileSync(candidateMigrationPath, "utf8").replace(/\n$/u, ""),
      },
    ])

    expect(result.findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidence: expect.objectContaining({
            function: "public._normalize_search_text",
          }),
          ruleId: "migration.jwt-guards",
        }),
        expect.objectContaining({
          evidence: expect.objectContaining({
            function: "public.technical_configuration_dossiers_list",
          }),
          ruleId: "migration.jwt-guards",
        }),
      ])
    )
  })

  it("recognizes transitive delegation through a prior compatibility helper", async () => {
    const priorMigration = candidateSql(
      canonicalPriorGuard,
      [
        "CREATE OR REPLACE FUNCTION public._technical_configuration_legacy_guard() RETURNS bigint",
        "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
        "BEGIN",
        "  RETURN public._technical_configuration_require_global_user();",
        "END;",
        "$$;",
        "REVOKE ALL ON FUNCTION public._technical_configuration_legacy_guard()",
        "  FROM PUBLIC, anon, authenticated;",
      ].join("\n")
    )
    const candidate = candidateSql(
      [
        "CREATE OR REPLACE FUNCTION public.technical_configuration_dossiers_list() RETURNS void",
        "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
        "BEGIN",
        "  PERFORM public._technical_configuration_legacy_guard();",
        "  PERFORM public.persist_dossier_change();",
        "END;",
        "$$;",
        "REVOKE EXECUTE ON FUNCTION public.technical_configuration_dossiers_list()",
        "  FROM PUBLIC, anon, authenticated;",
        "GRANT EXECUTE ON FUNCTION public.technical_configuration_dossiers_list() TO authenticated;",
      ].join("\n")
    )
    const result = await runCandidateWithHistory([
      { path: priorGuardMigrationPath, sql: priorMigration },
      { path: candidateMigrationPath, sql: candidate },
    ])

    expect(result.findings).not.toContainEqual(
      expect.objectContaining({
        evidence: expect.objectContaining({
          function: "public.technical_configuration_dossiers_list",
        }),
        ruleId: "migration.jwt-guards",
      })
    )
  })

  it.each([
    {
      name: "ambiguous prior overload",
      prior: [
        "CREATE OR REPLACE FUNCTION public._technical_configuration_require_global_user(p_value bigint) RETURNS bigint",
        "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
        "BEGIN RETURN p_value; END;",
        "$$;",
        "REVOKE ALL ON FUNCTION public._technical_configuration_require_global_user(bigint)",
        "  FROM PUBLIC, anon, authenticated;",
        "CREATE OR REPLACE FUNCTION public._technical_configuration_require_global_user(p_value text) RETURNS bigint",
        "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
        "BEGIN RETURN 1; END;",
        "$$;",
        "REVOKE ALL ON FUNCTION public._technical_configuration_require_global_user(text)",
        "  FROM PUBLIC, anon, authenticated;",
      ].join("\n"),
      candidate: publicListDelegatingToPriorGuard,
    },
    {
      name: "unresolved prior call",
      prior: canonicalPriorGuard,
      candidate: publicListDelegatingToPriorGuard.replace(
        "public._technical_configuration_require_global_user()",
        "public._missing_technical_configuration_guard()"
      ),
    },
    {
      name: "unsafe lookalike prior helper",
      prior: [
        "CREATE OR REPLACE FUNCTION public._technical_configuration_require_global_user() RETURNS bigint",
        "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
        "BEGIN",
        "  RETURN 1;",
        "END;",
        "$$;",
        "REVOKE ALL ON FUNCTION public._technical_configuration_require_global_user()",
        "  FROM PUBLIC, anon, authenticated;",
      ].join("\n"),
      candidate: publicListDelegatingToPriorGuard,
    },
  ])("fails closed for $name", async ({ prior, candidate }) => {
    const result = await runCandidateWithHistory([
      { path: priorGuardMigrationPath, sql: candidateSql(prior) },
      { path: candidateMigrationPath, sql: candidateSql(candidate) },
    ])

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        evidence: expect.objectContaining({
          function: "public.technical_configuration_dossiers_list",
        }),
        ruleId: "migration.jwt-guards",
      })
    )
  })

  it("fails closed for an immutable lookalike that reaches business SQL", async () => {
    const unsafeHelper = [
      "CREATE OR REPLACE FUNCTION public._normalize_search_text(input text) RETURNS text",
      "LANGUAGE sql IMMUTABLE AS $$",
      "  SELECT public.persist_dossier_change()::text;",
      "$$;",
      "REVOKE ALL ON FUNCTION public._normalize_search_text(text)",
      "  FROM PUBLIC, anon, authenticated;",
    ].join("\n")
    const result = await runCandidate(candidateSql(unsafeHelper))

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        evidence: expect.objectContaining({ function: "public._normalize_search_text" }),
        ruleId: "migration.jwt-guards",
      })
    )
  })

  it("fails closed for cycles and dynamic SQL before authorization", async () => {
    const cycleResult = await runCandidate(
      candidateSql(
        [
          "CREATE OR REPLACE FUNCTION public._cycle_a() RETURNS void",
          "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
          "BEGIN PERFORM public._cycle_b(); END;",
          "$$;",
          "REVOKE ALL ON FUNCTION public._cycle_a() FROM PUBLIC, anon, authenticated;",
          "CREATE OR REPLACE FUNCTION public._cycle_b() RETURNS void",
          "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
          "BEGIN PERFORM public._cycle_a(); END;",
          "$$;",
          "REVOKE ALL ON FUNCTION public._cycle_b() FROM PUBLIC, anon, authenticated;",
          "CREATE OR REPLACE FUNCTION public.cycle_rpc() RETURNS void",
          "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
          "BEGIN",
          "  PERFORM public._cycle_a();",
          "END;",
          "$$;",
          "REVOKE EXECUTE ON FUNCTION public.cycle_rpc() FROM PUBLIC;",
          "GRANT EXECUTE ON FUNCTION public.cycle_rpc() TO authenticated;",
        ].join("\n")
      )
    )
    const dynamicResult = await runCandidate(
      candidateSql(
        [
          "CREATE OR REPLACE FUNCTION public.dynamic_rpc() RETURNS void",
          "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
          "BEGIN",
          "  EXECUTE 'PERFORM public._technical_configuration_require_global_user()';",
          "END;",
          "$$;",
          "REVOKE EXECUTE ON FUNCTION public.dynamic_rpc() FROM PUBLIC;",
          "GRANT EXECUTE ON FUNCTION public.dynamic_rpc() TO authenticated;",
        ].join("\n")
      )
    )

    expect(cycleResult.findings).toContainEqual(
      expect.objectContaining({
        evidence: expect.objectContaining({ function: "public.cycle_rpc" }),
        ruleId: "migration.jwt-guards",
      })
    )
    expect(dynamicResult.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidence: expect.objectContaining({ function: "public.dynamic_rpc" }),
          ruleId: "migration.jwt-guards",
        }),
        expect.objectContaining({ ruleId: "migration.dynamic-sql" }),
      ])
    )
  })
})
