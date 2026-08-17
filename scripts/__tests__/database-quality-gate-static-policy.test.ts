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

describe("database quality gate static SQL policies", () => {
  it("blocks a function overwrite whose migration sorts before an existing replacement", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      "-- migration\nBEGIN;\nCREATE OR REPLACE FUNCTION public.demo_fn() RETURNS void LANGUAGE sql AS $$ SELECT; $$;\nCOMMIT;\n",
      "supabase/migrations/20270101000000_candidate.sql"
    )
    const later = migration(
      "-- migration\nBEGIN;\nCREATE OR REPLACE FUNCTION public.demo_fn() RETURNS void LANGUAGE sql AS $$ SELECT; $$;\nCOMMIT;\n",
      "supabase/migrations/20270102000000_later.sql"
    )
    const repository = fixtureWithStaticMetadata(candidate, later)

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.outcome).toBe("FAILED")
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        classification: "BLOCKING",
        ruleId: "migration.source-order-overwrite",
      })
    )
  })

  it("blocks mandatory SECURITY DEFINER, JWT, explicit-grant, and ILIKE policy violations", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      [
        "-- migration",
        "BEGIN;",
        "CREATE TABLE public.unsafe_table (id bigint PRIMARY KEY);",
        "CREATE OR REPLACE FUNCTION public.unsafe_rpc() RETURNS void",
        "LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN; END; $$;",
        "GRANT EXECUTE ON FUNCTION public.unsafe_rpc() TO authenticated;",
        "SELECT * FROM public.unsafe_table WHERE name ILIKE '%' || p_search || '%';",
        "COMMIT;",
        "",
      ].join("\n")
    )
    const repository = fixtureWithStaticMetadata(candidate)

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.outcome).toBe("FAILED")
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "migration.explicit-grants" }),
        expect.objectContaining({ ruleId: "migration.ilike-sanitization" }),
        expect.objectContaining({ ruleId: "migration.jwt-guards" }),
        expect.objectContaining({ ruleId: "migration.security-definer-execute-revoke" }),
        expect.objectContaining({ ruleId: "migration.security-definer-search-path" }),
      ])
    )
  })

  it("blocks raw LIKE patterns both directly and when wrapped in parentheses", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const direct = migration(
      "-- migration\nBEGIN;\nSELECT * FROM public.search_source WHERE name LIKE '%' || p_unsafe || '%';\nCOMMIT;\n"
    )
    const wrapped = migration(
      "-- migration\nBEGIN;\nSELECT * FROM public.search_source WHERE name ILIKE ('%' || p_unsafe || '%');\nCOMMIT;\n",
      "supabase/migrations/20270102000000_wrapped.sql"
    )
    const repository = fixtureWithStaticMetadata(direct, wrapped)

    for (const candidate of [direct, wrapped]) {
      const result = runStatic(source, repository.root, [candidate.path])

      expect(result.outcome).toBe("FAILED")
      expect(result.findings).toContainEqual(
        expect.objectContaining({ ruleId: "migration.ilike-sanitization" })
      )
    }
  })

  it("does not let a sanitized pattern hide a raw LIKE pattern in the same statement", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      [
        "-- migration",
        "BEGIN;",
        "SELECT * FROM public.search_source",
        "WHERE unsafe_name LIKE '%' || p_unsafe || '%'",
        "OR safe_name LIKE '%' || _sanitize_ilike_pattern(p_safe) || '%';",
        "COMMIT;",
        "",
      ].join("\n")
    )
    const repository = fixtureWithStaticMetadata(candidate)

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.outcome).toBe("FAILED")
    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.ilike-sanitization" })
    )
  })

  it("blocks nested and cast raw LIKE patterns", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      [
        "-- migration",
        "BEGIN;",
        "SELECT * FROM public.search_source",
        "WHERE name ILIKE (('%'::text) || p_unsafe || '%')",
        "OR alias ILIKE CAST('%' AS text) || p_other || '%';",
        "COMMIT;",
        "",
      ].join("\n")
    )
    const repository = fixtureWithStaticMetadata(candidate)

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.outcome).toBe("FAILED")
    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.ilike-sanitization" })
    )
  })

  it("accepts a table deny baseline regardless of revoke order", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      "-- migration\nBEGIN;\nCREATE TABLE public.ready (id bigint);\nREVOKE ALL ON TABLE public.ready FROM public, anon, authenticated;\nCOMMIT;\n"
    )
    const repository = fixtureWithStaticMetadata(candidate)

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.outcome).toBe("PASS")
    expect(result.findings).not.toContainEqual(
      expect.objectContaining({ ruleId: "migration.explicit-grants" })
    )
  })

  it("accepts a table deny baseline spread across separate revoke statements", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      [
        "-- migration",
        "BEGIN;",
        "CREATE TABLE public.ready (id bigint);",
        "REVOKE ALL ON TABLE public.ready FROM authenticated;",
        "REVOKE ALL ON TABLE public.ready FROM public;",
        "REVOKE ALL ON TABLE public.ready FROM anon;",
        "COMMIT;",
        "",
      ].join("\n")
    )
    const repository = fixtureWithStaticMetadata(candidate)

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.outcome).toBe("PASS")
    expect(result.findings).not.toContainEqual(
      expect.objectContaining({ ruleId: "migration.explicit-grants" })
    )
  })

  it("does not accept grants or revokes that only appear in SQL comments or literals", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      [
        "-- migration",
        "BEGIN;",
        "CREATE TABLE public.unsafe_table (id bigint PRIMARY KEY);",
        "-- REVOKE ALL ON TABLE public.unsafe_table FROM anon, authenticated, public;",
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
        "SELECT 'GRANT EXECUTE ON FUNCTION public.unsafe_rpc() TO authenticated;';",
        "SELECT 'REVOKE EXECUTE ON FUNCTION public.unsafe_rpc() FROM PUBLIC;';",
        "COMMIT;",
        "",
      ].join("\n")
    )
    const repository = fixtureWithStaticMetadata(candidate)

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "migration.explicit-grants" }),
        expect.objectContaining({ ruleId: "migration.security-definer-execute-grant" }),
        expect.objectContaining({ ruleId: "migration.security-definer-execute-revoke" }),
      ])
    )
  })
})
