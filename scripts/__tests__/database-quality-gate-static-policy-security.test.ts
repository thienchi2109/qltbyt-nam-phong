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

describe("database quality gate static SQL policy security", () => {
  it("requires JWT guards for authenticated security-invoker RPCs", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      [
        "-- migration",
        "BEGIN;",
        "CREATE OR REPLACE FUNCTION public.invoker_rpc() RETURNS void",
        "LANGUAGE plpgsql SECURITY INVOKER AS $$ BEGIN RETURN; END; $$;",
        "GRANT EXECUTE ON FUNCTION public.invoker_rpc() TO authenticated;",
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

  it("does not require RPC grants or JWT guards for trigger and private helper functions", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      [
        "-- migration",
        "BEGIN;",
        "CREATE OR REPLACE FUNCTION public.audit_trigger() RETURNS trigger",
        "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
        "BEGIN RETURN NEW; END;",
        "$$;",
        "CREATE OR REPLACE FUNCTION private.internal_helper() RETURNS void",
        "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
        "BEGIN RETURN; END;",
        "$$;",
        "COMMIT;",
        "",
      ].join("\n")
    )
    const repository = fixtureWithStaticMetadata(candidate)

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.outcome).toBe("PASS")
  })

  it("requires a safe search path for every SECURITY DEFINER helper", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      [
        "-- migration",
        "BEGIN;",
        "CREATE OR REPLACE FUNCTION private.unsafe_helper() RETURNS void",
        "LANGUAGE plpgsql SECURITY DEFINER AS $$",
        "BEGIN RETURN; END;",
        "$$;",
        "COMMIT;",
        "",
      ].join("\n")
    )
    const repository = fixtureWithStaticMetadata(candidate)

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "migration.security-definer-search-path",
      })
    )
    expect(result.findings).not.toContainEqual(
      expect.objectContaining({
        ruleId: "migration.jwt-guards",
      })
    )
  })

  it("rejects extra schemas in a SECURITY DEFINER search path", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      [
        "-- migration",
        "BEGIN;",
        "CREATE OR REPLACE FUNCTION public.unsafe_path() RETURNS void",
        "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp, attacker AS $$",
        "BEGIN RETURN; END;",
        "$$;",
        "GRANT EXECUTE ON FUNCTION public.unsafe_path() TO authenticated;",
        "REVOKE EXECUTE ON FUNCTION public.unsafe_path() FROM PUBLIC;",
        "COMMIT;",
        "",
      ].join("\n")
    )
    const repository = fixtureWithStaticMetadata(candidate)

    expect(runStatic(source, repository.root, [candidate.path]).findings).toContainEqual(
      expect.objectContaining({
        ruleId: "migration.security-definer-search-path",
      })
    )
  })

  it("fails closed for ALTER FUNCTION SECURITY DEFINER without a verifiable path", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      [
        "-- migration",
        "BEGIN;",
        "ALTER FUNCTION public.existing_rpc() SECURITY DEFINER;",
        "COMMIT;",
        "",
      ].join("\n")
    )
    const repository = fixtureWithStaticMetadata(candidate)

    expect(runStatic(source, repository.root, [candidate.path]).findings).toContainEqual(
      expect.objectContaining({
        ruleId: "migration.security-definer-search-path",
      })
    )
  })

  it("blocks GRANT ALL PRIVILEGES and records dangerous function-body DML", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const grants = migration(
      [
        "-- migration",
        "BEGIN;",
        "CREATE TABLE public.privileged_table (id bigint PRIMARY KEY);",
        "REVOKE ALL ON TABLE public.privileged_table FROM anon, authenticated, public;",
        "GRANT ALL PRIVILEGES ON TABLE public.privileged_table TO authenticated;",
        "COMMIT;",
        "",
      ].join("\n")
    )
    const destructiveFunction = migration(
      [
        "-- migration",
        "BEGIN;",
        "CREATE OR REPLACE FUNCTION private.clear_legacy_rows() RETURNS void",
        "LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$",
        "BEGIN",
        "  DELETE FROM public.legacy_rows;",
        "END;",
        "$$;",
        "COMMIT;",
        "",
      ].join("\n"),
      "supabase/migrations/20270102000000_clear_legacy_rows.sql"
    )
    const repository = fixtureWithStaticMetadata(grants, destructiveFunction)

    const grantResult = runStatic(source, repository.root, [grants.path])
    const destructiveResult = runStatic(source, repository.root, [destructiveFunction.path])

    expect(grantResult.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.explicit-grants" })
    )
    expect(destructiveResult.findings).toContainEqual(
      expect.objectContaining({
        classification: "DANGEROUS",
        evidence: expect.objectContaining({
          reason: "delete",
          statement: "DELETE FROM public.legacy_rows;",
        }),
        ruleId: "migration.dangerous-statement",
      })
    )
  })
})
