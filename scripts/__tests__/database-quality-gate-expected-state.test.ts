import { describe, expect, it } from "vitest"

import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"
import {
  defaultExpectedStateCatalogAccess,
  expectedStateInvariantRegistry,
  ExpectedStateBaselineModule,
  ExpectedStateModule,
  expectedStatePolicy,
  expectedStateRpcOnlyInvariant,
  nhanVienDenyPolicies,
} from "./database-quality-gate-expected-state-test-support"

describe("database quality gate expected state", () => {
  it("fails closed for unavailable catalog evidence and unknown table intent", async () => {
    const expectedState = await loadDatabaseQualityGateModule<ExpectedStateModule>("expected-state")
    const unavailable = expectedState.evaluateCatalogContracts({
      invariants: expectedStateInvariantRegistry(),
    })
    const unknownIntent = expectedState.evaluateCatalogContracts({
      access: defaultExpectedStateCatalogAccess(),
      invariants: expectedStateInvariantRegistry([
        {
          ...expectedStateRpcOnlyInvariant,
          classification: "unreviewed",
        },
      ]),
    })

    expect(unavailable.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification: "INCOMPLETE",
          ruleId: "catalog.access.unavailable",
        }),
      ])
    )
    expect(unknownIntent.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification: "INCOMPLETE",
          ruleId: "catalog.table-intent.unknown",
        }),
      ])
    )
  })

  it("keeps explicit unresolved table authority incomplete without inferring an access contract", async () => {
    const expectedState = await loadDatabaseQualityGateModule<ExpectedStateModule>("expected-state")
    const result = expectedState.evaluateCatalogContracts({
      access: {
        routines: [],
        tables: [
          {
            grants: [{ operations: ["SELECT"], role: "authenticated" }],
            identity: "public.thiet_bi",
            owner: "postgres",
            policies: [],
            rls: {
              enabled: false,
              forced: false,
            },
          },
        ],
      },
      invariants: expectedStateInvariantRegistry([
        {
          evidence: ["Wayfinder #941 table-security decision"],
          id: "public.thiet_bi.access",
          objectIdentity: "public.thiet_bi",
          rule: "table-access-contract",
          scope: "table-security",
          status: "unresolved",
        },
      ]),
    })

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification: "INCOMPLETE",
          ruleId: "catalog.table-intent.unresolved",
        }),
      ])
    )
  })

  it("keeps identity-baselined historical debt visible while blocking new tables and widened access", async () => {
    const expectedState = await loadDatabaseQualityGateModule<ExpectedStateModule>("expected-state")
    const baseline = await loadDatabaseQualityGateModule<ExpectedStateBaselineModule>("baseline")
    const knownMismatch = expectedState.evaluateCatalogContracts({
      access: {
        routines: [],
        tables: [
          {
            grants: [{ operations: ["SELECT", "UPDATE"], role: "authenticated" }],
            identity: "public.don_vi",
            owner: "postgres",
            policies: [],
            rls: {
              enabled: false,
              forced: false,
            },
          },
        ],
      },
      invariants: expectedStateInvariantRegistry([
        {
          classification: "app-facing",
          evidence: ["Wayfinder #935"],
          expected: {
            allowedDirectAccess: [{ operations: ["SELECT"], role: "authenticated" }],
            boundary: "direct-data-api",
            policyIdentities: ["don_vi_read"],
            rls: {
              enabled: true,
              forced: false,
            },
          },
          id: "public.don_vi.access",
          objectIdentity: "public.don_vi",
          owner: "postgres",
          rule: "table-access-contract",
          scope: "table-security",
          status: "baseline-debt",
        },
      ]),
    })
    const widenedAccess = expectedState.evaluateCatalogContracts({
      access: {
        routines: [],
        tables: [
          {
            grants: [{ operations: ["DELETE", "SELECT", "UPDATE"], role: "authenticated" }],
            identity: "public.don_vi",
            owner: "postgres",
            policies: [],
            rls: {
              enabled: false,
              forced: false,
            },
          },
          {
            grants: [{ operations: ["SELECT"], role: "anon" }],
            identity: "public.new_table",
            owner: "postgres",
            policies: [],
            rls: {
              enabled: false,
              forced: false,
            },
          },
        ],
      },
      invariants: expectedStateInvariantRegistry([
        {
          classification: "app-facing",
          evidence: ["Wayfinder #935"],
          expected: {
            allowedDirectAccess: [{ operations: ["SELECT"], role: "authenticated" }],
            boundary: "direct-data-api",
            policyIdentities: ["don_vi_read"],
            rls: {
              enabled: true,
              forced: false,
            },
          },
          id: "public.don_vi.access",
          objectIdentity: "public.don_vi",
          owner: "postgres",
          rule: "table-access-contract",
          scope: "table-security",
          status: "baseline-debt",
        },
      ]),
    })
    const baselineComparison = baseline.compareFindingBaseline({
      baseline: knownMismatch.findings,
      current: knownMismatch.findings,
    })
    const widenedComparison = baseline.compareFindingBaseline({
      baseline: knownMismatch.findings,
      current: widenedAccess.findings,
    })

    expect(baselineComparison.outcome).toBe("PASS")
    expect(widenedComparison.outcome).toBe("FAILED")
    expect(widenedComparison.newFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification: "BLOCKING",
          ruleId: "catalog.access.operations",
        }),
        expect.objectContaining({
          classification: "INCOMPLETE",
          ruleId: "catalog.table-intent.missing",
        }),
      ])
    )
  })

  it("blocks PUBLIC grants and unexpected policies outside the intended access contract", async () => {
    const expectedState = await loadDatabaseQualityGateModule<ExpectedStateModule>("expected-state")
    const result = expectedState.evaluateCatalogContracts({
      access: defaultExpectedStateCatalogAccess({
        tables: [
          {
            grants: [{ operations: ["SELECT"], role: "PUBLIC" }],
            identity: "public.nhan_vien",
            owner: "postgres",
            policies: [
              ...nhanVienDenyPolicies,
              expectedStatePolicy({ identity: "unexpected_client_policy" }),
            ],
            rls: {
              enabled: true,
              forced: false,
            },
          },
        ],
      }),
      invariants: expectedStateInvariantRegistry(),
    })

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification: "BLOCKING",
          ruleId: "catalog.access.public-grant",
        }),
        expect.objectContaining({
          classification: "BLOCKING",
          ruleId: "catalog.access.policies",
        }),
      ])
    )
  })

  it("blocks a missing active invariant table from the observed access catalog", async () => {
    const expectedState = await loadDatabaseQualityGateModule<ExpectedStateModule>("expected-state")
    const result = expectedState.evaluateCatalogContracts({
      access: {
        routines: [],
        tables: [],
      },
      invariants: expectedStateInvariantRegistry(),
    })

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification: "BLOCKING",
          ruleId: "catalog.table.missing",
        }),
      ])
    )
  })

  it("blocks SECURITY DEFINER routines whose search path is present but unsafe", async () => {
    const expectedState = await loadDatabaseQualityGateModule<ExpectedStateModule>("expected-state")
    const result = expectedState.evaluateCatalogContracts({
      access: defaultExpectedStateCatalogAccess({
        routines: [
          {
            executionMode: "definer",
            grants: [],
            identity: "public.unsafe_catalog_probe()",
            owner: "postgres",
            searchPath: "public",
          },
        ],
      }),
      invariants: expectedStateInvariantRegistry(),
    })

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification: "BLOCKING",
          ruleId: "catalog.routine.search-path",
        }),
      ])
    )
  })

  it("selects only declared default-safe SQL tests for the default lane", async () => {
    const expectedState = await loadDatabaseQualityGateModule<ExpectedStateModule>("expected-state")
    const selected = expectedState.selectDefaultSafeSqlTests({
      schemaVersion: 1,
      tests: [
        {
          evidence: ["Wayfinder #935"],
          fixtureContract: "isolated-fixture",
          path: "supabase/tests/default-safe.sql",
          purpose: "smoke",
          runnerRequirements: ["psql"],
          safety: "default-safe",
          timeoutSeconds: 30,
          transactionContract: "rollback-required",
        },
        {
          evidence: ["Wayfinder #935"],
          fixtureContract: "isolated-fixture",
          path: "supabase/tests/dblink.sql",
          purpose: "smoke",
          runnerRequirements: ["dblink", "psql"],
          safety: "default-safe",
          timeoutSeconds: 30,
          transactionContract: "rollback-required",
        },
        {
          evidence: ["Wayfinder #935"],
          fixtureContract: "isolated-fixture",
          path: "supabase/tests/opt-in.sql",
          purpose: "smoke",
          runnerRequirements: ["psql"],
          safety: "opt-in",
          timeoutSeconds: 30,
          transactionContract: "rollback-required",
        },
        {
          evidence: ["Wayfinder #935"],
          fixtureContract: "isolated-fixture",
          path: "supabase/tests/performance.sql",
          purpose: "performance",
          runnerRequirements: ["psql"],
          safety: "default-safe",
          timeoutSeconds: 30,
          transactionContract: "rollback-required",
        },
        {
          evidence: ["Wayfinder #935"],
          fixtureContract: "isolated-fixture",
          path: "supabase/tests/concurrency.sql",
          purpose: "concurrency",
          runnerRequirements: ["psql"],
          safety: "default-safe",
          timeoutSeconds: 30,
          transactionContract: "rollback-required",
        },
        {
          evidence: ["Wayfinder #935"],
          fixtureContract: "external-fixture",
          path: "supabase/tests/live.sql",
          purpose: "live-acceptance",
          runnerRequirements: ["psql"],
          safety: "live-only",
          timeoutSeconds: 30,
          transactionContract: "isolated-database",
        },
      ],
    })

    expect(selected).toEqual([
      expect.objectContaining({
        path: "supabase/tests/default-safe.sql",
      }),
    ])
  })
})
