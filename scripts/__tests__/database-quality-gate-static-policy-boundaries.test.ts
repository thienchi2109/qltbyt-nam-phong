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

afterEach(cleanupFixtureRepositories)

describe("database quality gate static policy boundaries", () => {
  it("does not accept a commented COMMIT or a body comment as SECURITY DEFINER search-path evidence", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      [
        "-- migration",
        "BEGIN;",
        "CREATE OR REPLACE FUNCTION public.comment_only_path() RETURNS void",
        "LANGUAGE plpgsql SECURITY DEFINER AS $$",
        "BEGIN",
        "  -- SET search_path = public, pg_temp",
        "  v_role := NULLIF(current_setting('request.jwt.claims', true)::json->>'app_role', '');",
        "  v_user_id := NULLIF(current_setting('request.jwt.claims', true)::json->>'user_id', '');",
        "  IF v_role IS NULL THEN RAISE EXCEPTION 'Missing role' USING errcode = '42501'; END IF;",
        "  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Missing user' USING errcode = '42501'; END IF;",
        "END;",
        "$$;",
        "REVOKE EXECUTE ON FUNCTION public.comment_only_path() FROM PUBLIC;",
        "GRANT EXECUTE ON FUNCTION public.comment_only_path() TO authenticated;",
        "-- COMMIT;",
        "",
      ].join("\n")
    )
    const repository = fixtureWithStaticMetadata(candidate)

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "migration.security-definer-search-path" }),
        expect.objectContaining({ ruleId: "migration.transaction-wrapper" }),
      ])
    )
  })

  it("keeps DANGEROUS matching and evidence inside one lexical top-level statement", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      [
        "-- migration",
        "BEGIN;",
        "ALTER TABLE public.items ADD COLUMN note text;",
        "SELECT 1; SET NOT NULL;",
        "DELETE FROM public.items WHERE note = 'semicolon; stays in literal';",
        "COMMIT;",
        "",
      ].join("\n")
    )
    const repository = fixtureWithStaticMetadata(candidate)

    const result = runStatic(source, repository.root, [candidate.path])
    const dangerous = result.findings.filter(
      (finding) => finding.ruleId === "migration.dangerous-statement"
    )

    expect(dangerous).not.toContainEqual(
      expect.objectContaining({ evidence: expect.objectContaining({ reason: "set-not-null" }) })
    )
    expect(dangerous).toContainEqual(
      expect.objectContaining({
        evidence: expect.objectContaining({
          reason: "delete",
          statement: "DELETE FROM public.items WHERE note = 'semicolon; stays in literal';",
        }),
      })
    )
  })

  it("does not let a SECURITY DEFINER function borrow JWT guards from a later DO block", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      [
        "-- migration",
        "BEGIN;",
        "CREATE OR REPLACE FUNCTION public.external_guard_decoy() RETURNS void",
        "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
        "BEGIN",
        "  PERFORM 1;",
        "END;",
        "$$;",
        "DO $$",
        "DECLARE",
        "  v_role text;",
        "  v_user_id text;",
        "BEGIN",
        "  v_role := NULLIF(current_setting('request.jwt.claims', true)::json->>'app_role', '');",
        "  v_user_id := NULLIF(current_setting('request.jwt.claims', true)::json->>'user_id', '');",
        "  IF v_role IS NULL THEN RAISE EXCEPTION 'Missing role' USING errcode = '42501'; END IF;",
        "  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Missing user' USING errcode = '42501'; END IF;",
        "END;",
        "$$;",
        "REVOKE EXECUTE ON FUNCTION public.external_guard_decoy() FROM PUBLIC;",
        "GRANT EXECUTE ON FUNCTION public.external_guard_decoy() TO authenticated;",
        "COMMIT;",
        "",
      ].join("\n")
    )
    const repository = fixtureWithStaticMetadata(candidate)

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        evidence: expect.objectContaining({ function: "public.external_guard_decoy" }),
        ruleId: "migration.jwt-guards",
      })
    )
  })

  it("marks a DO block with procedural dynamic SQL incomplete", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      [
        "-- migration",
        "BEGIN;",
        "DO $$",
        "BEGIN",
        "  EXECUTE 'CREATE TABLE public.dynamic_unsafe (id bigint PRIMARY KEY)';",
        "END;",
        "$$;",
        "COMMIT;",
        "",
      ].join("\n")
    )
    const repository = fixtureWithStaticMetadata(candidate)

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.outcome).toBe("INCOMPLETE")
    expect(result.requiredChecksComplete).toBe(false)
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "migration.dynamic-sql",
        evidence: expect.objectContaining({ migration: candidate.path }),
      })
    )
  })

  it("fails closed for an unqualified CREATE TABLE", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      [
        "-- migration",
        "BEGIN;",
        "CREATE TABLE unsafe_unqualified (id bigint PRIMARY KEY);",
        "COMMIT;",
        "",
      ].join("\n")
    )
    const repository = fixtureWithStaticMetadata(candidate)

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "migration.unqualified-create-table",
        evidence: expect.objectContaining({
          migration: candidate.path,
          table: "unsafe_unqualified",
        }),
      })
    )
  })

  it("retains DANGEROUS evidence for DELETE and DROP inside a DO block", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      [
        "-- migration",
        "BEGIN;",
        "DO $$",
        "BEGIN",
        "  DELETE FROM public.unsafe_rows;",
        "  DROP TABLE public.unsafe_temporary_rows;",
        "END;",
        "$$;",
        "COMMIT;",
        "",
      ].join("\n")
    )
    const repository = fixtureWithStaticMetadata(candidate)

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification: "DANGEROUS",
          evidence: expect.objectContaining({
            reason: "delete",
            statement: "DELETE FROM public.unsafe_rows;",
          }),
          ruleId: "migration.dangerous-statement",
        }),
        expect.objectContaining({
          classification: "DANGEROUS",
          evidence: expect.objectContaining({
            reason: "drop-table",
            statement: "DROP TABLE public.unsafe_temporary_rows;",
          }),
          ruleId: "migration.dangerous-statement",
        }),
      ])
    )
  })

  it("requires DANGEROUS approval evidence for DROP POLICY", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      "-- migration\nBEGIN;\nDROP POLICY tenant_isolation ON public.unsafe_rows;\nCOMMIT;\n"
    )
    const repository = fixtureWithStaticMetadata(candidate)

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        classification: "DANGEROUS",
        evidence: expect.objectContaining({
          reason: "drop-object",
          statement: "DROP POLICY tenant_isolation ON public.unsafe_rows;",
        }),
        ruleId: "migration.dangerous-statement",
      })
    )
  })

  it("enforces explicit grants for CREATE UNLOGGED TABLE public", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      "-- migration\nBEGIN;\nCREATE UNLOGGED TABLE public.unlogged_unsafe (id bigint PRIMARY KEY);\nCOMMIT;\n"
    )
    const repository = fixtureWithStaticMetadata(candidate)

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        classification: "BLOCKING",
        evidence: expect.objectContaining({
          migration: candidate.path,
          table: "public.unlogged_unsafe",
        }),
        ruleId: "migration.explicit-grants",
      })
    )
  })

  it("marks procedural dynamic SQL in a function incomplete", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      [
        "-- migration",
        "BEGIN;",
        "CREATE OR REPLACE FUNCTION public.dynamic_function() RETURNS void",
        "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
        "DECLARE",
        "  v_role text;",
        "  v_user_id text;",
        "BEGIN",
        "  v_role := NULLIF(current_setting('request.jwt.claims', true)::json->>'app_role', '');",
        "  v_user_id := NULLIF(current_setting('request.jwt.claims', true)::json->>'user_id', '');",
        "  IF v_role IS NULL THEN RAISE EXCEPTION 'Missing role' USING errcode = '42501'; END IF;",
        "  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Missing user' USING errcode = '42501'; END IF;",
        "  EXECUTE 'CREATE TABLE public.dynamic_function_unsafe (id bigint PRIMARY KEY)';",
        "END;",
        "$$;",
        "REVOKE EXECUTE ON FUNCTION public.dynamic_function() FROM PUBLIC;",
        "GRANT EXECUTE ON FUNCTION public.dynamic_function() TO authenticated;",
        "COMMIT;",
        "",
      ].join("\n")
    )
    const repository = fixtureWithStaticMetadata(candidate)

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.outcome).toBe("INCOMPLETE")
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "migration.dynamic-sql",
        evidence: expect.objectContaining({
          migration: candidate.path,
          scope: "function:public.dynamic_function",
        }),
      })
    )
  })
})
