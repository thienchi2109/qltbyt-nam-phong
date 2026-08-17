export type ExpectedStateCatalogFinding = {
  classification: "BLOCKING" | "INCOMPLETE"
  fingerprint: string
  ruleId: string
}

export type ExpectedStateModule = {
  collectAccessFingerprint: (input: unknown) => string
  collectApplicationFingerprint: (input: unknown) => string
  collectEnvironmentFingerprint: (input: unknown) => string
  evaluateCatalogContracts: (input: unknown) => {
    findings: ExpectedStateCatalogFinding[]
  }
  selectDefaultSafeSqlTests: (input: unknown) => Array<{ path: string }>
}

export type ExpectedStateBaselineModule = {
  compareFindingBaseline: (input: {
    baseline: ExpectedStateCatalogFinding[]
    current: ExpectedStateCatalogFinding[]
  }) => {
    newFindings: ExpectedStateCatalogFinding[]
    outcome: "FAILED" | "PASS"
  }
}

export function expectedStatePolicy(
  overrides: Partial<{
    command: "ALL" | "DELETE" | "INSERT" | "SELECT" | "UPDATE"
    identity: string
    permissive: boolean
    roles: string[]
    using: string | null
    withCheck: string | null
  }> = {}
) {
  return {
    command: "SELECT" as const,
    identity: "nhan_vien_deny_select",
    permissive: true,
    roles: ["anon", "authenticated"],
    using: "false",
    withCheck: null,
    ...overrides,
  }
}

export const nhanVienDenyPolicies = [
  expectedStatePolicy({ command: "DELETE", identity: "nhan_vien_deny_delete" }),
  expectedStatePolicy({
    command: "INSERT",
    identity: "nhan_vien_deny_insert",
    using: null,
    withCheck: "false",
  }),
  expectedStatePolicy({ command: "SELECT", identity: "nhan_vien_deny_select" }),
  expectedStatePolicy({
    command: "UPDATE",
    identity: "nhan_vien_deny_update",
    withCheck: "false",
  }),
]

export const expectedStateRpcOnlyInvariant = {
  classification: "rpc-only",
  evidence: ["Wayfinder #935"],
  expected: {
    allowedDirectAccess: [],
    boundary: "guarded-rpc",
    policyIdentities: nhanVienDenyPolicies.map((policy) => policy.identity),
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
}

export function expectedStateInvariantRegistry(
  invariants: unknown[] = [expectedStateRpcOnlyInvariant]
) {
  return {
    invariants,
    schemaVersion: 1,
  }
}

export function defaultExpectedStateCatalogAccess(overrides: Record<string, unknown> = {}) {
  return {
    routines: [],
    tables: [
      {
        grants: [],
        identity: "public.nhan_vien",
        owner: "postgres",
        policies: nhanVienDenyPolicies,
        rls: {
          enabled: true,
          forced: false,
        },
      },
    ],
    ...overrides,
  }
}
