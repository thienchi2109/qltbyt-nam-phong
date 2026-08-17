import { describe, expect, it } from "vitest"

import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"

type ExpectedStateModule = {
  collectAccessFingerprint: (input: unknown) => string
  collectApplicationFingerprint: (input: unknown) => string
  collectEnvironmentFingerprint: (input: unknown) => string
}

describe("database quality gate fingerprints", () => {
  it("creates a portable application fingerprint without physical ordering or extension objects", async () => {
    const expectedState = await loadDatabaseQualityGateModule<ExpectedStateModule>("expected-state")
    const first = expectedState.collectApplicationFingerprint({
      relations: [
        {
          columns: [
            {
              dataType: "uuid",
              name: "id",
              nullable: false,
              ordinal: 2,
            },
            {
              dataType: "text",
              name: "ma_thiet_bi",
              nullable: false,
              ordinal: 1,
            },
          ],
          constraints: [{ definition: "PRIMARY KEY (id)", name: "thiet_bi_pkey" }],
          identity: "public.thiet_bi",
          indexes: [{ definition: "CREATE INDEX thiet_bi_ma_idx", name: "thiet_bi_ma_idx" }],
          kind: "table",
          triggers: [{ definition: "BEFORE UPDATE", name: "audit_thiet_bi" }],
        },
        {
          extensionOwned: true,
          identity: "extensions.vector_columns",
          kind: "view",
        },
      ],
      routines: [
        {
          definition: "SELECT id FROM public.thiet_bi",
          identity: "public.equipment_list()",
          kind: "function",
        },
      ],
    })
    const reordered = expectedState.collectApplicationFingerprint({
      relations: [
        {
          columns: [
            {
              dataType: "text",
              name: "ma_thiet_bi",
              nullable: false,
              ordinal: 99,
            },
            {
              dataType: "uuid",
              name: "id",
              nullable: false,
              ordinal: 1,
            },
          ],
          constraints: [{ definition: "PRIMARY KEY (id)", name: "thiet_bi_pkey" }],
          identity: "public.thiet_bi",
          indexes: [{ definition: "CREATE INDEX thiet_bi_ma_idx", name: "thiet_bi_ma_idx" }],
          kind: "table",
          triggers: [{ definition: "BEFORE UPDATE", name: "audit_thiet_bi" }],
        },
      ],
      routines: [
        {
          definition: "SELECT id FROM public.thiet_bi",
          identity: "public.equipment_list()",
          kind: "function",
        },
      ],
    })

    expect(first).toBe(reordered)
  })

  it("keeps access and environment fingerprints deterministic but security-sensitive", async () => {
    const expectedState = await loadDatabaseQualityGateModule<ExpectedStateModule>("expected-state")
    const firstAccess = expectedState.collectAccessFingerprint({
      routines: [
        {
          executionMode: "definer",
          grants: [{ operations: ["EXECUTE"], role: "authenticated" }],
          identity: "public.equipment_list()",
          owner: "postgres",
          searchPath: "public, pg_temp",
        },
      ],
      tables: [
        {
          grants: [{ operations: ["SELECT"], role: "authenticated" }],
          identity: "public.thiet_bi",
          owner: "postgres",
          policies: [
            {
              command: "SELECT",
              identity: "equipment_read",
              permissive: true,
              roles: ["authenticated"],
              using: "tenant_id = current_tenant_id()",
              withCheck: null,
            },
          ],
          rls: {
            enabled: true,
            forced: false,
          },
        },
      ],
    })
    const reorderedAccess = expectedState.collectAccessFingerprint({
      routines: [
        {
          executionMode: "definer",
          grants: [{ operations: ["EXECUTE"], role: "authenticated" }],
          identity: "public.equipment_list()",
          owner: "postgres",
          searchPath: "public, pg_temp",
        },
      ],
      tables: [
        {
          grants: [{ operations: ["SELECT"], role: "authenticated" }],
          identity: "public.thiet_bi",
          owner: "postgres",
          policies: [
            {
              command: "SELECT",
              identity: "equipment_read",
              permissive: true,
              roles: ["authenticated"],
              using: "tenant_id = current_tenant_id()",
              withCheck: null,
            },
          ],
          rls: {
            enabled: true,
            forced: false,
          },
        },
      ],
    })
    const changedAccess = expectedState.collectAccessFingerprint({
      routines: [
        {
          executionMode: "definer",
          grants: [{ operations: ["EXECUTE"], role: "authenticated" }],
          identity: "public.equipment_list()",
          owner: "postgres",
          searchPath: null,
        },
      ],
      tables: [
        {
          grants: [{ operations: ["SELECT"], role: "authenticated" }],
          identity: "public.thiet_bi",
          owner: "postgres",
          policies: [
            {
              command: "SELECT",
              identity: "equipment_read",
              permissive: true,
              roles: ["authenticated"],
              using: "tenant_id = current_tenant_id()",
              withCheck: null,
            },
          ],
          rls: {
            enabled: true,
            forced: false,
          },
        },
      ],
    })
    const firstEnvironment = expectedState.collectEnvironmentFingerprint({
      extensions: [
        {
          name: "vector",
          schema: "extensions",
          version: "0.8.0",
        },
        {
          name: "pgcrypto",
          schema: "extensions",
          version: "1.3",
        },
      ],
      postgresqlVersion: "17.5",
      supabaseVersion: "2026.08.1",
    })
    const reorderedEnvironment = expectedState.collectEnvironmentFingerprint({
      extensions: [
        {
          name: "pgcrypto",
          schema: "extensions",
          version: "1.3",
        },
        {
          name: "vector",
          schema: "extensions",
          version: "0.8.0",
        },
      ],
      postgresqlVersion: "17.5",
      supabaseVersion: "2026.08.1",
    })

    expect(firstAccess).toBe(reorderedAccess)
    expect(changedAccess).not.toBe(firstAccess)
    expect(firstEnvironment).toBe(reorderedEnvironment)
  })

  it("excludes extension-owned objects from access fingerprints", async () => {
    const expectedState = await loadDatabaseQualityGateModule<ExpectedStateModule>("expected-state")
    const applicationOwned = {
      routines: [
        {
          executionMode: "invoker",
          grants: [],
          identity: "public.equipment_list()",
          owner: "postgres",
          searchPath: null,
        },
      ],
      tables: [],
    }

    const withExtensionOwnedRoutine = {
      ...applicationOwned,
      routines: [
        ...applicationOwned.routines,
        {
          executionMode: "invoker",
          extensionOwned: true,
          grants: [{ operations: ["EXECUTE"], role: "public" }],
          identity: "public.gist_int4_ops()",
          owner: "postgres",
          searchPath: null,
        },
      ],
    }

    expect(expectedState.collectAccessFingerprint(withExtensionOwnedRoutine)).toBe(
      expectedState.collectAccessFingerprint(applicationOwned)
    )
  })

  it("changes the access fingerprint when policy semantics or a routine owner changes", async () => {
    const expectedState = await loadDatabaseQualityGateModule<ExpectedStateModule>("expected-state")
    const baseCatalog = {
      routines: [
        {
          executionMode: "definer",
          grants: [{ operations: ["EXECUTE"], role: "authenticated" }],
          identity: "public.equipment_list()",
          owner: "postgres",
          searchPath: "public, pg_temp",
        },
      ],
      tables: [
        {
          grants: [{ operations: ["SELECT"], role: "authenticated" }],
          identity: "public.thiet_bi",
          owner: "postgres",
          policies: [
            {
              command: "SELECT",
              identity: "equipment_read",
              permissive: true,
              roles: ["authenticated"],
              using: "tenant_id = current_tenant_id()",
              withCheck: null,
            },
          ],
          rls: {
            enabled: true,
            forced: false,
          },
        },
      ],
    }

    expect(
      expectedState.collectAccessFingerprint({
        ...baseCatalog,
        routines: [{ ...baseCatalog.routines[0], owner: "service_role" }],
      })
    ).not.toBe(expectedState.collectAccessFingerprint(baseCatalog))
    expect(
      expectedState.collectAccessFingerprint({
        ...baseCatalog,
        tables: [
          {
            ...baseCatalog.tables[0],
            policies: [
              {
                ...baseCatalog.tables[0].policies[0],
                using: "true",
              },
            ],
          },
        ],
      })
    ).not.toBe(expectedState.collectAccessFingerprint(baseCatalog))
  })
})
