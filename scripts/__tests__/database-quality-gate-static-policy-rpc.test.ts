import { readFileSync } from "node:fs"

import { afterEach, describe, expect, it } from "vitest"

import {
  cleanupFixtureRepositories,
  loadDatabaseQualityGateModule,
} from "./database-quality-gate-test-support"
import {
  fixtureWithStaticMetadata,
  migration,
  runStatic,
  StaticLaneModule,
} from "./database-quality-gate-static-test-support"
import { runReviewedCandidates } from "./database-quality-gate-static-policy-delegation-test-support"

afterEach(cleanupFixtureRepositories)

describe("database quality gate static SQL RPC policies", () => {
  it("recognizes the real Phase 2 recipient semantics without waiving dangerous SQL", async () => {
    const recipientsPath = "supabase/migrations/20260911030100_web_push_recipients.sql"
    const subscriptionsPath = "supabase/migrations/20260911030200_web_push_subscriptions.sql"
    const migrations = [
      { path: recipientsPath, sql: readFileSync(recipientsPath, "utf8") },
      { path: subscriptionsPath, sql: readFileSync(subscriptionsPath, "utf8") },
    ]
    const findings = (await runReviewedCandidates(migrations)).findings

    expect(findings.filter(({ ruleId }) => ruleId === "migration.jwt-guards")).toEqual([])
    expect(
      findings.filter(({ ruleId }) => ruleId === "migration.internal-helper-execute-grant")
    ).toEqual([])
    expect(
      findings.filter(({ ruleId }) => ruleId === "migration.security-definer-execute-grant")
    ).toEqual([])
    expect(
      findings.filter(
        ({ classification, ruleId }) =>
          classification === "DANGEROUS" && ruleId === "migration.dangerous-statement"
      )
    ).toHaveLength(5)
  })

  it.each(["authenticated", "anon"])(
    "fails closed when an authorization helper is granted to %s",
    async (role) => {
      const recipientsPath = "supabase/migrations/20260911030100_web_push_recipients.sql"
      const subscriptionsPath = "supabase/migrations/20260911030200_web_push_subscriptions.sql"
      const recipients = readFileSync(recipientsPath, "utf8").replace(
        "REVOKE ALL ON FUNCTION public.web_push_config_authorize(bigint) FROM PUBLIC, anon, authenticated, service_role;",
        `GRANT EXECUTE ON FUNCTION public.web_push_config_authorize(bigint) TO ${role};`
      )
      const findings = (
        await runReviewedCandidates([
          { path: recipientsPath, sql: recipients },
          { path: subscriptionsPath, sql: readFileSync(subscriptionsPath, "utf8") },
        ])
      ).findings

      expect(findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ ruleId: "migration.internal-helper-execute-grant" }),
        ])
      )
    }
  )

  it.each([
    "clock_timestamp() + interval '1 second'",
    "public.clock_timestamp()",
    "(SELECT clock_timestamp())",
  ])("rejects the declaration initializer %s", async (initializer) => {
    const recipientsPath = "supabase/migrations/20260911030100_web_push_recipients.sql"
    const subscriptionsPath = "supabase/migrations/20260911030200_web_push_subscriptions.sql"
    const subscriptions = readFileSync(subscriptionsPath, "utf8").replace(
      "v_now timestamptz := clock_timestamp();",
      `v_now timestamptz := ${initializer};`
    )
    const findings = (
      await runReviewedCandidates([
        { path: recipientsPath, sql: readFileSync(recipientsPath, "utf8") },
        { path: subscriptionsPath, sql: subscriptions },
      ])
    ).findings

    expect(findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ ruleId: "migration.jwt-guards" })])
    )
  })

  it.each([
    ["wrong tenant argument", "PERFORM public.web_push_config_authorize(p_don_vi + 1);"],
    [
      "protected SQL before the argumented guard",
      "PERFORM public.persist_module_change();\n  PERFORM public.web_push_config_authorize(p_don_vi);",
    ],
  ])("rejects %s", async (_name, replacement) => {
    const recipientsPath = "supabase/migrations/20260911030100_web_push_recipients.sql"
    const subscriptionsPath = "supabase/migrations/20260911030200_web_push_subscriptions.sql"
    const recipients = readFileSync(recipientsPath, "utf8").replace(
      "PERFORM public.web_push_config_authorize(p_don_vi);",
      replacement
    )
    const findings = (
      await runReviewedCandidates([
        { path: recipientsPath, sql: recipients },
        { path: subscriptionsPath, sql: readFileSync(subscriptionsPath, "utf8") },
      ])
    ).findings

    expect(findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ ruleId: "migration.jwt-guards" })])
    )
  })

  it("requires authenticated-only execute grants and PUBLIC revoke for SECURITY DEFINER RPCs", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      [
        "-- migration",
        "BEGIN;",
        "CREATE OR REPLACE FUNCTION public.unsafe_rpc() RETURNS void",
        "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
        "BEGIN",
        "  PERFORM current_setting('request.jwt.claims', true);",
        "  RAISE NOTICE 'Missing role claim';",
        "  RAISE NOTICE 'Missing user_id claim';",
        "END;",
        "$$;",
        "GRANT EXECUTE ON FUNCTION public.unsafe_rpc() TO anon, authenticated;",
        "COMMIT;",
        "",
      ].join("\n")
    )
    const repository = fixtureWithStaticMetadata(candidate)

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.outcome).toBe("FAILED")
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "migration.security-definer-execute-revoke" }),
        expect.objectContaining({ ruleId: "migration.security-definer-public-execute" }),
      ])
    )
  })

  it("blocks GRANT ALL and schema-wide grants that expose a SECURITY DEFINER RPC to PUBLIC", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      [
        "-- migration",
        "BEGIN;",
        "CREATE OR REPLACE FUNCTION public.unsafe_rpc() RETURNS void",
        "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
        "DECLARE",
        "  v_role text;",
        "  v_user_id text;",
        "BEGIN",
        "  v_role := current_setting('request.jwt.claims', true)::json->>'app_role';",
        "  v_user_id := NULLIF(current_setting('request.jwt.claims', true)::json->>'user_id', '');",
        "  IF v_role IS NULL OR v_role = '' THEN",
        "    RAISE EXCEPTION 'Missing role claim' USING errcode = '42501';",
        "  END IF;",
        "  IF v_user_id IS NULL THEN",
        "    RAISE EXCEPTION 'Missing user_id claim' USING errcode = '42501';",
        "  END IF;",
        "END;",
        "$$;",
        "REVOKE EXECUTE ON FUNCTION public.unsafe_rpc() FROM PUBLIC;",
        "GRANT EXECUTE ON FUNCTION public.unsafe_rpc() TO authenticated;",
        "GRANT ALL PRIVILEGES ON FUNCTION public.unsafe_rpc() TO PUBLIC;",
        "GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;",
        "COMMIT;",
        "",
      ].join("\n")
    )
    const repository = fixtureWithStaticMetadata(candidate)

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.security-definer-public-execute" })
    )
  })

  it("requires an authenticated execute grant for every new SECURITY DEFINER RPC", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      [
        "-- migration",
        "BEGIN;",
        "CREATE OR REPLACE FUNCTION public.ungranted_rpc() RETURNS void",
        "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
        "BEGIN",
        "  PERFORM current_setting('request.jwt.claims', true);",
        "  RAISE NOTICE 'Missing role claim';",
        "  RAISE NOTICE 'Missing user_id claim';",
        "END;",
        "$$;",
        "REVOKE EXECUTE ON FUNCTION public.ungranted_rpc() FROM PUBLIC;",
        "COMMIT;",
        "",
      ].join("\n")
    )
    const repository = fixtureWithStaticMetadata(candidate)

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.outcome).toBe("FAILED")
    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.security-definer-execute-grant" })
    )
  })

  it("requires fail-closed role and user guards instead of token-presence decoys", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      [
        "-- migration",
        "BEGIN;",
        "CREATE OR REPLACE FUNCTION public.unsafe_rpc() RETURNS void",
        "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
        "BEGIN",
        "  PERFORM current_setting('request.jwt.claims', true);",
        "  RAISE NOTICE 'Missing role claim';",
        "  RAISE NOTICE 'Missing user_id claim';",
        "END;",
        "$$;",
        "REVOKE EXECUTE ON FUNCTION public.unsafe_rpc() FROM PUBLIC;",
        "GRANT EXECUTE ON FUNCTION public.unsafe_rpc() TO authenticated;",
        "COMMIT;",
        "",
      ].join("\n")
    )
    const repository = fixtureWithStaticMetadata(candidate)

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.jwt-guards" })
    )
  })

  it("checks SECURITY DEFINER and ILIKE requirements per function or statement", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      [
        "-- migration",
        "BEGIN;",
        "CREATE OR REPLACE FUNCTION public.guarded_rpc() RETURNS void",
        "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
        "BEGIN",
        "  PERFORM current_setting('request.jwt.claims', true);",
        "  RAISE NOTICE 'Missing role claim';",
        "  RAISE NOTICE 'Missing user_id claim';",
        "END;",
        "$$;",
        "CREATE OR REPLACE FUNCTION public.unguarded_rpc() RETURNS void",
        "LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN; END; $$;",
        "GRANT EXECUTE ON FUNCTION public.guarded_rpc() TO authenticated;",
        "GRANT EXECUTE ON FUNCTION public.unguarded_rpc() TO authenticated;",
        "SELECT * FROM public.search_source WHERE name ILIKE '%' || _sanitize_ilike_pattern(p_safe) || '%';",
        "SELECT * FROM public.search_source WHERE name ILIKE '%' || p_unsafe || '%';",
        "COMMIT;",
        "",
      ].join("\n")
    )
    const repository = fixtureWithStaticMetadata(candidate)

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "migration.ilike-sanitization" }),
        expect.objectContaining({ ruleId: "migration.jwt-guards" }),
        expect.objectContaining({ ruleId: "migration.security-definer-execute-revoke" }),
        expect.objectContaining({ ruleId: "migration.security-definer-search-path" }),
      ])
    )
  })

  it("emits explanatory DANGEROUS evidence rather than reclassifying risky SQL as blocking", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      "-- migration\nBEGIN;\nDROP TABLE public.deprecated_table;\nCOMMIT;\n"
    )
    const repository = fixtureWithStaticMetadata(candidate)

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.outcome).toBe("FAILED")
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        classification: "DANGEROUS",
        evidence: expect.objectContaining({
          line: 3,
          reason: "drop-table",
          statement: "DROP TABLE public.deprecated_table;",
        }),
        ruleId: "migration.dangerous-statement",
      })
    )
    expect(result.findings).not.toContainEqual(
      expect.objectContaining({
        classification: "BLOCKING",
        ruleId: "migration.dangerous-statement",
      })
    )
  })

  it("enforces explicit grants for quoted public table identifiers", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      [
        "-- migration",
        "BEGIN;",
        'CREATE TABLE "public"."quoted_table" (id bigint PRIMARY KEY);',
        'REVOKE ALL ON TABLE "public"."quoted_table" FROM anon, authenticated, public;',
        'GRANT ALL ON TABLE "public"."quoted_table" TO authenticated;',
        "COMMIT;",
        "",
      ].join("\n")
    )
    const repository = fixtureWithStaticMetadata(candidate)

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        classification: "BLOCKING",
        ruleId: "migration.explicit-grants",
      })
    )
  })
})
