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
  ]
    .filter(Boolean)
    .join("\n")
}

describe("database quality gate ACL replay adversarial cases", () => {
  it("normalizes WITH GRANT OPTION when detecting an exposed helper", async () => {
    const result = await runCandidate(
      candidateSql(
        CANONICAL_GUARD,
        [
          "GRANT EXECUTE ON FUNCTION public._require_authorized_user()",
          "  TO authenticated WITH GRANT OPTION;",
        ].join("\n")
      )
    )

    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.internal-helper-execute-grant" })
    )
  })

  it("normalizes quoted function identities when replaying ACL events", async () => {
    const result = await runCandidate(
      candidateSql(
        CANONICAL_GUARD,
        'GRANT EXECUTE ON FUNCTION "public"."_require_authorized_user"() TO authenticated;'
      )
    )

    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.internal-helper-execute-grant" })
    )
  })

  it("does not apply an ACL event for a different function signature", async () => {
    const result = await runCandidate(
      candidateSql(
        directGuardFunction(
          "p_value bigint",
          [
            "REVOKE EXECUTE ON FUNCTION public._overloaded_guard(text)",
            "  FROM PUBLIC, anon, authenticated;",
          ].join("\n")
        )
      )
    )

    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.security-definer-execute-revoke" })
    )
  })

  it.each([
    {
      name: "case-sensitive quoted schema",
      revoke: [
        'REVOKE EXECUTE ON FUNCTION "Public"."_overloaded_guard"(bigint)',
        "  FROM PUBLIC, anon, authenticated;",
      ].join("\n"),
      signature: "p_value bigint",
    },
    {
      name: "case-sensitive quoted grantee",
      revoke: [
        "REVOKE EXECUTE ON FUNCTION public._overloaded_guard()",
        '  FROM PUBLIC, anon, "Authenticated";',
      ].join("\n"),
      signature: "",
    },
  ])("does not fold $name into a public helper ACL", async ({ revoke, signature }) => {
    const result = await runCandidate(candidateSql(directGuardFunction(signature, revoke)))

    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.security-definer-execute-revoke" })
    )
  })

  it("preserves case-sensitive quoted types in function signatures", async () => {
    const result = await runCandidate(
      candidateSql(
        directGuardFunction(
          'p_value public."SecretType"',
          [
            'REVOKE EXECUTE ON FUNCTION public._overloaded_guard(public."secrettype")',
            "  FROM PUBLIC, anon, authenticated;",
          ].join("\n")
        )
      )
    )

    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.security-definer-execute-revoke" })
    )
  })

  it("does not apply a schema-wide revoke to functions created afterward", async () => {
    const result = await runCandidate(
      candidateSql(
        "REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;",
        directGuardFunction("", "")
      )
    )

    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.security-definer-execute-revoke" })
    )
  })

  it("uses final ACL state when an RPC grant is later revoked", async () => {
    const rpc = [
      "CREATE OR REPLACE FUNCTION public.module_operation() RETURNS void",
      "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
      "BEGIN",
      "  PERFORM public._require_authorized_user();",
      "END;",
      "$$;",
      "REVOKE EXECUTE ON FUNCTION public.module_operation() FROM PUBLIC;",
      "GRANT EXECUTE ON FUNCTION public.module_operation() TO authenticated;",
      "REVOKE EXECUTE ON FUNCTION public.module_operation() FROM authenticated;",
    ].join("\n")
    const result = await runCandidate(candidateSql(CANONICAL_GUARD, rpc))

    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.security-definer-execute-grant" })
    )
  })
})
