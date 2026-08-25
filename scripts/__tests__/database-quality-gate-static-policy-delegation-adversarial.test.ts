import { afterEach, describe, expect, it } from "vitest"

import { cleanupFixtureRepositories } from "./database-quality-gate-test-support"
import {
  candidateSql,
  CANONICAL_GUARD,
  runCandidate,
} from "./database-quality-gate-static-policy-delegation-test-support"

afterEach(cleanupFixtureRepositories)

function directGuardFunction(signature: string, revoke: string): string {
  return [
    `CREATE OR REPLACE FUNCTION public._overloaded_guard(${signature}) RETURNS void`,
    "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
    "DECLARE",
    "  v_role text;",
    "  v_user_id text;",
    "BEGIN",
    "  v_role := NULLIF(current_setting('request.jwt.claims', true)::json->>'app_role', '');",
    "  v_user_id := NULLIF(current_setting('request.jwt.claims', true)::json->>'user_id', '');",
    "  IF v_role IS NULL OR v_role = '' THEN",
    "    RAISE EXCEPTION 'permission_denied' USING errcode = '42501';",
    "  END IF;",
    "  IF v_user_id IS NULL THEN",
    "    RAISE EXCEPTION 'permission_denied' USING errcode = '42501';",
    "  END IF;",
    "END;",
    "$$;",
    revoke,
  ].join("\n")
}

function internalModule(body: string, declaration = ""): string {
  return [
    "CREATE OR REPLACE FUNCTION public._module_operation() RETURNS void",
    "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
    declaration,
    "BEGIN",
    body,
    "END;",
    "$$;",
    "REVOKE EXECUTE ON FUNCTION public._module_operation() FROM PUBLIC, anon, authenticated;",
  ]
    .filter(Boolean)
    .join("\n")
}

describe("database quality gate JWT delegation adversarial cases", () => {
  it.each([
    {
      guard: CANONICAL_GUARD.replace("'{}'", `'{"app_role":"global","user_id":"1"}'`),
      name: "privileged claims-object fallback",
    },
    {
      guard: CANONICAL_GUARD.replace(
        "    v_role := lower(NULLIF(v_claims->>'app_role', ''));",
        [
          `    v_claims := '{"app_role":"global","user_id":"1"}';`,
          "    v_role := lower(NULLIF(v_claims->>'app_role', ''));",
        ].join("\n")
      ),
      name: "claims-object reassignment",
    },
    {
      guard: CANONICAL_GUARD.replace(
        "    v_role := lower(NULLIF(v_claims->>'app_role', ''));",
        [
          `    v_claims = '{"app_role":"global","user_id":"1"}';`,
          "    v_role := lower(NULLIF(v_claims->>'app_role', ''));",
        ].join("\n")
      ),
      name: "claims-object reassignment with equals",
    },
  ])("rejects $name", async ({ guard }) => {
    const result = await runCandidate(candidateSql(guard))

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        evidence: expect.objectContaining({ function: "public._require_authorized_user" }),
        ruleId: "migration.jwt-guards",
      })
    )
  })

  it("allows role-claim fallback only for the approved Phase 11 guard identity", async () => {
    const migrationPath =
      "supabase/migrations/20260824132410_add_technical_configuration_authorized_user_guard.sql"
    const landedSql = await import("node:fs").then(({ readFileSync }) =>
      readFileSync(migrationPath, "utf8")
    )
    const result = await runCandidate(landedSql)

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        evidence: expect.objectContaining({
          function: "public._technical_configuration_require_authorized_user",
        }),
        ruleId: "migration.jwt-guards",
      })
    )
  })

  it("fails closed when ACL revokes are split across overloads", async () => {
    const result = await runCandidate(
      candidateSql(
        directGuardFunction(
          "p_value bigint",
          "REVOKE EXECUTE ON FUNCTION public._overloaded_guard(bigint) FROM PUBLIC;"
        ),
        directGuardFunction(
          "p_value text",
          [
            "REVOKE EXECUTE ON FUNCTION public._overloaded_guard(text)",
            "  FROM anon, authenticated;",
          ].join("\n")
        )
      )
    )

    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.function-overload-ambiguous" })
    )
  })

  it("rejects direct guards nested under conditional control flow", async () => {
    const conditionalGuard = [
      "CREATE OR REPLACE FUNCTION public.conditional_rpc() RETURNS void",
      "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
      "DECLARE",
      "  v_role text;",
      "  v_user_id text;",
      "BEGIN",
      "  IF false THEN",
      "    v_role := NULLIF(current_setting('request.jwt.claims', true)::json->>'app_role', '');",
      "    v_user_id := NULLIF(current_setting('request.jwt.claims', true)::json->>'user_id', '');",
      "    IF v_role IS NULL OR v_role = '' THEN",
      "      RAISE EXCEPTION 'permission_denied' USING errcode = '42501';",
      "    END IF;",
      "    IF v_user_id IS NULL THEN",
      "      RAISE EXCEPTION 'permission_denied' USING errcode = '42501';",
      "    END IF;",
      "  END IF;",
      "  PERFORM public.persist_module_change();",
      "END;",
      "$$;",
      "REVOKE EXECUTE ON FUNCTION public.conditional_rpc() FROM PUBLIC;",
      "GRANT EXECUTE ON FUNCTION public.conditional_rpc() TO authenticated;",
    ].join("\n")
    const result = await runCandidate(candidateSql(conditionalGuard))

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        evidence: expect.objectContaining({ function: "public.conditional_rpc" }),
        ruleId: "migration.jwt-guards",
      })
    )
  })

  it("rejects canonical guards nested under conditional control flow", async () => {
    const nestedGuard = CANONICAL_GUARD.replace(
      "BEGIN\n  BEGIN",
      "BEGIN\n  IF false THEN\n  BEGIN"
    ).replace("  RETURN v_user_id;\nEND;", "  RETURN v_user_id;\n  END IF;\nEND;")
    const result = await runCandidate(candidateSql(nestedGuard))

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        evidence: expect.objectContaining({ function: "public._require_authorized_user" }),
        ruleId: "migration.jwt-guards",
      })
    )
  })

  it.each([
    {
      module: internalModule(
        [
          "  PERFORM public._require_authorized_user(public.persist_module_change());",
          "  PERFORM public.persist_module_change();",
        ].join("\n")
      ),
      name: "business SQL in guard arguments",
    },
    {
      module: internalModule(
        "  PERFORM public._require_authorized_user();",
        "DECLARE\n  v_result bigint := public.persist_module_change();"
      ),
      name: "executable DECLARE initializer",
    },
    {
      module: internalModule(
        [
          "  TRUNCATE TABLE public.module_changes;",
          "  PERFORM public._require_authorized_user();",
        ].join("\n")
      ),
      name: "TRUNCATE before delegation",
    },
    {
      module: internalModule(
        [
          "  NOTIFY module_changes, 'unauthorized';",
          "  PERFORM public._require_authorized_user();",
        ].join("\n")
      ),
      name: "NOTIFY before delegation",
    },
    {
      module: internalModule(
        "  PERFORM public._require_authorized_user();",
        "DECLARE\n  v_result bigint := (SELECT 1);"
      ),
      name: "SELECT declaration initializer",
    },
    {
      module: internalModule(
        [
          "  BEGIN",
          "    PERFORM public._require_authorized_user();",
          "  EXCEPTION WHEN others THEN",
          "    RAISE NOTICE 'ignored';",
          "  END;",
          "  PERFORM public.persist_module_change();",
        ].join("\n")
      ),
      name: "RAISE NOTICE exception swallowing",
    },
    {
      module: internalModule(
        [
          "  BEGIN",
          "    PERFORM public._require_authorized_user();",
          "  EXCEPTION",
          "    WHEN insufficient_privilege THEN RAISE;",
          "    WHEN others THEN NULL;",
          "  END;",
          "  PERFORM public.persist_module_change();",
        ].join("\n")
      ),
      name: "one swallowing handler among multiple handlers",
    },
  ])("rejects $name", async ({ module }) => {
    const result = await runCandidate(candidateSql(CANONICAL_GUARD, module))

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        evidence: expect.objectContaining({ function: "public._module_operation" }),
        ruleId: "migration.jwt-guards",
      })
    )
  })

  it("rejects canonical user identity expressions with trailing arithmetic", async () => {
    const rewrittenUserId = CANONICAL_GUARD.replace(
      "    v_user_id := NULLIF(v_claims->>'user_id', '')::bigint;",
      "    v_user_id := NULLIF(v_claims->>'user_id', '')::bigint * 0 + 1;"
    )
    const result = await runCandidate(candidateSql(rewrittenUserId))

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        evidence: expect.objectContaining({ function: "public._require_authorized_user" }),
        ruleId: "migration.jwt-guards",
      })
    )
  })

  it("rejects executable expressions in permission RAISE arguments", async () => {
    const executableRaise = CANONICAL_GUARD.replace(
      [
        "     OR NOT EXISTS (SELECT 1 FROM public.nhan_vien WHERE id = v_user_id) THEN",
        "    RAISE EXCEPTION 'permission_denied' USING errcode = '42501';",
      ].join("\n"),
      [
        "     OR NOT EXISTS (SELECT 1 FROM public.nhan_vien WHERE id = v_user_id) THEN",
        "    RAISE EXCEPTION USING",
        "      message = public.persist_module_change()::text,",
        "      errcode = '42501';",
      ].join("\n")
    )
    const result = await runCandidate(candidateSql(executableRaise))

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        evidence: expect.objectContaining({ function: "public._require_authorized_user" }),
        ruleId: "migration.jwt-guards",
      })
    )
  })

  it("rejects negated NULL checks in a canonical guard", async () => {
    const negatedChecks = CANONICAL_GUARD.replace(
      ["  IF v_role IS NULL", "     OR v_user_id IS NULL"].join("\n"),
      ["  IF NOT (v_role IS NULL)", "     OR NOT (v_user_id IS NULL)"].join("\n")
    )
    const result = await runCandidate(candidateSql(negatedChecks))

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        evidence: expect.objectContaining({ function: "public._require_authorized_user" }),
        ruleId: "migration.jwt-guards",
      })
    )
  })

  it.each([
    {
      guard: CANONICAL_GUARD.replace(
        ["  IF v_role IS NULL", "     OR v_user_id IS NULL"].join("\n"),
        ["  IF (v_role IS NULL", "      OR v_user_id IS NULL) IS FALSE"].join("\n")
      ),
      name: "semantically negated canonical predicate",
    },
    {
      guard: directGuardFunction(
        "",
        "REVOKE EXECUTE ON FUNCTION public._overloaded_guard() FROM PUBLIC, anon, authenticated;"
      ).replace(
        "IF v_role IS NULL OR v_role = '' THEN",
        "IF (v_role IS NULL) = (v_role = '') THEN"
      ),
      name: "composed direct predicate",
    },
  ])("rejects $name", async ({ guard }) => {
    const result = await runCandidate(candidateSql(guard))

    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.jwt-guards" })
    )
  })

  it.each([
    {
      guard: directGuardFunction(
        "",
        "REVOKE EXECUTE ON FUNCTION public._overloaded_guard() FROM PUBLIC, anon, authenticated;"
      ).replace(
        "BEGIN\n  v_role :=",
        "BEGIN\n  v_result := public.persist_module_change();\n  v_role :="
      ),
      name: "direct pre-guard assignment call",
    },
    {
      guard: CANONICAL_GUARD.replace(
        "     OR NOT EXISTS (SELECT 1 FROM public.nhan_vien WHERE id = v_user_id) THEN",
        [
          "     OR public.persist_module_change()",
          "     OR NOT EXISTS (SELECT 1 FROM public.nhan_vien WHERE id = v_user_id) THEN",
        ].join("\n")
      ),
      name: "canonical guard-condition call",
    },
  ])("rejects $name", async ({ guard }) => {
    const result = await runCandidate(candidateSql(guard))

    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.jwt-guards" })
    )
  })

  it("rejects an unreachable rethrow after a handler return", async () => {
    const module = internalModule(
      [
        "  BEGIN",
        "    PERFORM public._require_authorized_user();",
        "  EXCEPTION WHEN others THEN",
        "    RETURN;",
        "    RAISE;",
        "  END;",
        "  PERFORM public.persist_module_change();",
      ].join("\n")
    )
    const result = await runCandidate(candidateSql(CANONICAL_GUARD, module))

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        evidence: expect.objectContaining({ function: "public._module_operation" }),
        ruleId: "migration.jwt-guards",
      })
    )
  })
})
