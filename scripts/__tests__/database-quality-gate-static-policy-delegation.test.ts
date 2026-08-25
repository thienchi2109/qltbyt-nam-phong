import { readFileSync } from "node:fs"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { cleanupFixtureRepositories } from "./database-quality-gate-test-support"
import {
  candidateSql,
  CANONICAL_GUARD,
  runCandidate,
} from "./database-quality-gate-static-policy-delegation-test-support"

afterEach(cleanupFixtureRepositories)

describe("database quality gate JWT guard delegation", () => {
  it("accepts a canonical internal guard through compatibility and module helper chains", async () => {
    const result = await runCandidate(
      candidateSql(
        CANONICAL_GUARD,
        [
          "CREATE OR REPLACE FUNCTION public._require_legacy_user() RETURNS bigint",
          "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
          "BEGIN",
          "  RETURN public._require_authorized_user();",
          "END;",
          "$$;",
          "REVOKE EXECUTE ON FUNCTION public._require_legacy_user()",
          "  FROM PUBLIC, anon, authenticated;",
        ].join("\n"),
        [
          "CREATE OR REPLACE FUNCTION public._module_operation() RETURNS void",
          "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
          "BEGIN",
          "  PERFORM public._require_legacy_user();",
          "  PERFORM public.persist_module_change();",
          "END;",
          "$$;",
          "REVOKE ALL PRIVILEGES ON FUNCTION public._module_operation()",
          "  FROM authenticated, PUBLIC, anon;",
        ].join("\n"),
        [
          "CREATE OR REPLACE FUNCTION public.module_operation() RETURNS void",
          "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
          "BEGIN",
          "  PERFORM public._module_operation();",
          "END;",
          "$$;",
          "REVOKE EXECUTE ON FUNCTION public.module_operation() FROM PUBLIC;",
          "GRANT EXECUTE ON FUNCTION public.module_operation() TO authenticated;",
        ].join("\n")
      )
    )

    expect(result.findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "migration.jwt-guards" }),
        expect.objectContaining({ ruleId: "migration.security-definer-execute-grant" }),
        expect.objectContaining({ ruleId: "migration.security-definer-execute-revoke" }),
        expect.objectContaining({ ruleId: "migration.internal-helper-execute-grant" }),
      ])
    )
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        classification: "DANGEROUS",
        ruleId: "migration.dangerous-statement",
      })
    )
  })

  it("accepts the landed Phase 11 canonical guard migration without widening helper ACLs", async () => {
    const migrationPath =
      "supabase/migrations/20260824132410_add_technical_configuration_authorized_user_guard.sql"
    const result = await runCandidate(
      readFileSync(path.join(process.cwd(), migrationPath), "utf8").replace(/\n$/u, ""),
      migrationPath
    )

    const forbiddenRuleIds = new Set([
      "migration.jwt-guards",
      "migration.security-definer-execute-grant",
      "migration.security-definer-execute-revoke",
      "migration.internal-helper-execute-grant",
    ])
    expect(result.findings.filter((finding) => forbiddenRuleIds.has(finding.ruleId))).toEqual([])
  })

  it("keeps authenticated grants mandatory for public RPC entrypoints", async () => {
    const result = await runCandidate(
      candidateSql(
        CANONICAL_GUARD,
        [
          "CREATE OR REPLACE FUNCTION public.module_operation() RETURNS void",
          "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
          "BEGIN",
          "  PERFORM public._require_authorized_user();",
          "END;",
          "$$;",
          "REVOKE EXECUTE ON FUNCTION public.module_operation() FROM PUBLIC;",
        ].join("\n")
      )
    )

    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.security-definer-execute-grant" })
    )
  })

  it("blocks authenticated or anonymous execution grants on internal helpers", async () => {
    const result = await runCandidate(
      candidateSql(
        CANONICAL_GUARD,
        "GRANT EXECUTE ON FUNCTION public._require_authorized_user() TO authenticated, anon;"
      )
    )

    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.internal-helper-execute-grant" })
    )
  })

  it("requires explicit PUBLIC, anon, and authenticated revokes for internal helpers", async () => {
    const publicOnlyRevoke = CANONICAL_GUARD.replace(
      [
        "REVOKE ALL ON FUNCTION public._require_authorized_user()",
        "  FROM PUBLIC, anon, authenticated;",
      ].join("\n"),
      "REVOKE EXECUTE ON FUNCTION public._require_authorized_user() FROM PUBLIC;"
    )
    const result = await runCandidate(candidateSql(publicOnlyRevoke))

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        evidence: expect.objectContaining({ function: "public._require_authorized_user" }),
        ruleId: "migration.security-definer-execute-revoke",
      })
    )
  })

  it.each([
    {
      body: "PERFORM public._missing_guard();\n  PERFORM public.persist_module_change();",
      name: "unknown call target",
    },
    {
      body: "EXECUTE 'PERFORM public._require_authorized_user()';\n  PERFORM public.persist_module_change();",
      name: "dynamic SQL",
    },
    {
      body: "PERFORM public.persist_module_change();\n  PERFORM public._require_authorized_user();",
      name: "business SQL before authorization",
    },
    {
      body: "RAISE NOTICE 'PERFORM public._require_authorized_user()';\n  PERFORM public.persist_module_change();",
      name: "quoted parser decoy",
    },
    {
      body: "PERFORM public._require_authorized_user() WHERE false;\n  PERFORM public.persist_module_change();",
      name: "non-executing guard query",
    },
    {
      body: [
        "BEGIN",
        "    PERFORM public._require_authorized_user();",
        "  EXCEPTION WHEN others THEN",
        "    NULL;",
        "  END;",
        "  PERFORM public.persist_module_change();",
      ].join("\n  "),
      name: "swallowed authorization exception",
    },
    {
      body: "v_result := public.persist_module_change();\n  PERFORM public._require_authorized_user();",
      name: "function call before authorization",
    },
    {
      body: [
        "IF current_user = 'postgres' THEN",
        "    PERFORM public._require_authorized_user();",
        "  END IF;",
        "  PERFORM public.persist_module_change();",
      ].join("\n  "),
      name: "conditional authorization",
    },
    {
      body: "PERFORM public.persist_module_change();",
      name: "unrelated guarded helper",
    },
  ])("fails closed for $name", async ({ body }) => {
    const result = await runCandidate(
      candidateSql(
        CANONICAL_GUARD,
        [
          "CREATE OR REPLACE FUNCTION public._module_operation() RETURNS void",
          "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
          "BEGIN",
          `  ${body}`,
          "END;",
          "$$;",
          "REVOKE EXECUTE ON FUNCTION public._module_operation() FROM PUBLIC, anon, authenticated;",
        ].join("\n")
      )
    )

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        evidence: expect.objectContaining({ function: "public._module_operation" }),
        ruleId: "migration.jwt-guards",
      })
    )
  })

  it("rejects a canonical-guard decoy with a privileged literal fallback", async () => {
    const privilegedFallback = CANONICAL_GUARD.replace(
      "v_role := lower(NULLIF(v_claims->>'app_role', ''));",
      "v_role := lower(COALESCE(NULLIF(v_claims->>'app_role', ''), 'global'));"
    )
    const result = await runCandidate(candidateSql(privilegedFallback))

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        evidence: expect.objectContaining({ function: "public._require_authorized_user" }),
        ruleId: "migration.jwt-guards",
      })
    )
  })

  it("rejects business SQL in the denial path before the 42501 exception", async () => {
    const businessBeforeDenial = CANONICAL_GUARD.replace(
      "    RAISE EXCEPTION 'permission_denied' USING errcode = '42501';\n  END IF;",
      [
        "    PERFORM public.persist_module_change();",
        "    RAISE EXCEPTION 'permission_denied' USING errcode = '42501';",
        "  END IF;",
      ].join("\n")
    )
    const result = await runCandidate(candidateSql(businessBeforeDenial))

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        evidence: expect.objectContaining({ function: "public._require_authorized_user" }),
        ruleId: "migration.jwt-guards",
      })
    )
  })

  it("fails closed for ambiguous overloads and delegation cycles", async () => {
    const overloadedResult = await runCandidate(
      candidateSql(
        [
          "CREATE OR REPLACE FUNCTION public._guard(p_value bigint) RETURNS void",
          "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
          "BEGIN RETURN; END;",
          "$$;",
          "REVOKE EXECUTE ON FUNCTION public._guard(bigint) FROM PUBLIC, anon, authenticated;",
          "CREATE OR REPLACE FUNCTION public._guard(p_value text) RETURNS void",
          "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
          "BEGIN RETURN; END;",
          "$$;",
          "REVOKE EXECUTE ON FUNCTION public._guard(text) FROM PUBLIC, anon, authenticated;",
          "CREATE OR REPLACE FUNCTION public._module_operation() RETURNS void",
          "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
          "BEGIN PERFORM public._guard(1); END;",
          "$$;",
          "REVOKE EXECUTE ON FUNCTION public._module_operation() FROM PUBLIC, anon, authenticated;",
        ].join("\n")
      )
    )
    const cycleResult = await runCandidate(
      candidateSql(
        [
          "CREATE OR REPLACE FUNCTION public._cycle_a() RETURNS void",
          "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
          "BEGIN PERFORM public._cycle_b(); END;",
          "$$;",
          "REVOKE EXECUTE ON FUNCTION public._cycle_a() FROM PUBLIC, anon, authenticated;",
          "CREATE OR REPLACE FUNCTION public._cycle_b() RETURNS void",
          "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
          "BEGIN PERFORM public._cycle_a(); END;",
          "$$;",
          "REVOKE EXECUTE ON FUNCTION public._cycle_b() FROM PUBLIC, anon, authenticated;",
        ].join("\n")
      )
    )

    expect(overloadedResult.findings).toContainEqual(
      expect.objectContaining({
        evidence: expect.objectContaining({ function: "public._module_operation" }),
        ruleId: "migration.jwt-guards",
      })
    )
    expect(cycleResult.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidence: expect.objectContaining({ function: "public._cycle_a" }),
          ruleId: "migration.jwt-guards",
        }),
        expect.objectContaining({
          evidence: expect.objectContaining({ function: "public._cycle_b" }),
          ruleId: "migration.jwt-guards",
        }),
      ])
    )
  })
})
