import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { ALLOWED_FUNCTIONS, SERVICE_ROLE_RPC_FUNCTIONS } from "@/app/api/rpc/[fn]/allowed-functions"
import { TECHNICAL_CONFIGURATION_BASELINE_HIERARCHY_AUTHORING_RPCS } from "@/app/(app)/technical-configurations/technical-configuration-baseline-hierarchy-rpcs"
import { BASELINE_RPC_FUNCTIONS } from "@/lib/technical-configuration-baseline-rpcs"

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations")
const ACTIVATION_SUFFIX = "_technical_configuration_baseline_hierarchy_server_activation.sql"
const ACTIVATION_GATE_PATH = path.resolve(
  process.cwd(),
  "supabase/tests/technical_configuration_baseline_hierarchy_server_activation_security_gate.sql"
)
const LATEST_READER_MIGRATION =
  "20260812140500_technical_configuration_evaluation_hierarchy_order.sql"
const INTERNAL_APPLY_FUNCTION = "_technical_configuration_baseline_import_apply_v2"
const PUBLIC_APPLY_FUNCTION = "technical_configuration_baseline_import_apply_v2"
const APPLY_SIGNATURE = "(UUID, JSONB, JSONB, BIGINT)"

function readActivationMigration() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(ACTIVATION_SUFFIX))
    .sort()

  expect(files).toHaveLength(1)
  const file = files[0]
  if (!file) {
    throw new Error("P6A activation migration is missing")
  }

  return {
    file,
    source: readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"),
  }
}

describe("technical configuration P6A hierarchy server activation", () => {
  it("allowlists the complete seven-RPC hierarchy authoring manifest for authenticated use", () => {
    const authoringFunctions = Object.values(
      TECHNICAL_CONFIGURATION_BASELINE_HIERARCHY_AUTHORING_RPCS
    )

    expect(authoringFunctions).toHaveLength(7)
    for (const fn of authoringFunctions) {
      expect(ALLOWED_FUNCTIONS.has(fn)).toBe(true)
      expect(SERVICE_ROLE_RPC_FUNCTIONS.has(fn)).toBe(false)
    }
  })

  it("ships a superseding migration that activates v2 apply without exposing its internal worker", () => {
    const activation = readActivationMigration()

    expect(activation.file.localeCompare(LATEST_READER_MIGRATION)).toBeGreaterThan(0)
    expect(activation.source).toContain(
      `CREATE OR REPLACE FUNCTION public.${PUBLIC_APPLY_FUNCTION}(`
    )
    expect(activation.source).toContain(`RETURN public.${INTERNAL_APPLY_FUNCTION}(`)
    expect(activation.source).not.toContain("hierarchical_import_apply_not_activated")
    expect(activation.source).toContain(
      `REVOKE ALL ON FUNCTION public.${INTERNAL_APPLY_FUNCTION}${APPLY_SIGNATURE} FROM PUBLIC, anon, authenticated, service_role;`
    )
    expect(activation.source).not.toContain(
      `GRANT EXECUTE ON FUNCTION public.${INTERNAL_APPLY_FUNCTION}${APPLY_SIGNATURE}`
    )
    expect(activation.source).toContain(
      `GRANT EXECUTE ON FUNCTION public.${PUBLIC_APPLY_FUNCTION}${APPLY_SIGNATURE} TO authenticated;`
    )
    expect(BASELINE_RPC_FUNCTIONS.applyHierarchyImport).toBe(PUBLIC_APPLY_FUNCTION)
  })

  it("grants every hierarchy authoring RPC only to authenticated", () => {
    const activation = readActivationMigration().source

    for (const fn of Object.values(TECHNICAL_CONFIGURATION_BASELINE_HIERARCHY_AUTHORING_RPCS)) {
      expect(activation).toContain(`REVOKE ALL ON FUNCTION public.${fn}`)
      expect(activation).toMatch(
        new RegExp(
          `GRANT EXECUTE ON FUNCTION public\\.${fn.replaceAll("_", "\\_")}\\([^;]+\\) TO authenticated;`
        )
      )
    }
  })

  it("ships a rollback-only security gate for the activated server contracts", () => {
    const gate = readFileSync(ACTIVATION_GATE_PATH, "utf8")

    expect(gate).toContain("BEGIN;")
    expect(gate).toContain("ROLLBACK;")
    expect(gate).toContain("public v2 apply delegation contract mismatch")
    expect(gate).toContain("internal v2 apply privilege contract mismatch")
    expect(gate).toContain("hierarchy authoring privilege contract mismatch")
    expect(gate).toContain("public v2 apply missing claims rejected")
    expect(gate).toContain("public v2 apply delegates to editable version guard")
    expect(gate).toContain("SET LOCAL ROLE authenticated;")
    expect(gate).toContain("hierarchy authoring missing claims rejected")
    expect(gate).toContain("hierarchy authoring non-global role rejected")
    expect(gate).toContain("hierarchy authoring admin reaches target guard")
    expect(gate).toContain("'42501'")
    expect(gate).toContain("'PT404'")
    for (const fn of Object.values(TECHNICAL_CONFIGURATION_BASELINE_HIERARCHY_AUTHORING_RPCS)) {
      expect(gate).toContain(fn)
    }
  })
})
