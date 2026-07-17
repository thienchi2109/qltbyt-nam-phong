import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const REPO_ROOT = process.cwd()
const MIGRATIONS_DIR = path.resolve(REPO_ROOT, "supabase/migrations")
const MIGRATION_SUFFIX = "_technical_configuration_reference_products.sql"
const PHASE_GATE_PATH = path.resolve(
  REPO_ROOT,
  "supabase/tests/technical_configuration_reference_products_phase_gate.sql"
)
const RPC_NAMES_PATH = path.resolve(REPO_ROOT, "src/lib/technical-configuration-reference-rpcs.ts")
const TYPES_PATH = path.resolve(
  REPO_ROOT,
  "src/app/(app)/technical-configurations/reference-product-types.ts"
)
const ADAPTER_PATH = path.resolve(
  REPO_ROOT,
  "src/app/(app)/technical-configurations/technical-configuration-reference-rpc.ts"
)

const REFERENCE_RPC_NAMES = [
  "technical_configuration_reference_products_list",
  "technical_configuration_reference_product_create",
  "technical_configuration_reference_product_update",
  "technical_configuration_reference_product_delete",
  "technical_configuration_reference_response_upsert",
] as const

function readIfExists(filePath: string) {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : ""
}

function getMigrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(MIGRATION_SUFFIX))
    .sort()
}

function getFunctionBlock(source: string, functionName: string) {
  const marker = `CREATE OR REPLACE FUNCTION public.${functionName}(`
  const start = source.indexOf(marker)
  if (start === -1) return ""

  const end = source.indexOf("$$;", start)
  return end === -1 ? source.slice(start) : source.slice(start, end + 3)
}

const migrationFiles = getMigrationFiles()
const migrationFile = migrationFiles[0] ?? ""
const migrationSource = migrationFile
  ? readFileSync(path.resolve(MIGRATIONS_DIR, migrationFile), "utf8")
  : ""
const phaseGateSource = readIfExists(PHASE_GATE_PATH)
const rpcNamesSource = readIfExists(RPC_NAMES_PATH)
const typesSource = readIfExists(TYPES_PATH)
const adapterSource = readIfExists(ADAPTER_PATH)

describe("technical configuration P7A1 reference product contracts", () => {
  it("ships one correctly ordered migration after the latest baseline-copy definition", () => {
    expect(migrationFiles).toHaveLength(1)

    const latestCopyMigration = readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith(".sql"))
      .filter((file) => file !== migrationFile)
      .filter((file) =>
        readFileSync(path.resolve(MIGRATIONS_DIR, file), "utf8").includes(
          "CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_copy("
        )
      )
      .sort()
      .at(-1)

    expect(latestCopyMigration).toBeDefined()
    expect(migrationFile > (latestCopyMigration ?? "")).toBe(true)
  })

  it("creates the two exact-version reference tables with audit columns", () => {
    expect(migrationSource).toMatch(
      /CREATE TABLE public\.technical_configuration_reference_products\s*\(/
    )
    expect(migrationSource).toMatch(
      /CREATE TABLE public\.technical_configuration_reference_responses\s*\(/
    )

    for (const column of [
      "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
      "baseline_version_id UUID NOT NULL",
      "created_at TIMESTAMPTZ NOT NULL DEFAULT now()",
      "created_by BIGINT NOT NULL",
      "updated_at TIMESTAMPTZ NOT NULL DEFAULT now()",
      "updated_by BIGINT NOT NULL",
    ]) {
      expect(migrationSource).toContain(column)
    }

    for (const column of [
      "model TEXT",
      "manufacturer TEXT",
      "description TEXT",
      "notes TEXT",
      "reference_product_id UUID NOT NULL",
      "criterion_id UUID NOT NULL",
      "response_text TEXT NOT NULL DEFAULT ''",
    ]) {
      expect(migrationSource).toContain(column)
    }
  })

  it("enforces baseline ownership, response ownership, uniqueness, and cascade", () => {
    expect(migrationSource).toContain("UNIQUE (id, baseline_version_id)")
    expect(migrationSource).toContain("UNIQUE (reference_product_id, criterion_id)")
    expect(migrationSource).toMatch(
      /FOREIGN KEY \(baseline_version_id\)\s+REFERENCES public\.technical_configuration_baseline_versions \(id\)\s+ON DELETE CASCADE/
    )
    expect(migrationSource).toMatch(
      /FOREIGN KEY \(reference_product_id, baseline_version_id\)\s+REFERENCES public\.technical_configuration_reference_products \(id, baseline_version_id\)\s+ON DELETE CASCADE/
    )
    expect(migrationSource).toMatch(
      /FOREIGN KEY \(criterion_id, baseline_version_id\)\s+REFERENCES public\.technical_configuration_baseline_criteria \(id, baseline_version_id\)\s+ON DELETE CASCADE/
    )
    expect(migrationSource).toMatch(
      /ADD CONSTRAINT technical_configuration_baseline_criteria_id_version_key\s+UNIQUE \(id, baseline_version_id\)/
    )
  })

  it("keeps both tables RPC-only with deny policies and explicit service-role grants", () => {
    for (const tableName of [
      "technical_configuration_reference_products",
      "technical_configuration_reference_responses",
    ]) {
      expect(migrationSource).toContain(
        `ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;`
      )
      expect(migrationSource).toMatch(
        new RegExp(
          `CREATE POLICY ${tableName}_no_client_access\\s+ON public\\.${tableName}\\s+FOR ALL TO anon, authenticated USING \\(false\\) WITH CHECK \\(false\\);`
        )
      )
      expect(migrationSource).toContain(
        `REVOKE ALL ON TABLE public.${tableName} FROM PUBLIC, anon, authenticated;`
      )
      expect(migrationSource).toContain(`GRANT ALL ON TABLE public.${tableName} TO service_role;`)
    }
  })

  it("defines exactly the five P7A1 RPCs with pinned security and expected signatures", () => {
    for (const rpcName of REFERENCE_RPC_NAMES) {
      const block = getFunctionBlock(migrationSource, rpcName)
      expect(block).not.toBe("")
      expect(block).toContain("RETURNS JSONB")
      expect(block).toContain("SECURITY DEFINER")
      expect(block).toContain("SET search_path = public, pg_temp")
      expect(migrationSource).toContain(`GRANT EXECUTE ON FUNCTION public.${rpcName}`)
    }

    expect(migrationSource).toContain(
      "technical_configuration_reference_products_list(\n  p_baseline_version_id UUID,\n  p_page INTEGER DEFAULT 1,\n  p_page_size INTEGER DEFAULT 50"
    )
    expect(migrationSource).toContain(
      "technical_configuration_reference_product_create(\n  p_baseline_version_id UUID,\n  p_model TEXT,\n  p_manufacturer TEXT,\n  p_description TEXT,\n  p_notes TEXT,\n  p_expected_revision BIGINT"
    )
    expect(migrationSource).toContain(
      "technical_configuration_reference_product_update(\n  p_reference_product_id UUID,\n  p_model TEXT,\n  p_manufacturer TEXT,\n  p_description TEXT,\n  p_notes TEXT,\n  p_expected_revision BIGINT"
    )
    expect(migrationSource).toContain(
      "technical_configuration_reference_product_delete(\n  p_reference_product_id UUID,\n  p_expected_revision BIGINT"
    )
    expect(migrationSource).toContain(
      "technical_configuration_reference_response_upsert(\n  p_reference_product_id UUID,\n  p_criterion_id UUID,\n  p_response_text TEXT,\n  p_expected_revision BIGINT"
    )
  })

  it("keeps every mutation behind the editable-version guard and bumps once", () => {
    for (const rpcName of REFERENCE_RPC_NAMES.slice(1)) {
      const block = getFunctionBlock(migrationSource, rpcName)
      expect(block).toContain("public._technical_configuration_require_editable_baseline_version(")
      expect(block.match(/_technical_configuration_baseline_bump_revision/g)).toHaveLength(1)
    }

    const listBlock = getFunctionBlock(
      migrationSource,
      "technical_configuration_reference_products_list"
    )
    expect(listBlock).toContain("public._technical_configuration_require_global_user()")
    expect(listBlock).toContain("WHERE p.baseline_version_id = p_baseline_version_id")
    expect(listBlock).toContain("'page', p_page")
    expect(listBlock).toContain("'page_size', p_page_size")
    expect(listBlock).toContain("'total', v_total")
  })

  it("extends locked-baseline copy with fresh product IDs and criterion remapping", () => {
    const copyBlock = getFunctionBlock(migrationSource, "technical_configuration_baseline_copy")

    expect(copyBlock).toContain("technical_configuration_reference_product_copy_map")
    expect(copyBlock).toContain("source_reference_product_id")
    expect(copyBlock).toContain("target_reference_product_id")
    expect(copyBlock).toContain("public.technical_configuration_reference_products")
    expect(copyBlock).toContain("public.technical_configuration_reference_responses")
    expect(copyBlock).toContain("source_criterion_id = r.criterion_id")
    expect(copyBlock).toContain("m.target_reference_product_id")
  })

  it("ships the phase gate for authorization, revisions, ownership, copy, and exclusions", () => {
    expect(phaseGateSource).toContain(
      "-- supabase/tests/technical_configuration_reference_products_phase_gate.sql"
    )
    for (const marker of [
      "missing role claim",
      "missing user claim",
      "denied role",
      "raw admin role",
      "stale revision",
      "archived dossier",
      "locked version",
      "cross-version criterion",
      "copy remapping",
      "supplier exclusion",
      "assessment exclusion",
      "ranking exclusion",
    ]) {
      expect(phaseGateSource.toLowerCase()).toContain(marker)
    }
    for (const rpcName of REFERENCE_RPC_NAMES) {
      expect(phaseGateSource).toContain(rpcName)
    }
  })

  it("adds typed RPC names, wire contracts, and module-local wrappers only", () => {
    for (const rpcName of REFERENCE_RPC_NAMES) {
      expect(rpcNamesSource).toContain(rpcName)
    }
    expect(adapterSource).toContain("REFERENCE_PRODUCT_RPC_FUNCTIONS")
    for (const exportName of [
      "TechnicalConfigurationReferenceProductWire",
      "TechnicalConfigurationReferenceResponseWire",
      "TechnicalConfigurationReferenceProductsListWireResponse",
      "TechnicalConfigurationReferenceProductMutationWireResponse",
      "TechnicalConfigurationReferenceResponseMutationWireResponse",
    ]) {
      expect(typesSource).toContain(`export interface ${exportName}`)
    }
    expect(adapterSource).toContain(
      'import { callTechnicalConfigurationRpc } from "./technical-configuration-rpc"'
    )
    expect(adapterSource).not.toContain("export async function callTechnicalConfigurationRpc")

    const forbiddenRuntimeFiles = readdirSync(
      path.resolve(REPO_ROOT, "src/app/(app)/technical-configurations"),
      { recursive: true }
    )
      .map(String)
      .filter((file) => /\.(?:ts|tsx)$/.test(file))
      .filter((file) => /reference/i.test(file))
      .filter((file) => /(?:_components|_hooks|\.tsx$)/.test(file))

    expect(forbiddenRuntimeFiles).toEqual([])
  })
})
