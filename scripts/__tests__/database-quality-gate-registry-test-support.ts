import { createHash } from "node:crypto"

function legacyInventorySha256(entries: unknown): string {
  return createHash("sha256").update(JSON.stringify(entries)).digest("hex")
}

export function validRegistries() {
  const legacy = [
    {
      path: "supabase/migrations/20241220_add_completion_tracking.sql",
      sha256: "1".repeat(64),
    },
  ]

  return {
    appliedLock: {
      applied: [] as Array<Record<string, unknown>>,
      cutover: {
        commit: "a".repeat(40),
        legacyInventorySha256: legacyInventorySha256(legacy),
        migrationRoot: "supabase/migrations",
      },
      legacy,
      schemaVersion: 1,
    },
    invariants: {
      invariants: [
        {
          classification: "rpc-only",
          evidence: ["Wayfinder #935"],
          expected: {
            allowedDirectAccess: [],
            boundary: "guarded-rpc",
            policyIdentities: ["deny_client_access"],
            rls: {
              enabled: true,
              forced: false,
            },
          },
          id: "public.nhan_vien.access",
          objectIdentity: "public.nhan_vien",
          owner: "postgres",
          rule: "table-access-contract",
          scope: "table-security",
          status: "active",
        },
      ],
      schemaVersion: 1,
    },
    sqlTests: {
      schemaVersion: 1,
      tests: [
        {
          evidence: ["existing smoke test"],
          fixtureContract: "isolated-fixture",
          path: "supabase/tests/equipment_list_enhanced_active_repair_smoke.sql",
          purpose: "smoke",
          runnerRequirements: ["psql"],
          safety: "default-safe",
          timeoutSeconds: 30,
          transactionContract: "rollback-required",
        },
      ],
    },
    waivers: {
      approvals: [] as Array<Record<string, unknown>>,
      schemaVersion: 1,
    },
  }
}
