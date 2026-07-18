import { describe, expect, it } from "vitest"
import {
  adapterSource,
  countOccurrences,
  DOCUMENT_RPC_ARGUMENTS,
  DOCUMENT_RPC_ARG_INTERFACES,
  DOCUMENT_RPC_NAMES,
  fkIndexMigrationSource,
  getCreateTableBlock,
  getFunctionBlock,
  getFunctionContract,
  getInterfaceFields,
  migrationFile,
  migrationFiles,
  migrationSource,
  MINIMUM_MIGRATION_TIMESTAMP,
  phaseGateContracts,
  rpcNamesSource,
  TABLE_NAMES,
  typesSource,
  URL_CALLERS,
  URL_NON_CALLERS,
  URL_VALIDATOR_MIGRATION_FILE,
  urlValidatorMigrationSource,
  VALIDATOR_FUNCTION,
} from "./technical-configuration-baseline-documents-test-support"

describe("technical configuration P7B1 baseline and reference evidence contracts", () => {
  it("ships one correctly ordered migration after the P7A2 predecessor", () => {
    expect(migrationFiles).toHaveLength(1)
    expect(migrationFile.slice(0, 14) > MINIMUM_MIGRATION_TIMESTAMP).toBe(true)
  })

  it("ships a later corrective migration for parser-level URL validation", () => {
    expect(URL_VALIDATOR_MIGRATION_FILE).toBe(
      "20260718050000_technical_configuration_document_url_validation.sql"
    )
    expect(
      URL_VALIDATOR_MIGRATION_FILE >
        "20260718040000_technical_configuration_document_fk_indexes.sql"
    ).toBe(true)
    expect(urlValidatorMigrationSource).toContain("BEGIN;")
    expect(urlValidatorMigrationSource).toContain("COMMIT;")
  })

  it("creates exactly four UUID tables with audit columns", () => {
    const createdTables = [
      ...migrationSource.matchAll(/CREATE TABLE public\.(technical_configuration_[a-z_]+)/g),
    ].map((match) => match[1])

    expect(createdTables).toEqual(TABLE_NAMES)

    for (const tableName of TABLE_NAMES) {
      const block = getCreateTableBlock(migrationSource, tableName)
      expect(block).toContain("id UUID PRIMARY KEY DEFAULT gen_random_uuid()")
      expect(block).toContain("created_at TIMESTAMPTZ NOT NULL DEFAULT now()")
      expect(block).toContain("created_by BIGINT NOT NULL")
      expect(block).toContain("updated_at TIMESTAMPTZ NOT NULL DEFAULT now()")
      expect(block).toContain("updated_by BIGINT NOT NULL")
    }
  })

  it("enforces owner isolation, exact-version citation keys, uniqueness, and cascade", () => {
    expect(migrationSource).toContain("UNIQUE (id, baseline_version_id)")
    expect(migrationSource).toContain("UNIQUE (baseline_document_id, criterion_id)")
    expect(migrationSource).toContain("UNIQUE (reference_document_id, criterion_id)")

    for (const foreignKey of [
      /FOREIGN KEY \(baseline_version_id\)\s+REFERENCES public\.technical_configuration_baseline_versions \(id\)\s+ON DELETE CASCADE/,
      /FOREIGN KEY \(reference_product_id, baseline_version_id\)\s+REFERENCES public\.technical_configuration_reference_products \(id, baseline_version_id\)\s+ON DELETE CASCADE/,
      /FOREIGN KEY \(baseline_document_id, baseline_version_id\)\s+REFERENCES public\.technical_configuration_baseline_documents \(id, baseline_version_id\)\s+ON DELETE CASCADE/,
      /FOREIGN KEY \(reference_document_id, baseline_version_id\)\s+REFERENCES public\.technical_configuration_reference_documents \(id, baseline_version_id\)\s+ON DELETE CASCADE/,
      /FOREIGN KEY \(criterion_id, baseline_version_id\)\s+REFERENCES public\.technical_configuration_baseline_criteria \(id, baseline_version_id\)\s+ON DELETE CASCADE/,
    ]) {
      expect(migrationSource).toMatch(foreignKey)
    }
  })

  it("indexes every owner, version, document, and criterion lookup used by the aggregate", () => {
    for (const indexColumns of [
      "technical_configuration_baseline_documents (baseline_version_id",
      "technical_configuration_baseline_citations (baseline_document_id",
      "technical_configuration_baseline_citations (criterion_id",
      "technical_configuration_reference_documents (baseline_version_id",
      "technical_configuration_reference_documents (reference_product_id",
      "technical_configuration_reference_citations (reference_document_id",
      "technical_configuration_reference_citations (criterion_id",
    ]) {
      expect(migrationSource).toContain(indexColumns)
    }
  })

  it("covers every P7B1 composite foreign key in a later idempotent migration", () => {
    const normalizedMigrationSource = fkIndexMigrationSource
      .replace(/\s+/g, " ")
      .replace(/\(\s+/g, "(")
      .replace(/\s+\)/g, ")")

    expect(fkIndexMigrationSource).toContain("BEGIN;")
    expect(fkIndexMigrationSource).toContain("COMMIT;")
    expect(countOccurrences(fkIndexMigrationSource, "CREATE INDEX IF NOT EXISTS")).toBe(5)

    for (const indexColumns of [
      "technical_configuration_baseline_citations (baseline_document_id, baseline_version_id)",
      "technical_configuration_baseline_citations (criterion_id, baseline_version_id)",
      "technical_configuration_reference_documents (reference_product_id, baseline_version_id)",
      "technical_configuration_reference_citations (reference_document_id, baseline_version_id)",
      "technical_configuration_reference_citations (criterion_id, baseline_version_id)",
    ]) {
      expect(normalizedMigrationSource).toContain(`ON public.${indexColumns}`)
    }
  })

  it("keeps all four tables deny-by-default behind service-role access", () => {
    for (const tableName of TABLE_NAMES) {
      expect(migrationSource).toContain(
        `ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;`
      )
      expect(migrationSource).toContain(
        `REVOKE ALL ON TABLE public.${tableName} FROM PUBLIC, anon, authenticated;`
      )
      expect(migrationSource).toContain(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.${tableName} TO service_role;`
      )
    }

    expect(migrationSource).not.toMatch(
      /CREATE POLICY[\s\S]+technical_configuration_(baseline|reference)_(documents|citations)/
    )
  })

  it("defines one internal lexical HTTP(S) validator without network or extension calls", () => {
    const validatorBlock = getFunctionBlock(urlValidatorMigrationSource, VALIDATOR_FUNCTION)
    const normalizedValidatorMigrationSource = urlValidatorMigrationSource.replace(/\s+/g, " ")

    expect(
      countOccurrences(
        urlValidatorMigrationSource,
        `CREATE OR REPLACE FUNCTION public.${VALIDATOR_FUNCTION}(`
      )
    ).toBe(1)
    expect(validatorBlock).toContain("p_url TEXT")
    expect(validatorBlock).toContain("RETURNS VOID")
    expect(validatorBlock).toContain("SET search_path = public, pg_temp")
    expect(validatorBlock).toMatch(/p_url\s*!~\*\s*'\^https\?:\\\/\\\/'/)
    expect(validatorBlock).toContain("[[:cntrl:]]")
    expect(validatorBlock).toContain("E'\\\\'")
    expect(validatorBlock).toContain("v_authority := substring(p_url FROM")
    expect(validatorBlock).toContain("v_host_port := regexp_replace(v_authority, '^.*@', '')")
    expect(validatorBlock).toContain("v_host::INET")
    expect(validatorBlock).toContain("v_port::INTEGER > 65535")
    expect(validatorBlock).toContain("validation_error")
    expect(validatorBlock).toContain("PT422")

    for (const forbiddenPrimitive of [
      "net.http",
      "http_get",
      "http_post",
      "dblink",
      "curl",
      "wget",
      "CREATE EXTENSION",
    ]) {
      expect(validatorBlock).not.toContain(forbiddenPrimitive)
    }

    expect(normalizedValidatorMigrationSource).toContain(
      `REVOKE ALL ON FUNCTION public.${VALIDATOR_FUNCTION}(TEXT) FROM PUBLIC, anon, authenticated, service_role;`
    )
    expect(normalizedValidatorMigrationSource).toContain(
      `GRANT EXECUTE ON FUNCTION public.${VALIDATOR_FUNCTION}(TEXT) TO service_role;`
    )
  })

  it("calls the URL validator exactly from four create/update RPCs before writes and revision bumps", () => {
    for (const functionName of URL_CALLERS) {
      const block = getFunctionBlock(migrationSource, functionName)
      const validatorCall = block.indexOf(`public.${VALIDATOR_FUNCTION}(p_url)`)
      const write = Math.max(
        block.indexOf("INSERT INTO public.technical_configuration_"),
        block.indexOf("UPDATE public.technical_configuration_")
      )
      const revisionBump = block.indexOf("public._technical_configuration_baseline_bump_revision(")

      expect(countOccurrences(block, `public.${VALIDATOR_FUNCTION}(p_url)`)).toBe(1)
      expect(validatorCall).toBeGreaterThanOrEqual(0)
      expect(write).toBeGreaterThan(validatorCall)
      expect(revisionBump).toBeGreaterThan(write)
    }

    for (const functionName of URL_NON_CALLERS) {
      expect(getFunctionBlock(migrationSource, functionName)).not.toContain(
        `public.${VALIDATOR_FUNCTION}(`
      )
    }
  })

  it("defines the ordered aggregate list and ten secured mutation signatures", () => {
    for (const functionName of DOCUMENT_RPC_NAMES) {
      const expectedArgs = DOCUMENT_RPC_ARGUMENTS[functionName].split(", ")
      const signature = `${functionName}(${expectedArgs
        .map((arg) => arg.split(" ").at(-1))
        .join(", ")})`
      const block = getFunctionBlock(migrationSource, functionName)
      const contract = getFunctionContract(migrationSource, functionName)

      expect(contract).toEqual({ args: expectedArgs, returnType: "JSONB" })
      expect(block).toContain("SECURITY DEFINER")
      expect(block).toContain("SET search_path = public, pg_temp")
      expect(migrationSource).toContain(
        `REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated, service_role;`
      )
      expect(migrationSource).toContain(
        `GRANT EXECUTE ON FUNCTION public.${signature} TO authenticated;`
      )
    }
  })

  it("returns one paginated discriminated aggregate with same-version nested citations", () => {
    const listBlock = getFunctionBlock(
      migrationSource,
      "technical_configuration_baseline_documents_list"
    )

    expect(listBlock).toContain("public._technical_configuration_require_global_user()")
    expect(listBlock).toContain("WHERE baseline_version_id = p_baseline_version_id")
    expect(listBlock).toContain("'owner_type'")
    expect(listBlock).toContain("'baseline'")
    expect(listBlock).toContain("'reference_product'")
    expect(listBlock).toContain("'owner_id'")
    expect(listBlock).toContain("'citations'")
    expect(listBlock).toContain("'total'")
    expect(listBlock).toContain("'page'")
    expect(listBlock).toContain("'page_size'")
    expect(listBlock).toContain("criterion_id")
  })

  it("returns revision-bearing mutation data and affected citation links on document delete", () => {
    for (const functionName of DOCUMENT_RPC_NAMES.slice(1)) {
      expect(getFunctionBlock(migrationSource, functionName)).toContain("'revision'")
    }

    for (const functionName of [
      "technical_configuration_baseline_document_delete",
      "technical_configuration_reference_document_delete",
    ]) {
      const block = getFunctionBlock(migrationSource, functionName)
      expect(block).toContain("'id'")
      expect(block).toContain("'affected_link_count'")
    }
  })

  it("extends baseline copy with fresh owner and criterion remapping but no future domains", () => {
    const copyBlock = getFunctionBlock(migrationSource, "technical_configuration_baseline_copy")

    for (const marker of [
      "technical_configuration_baseline_document_copy_map",
      "technical_configuration_reference_document_copy_map",
      "public.technical_configuration_baseline_documents",
      "public.technical_configuration_baseline_citations",
      "public.technical_configuration_reference_documents",
      "public.technical_configuration_reference_citations",
      "source_criterion_id",
      "source_reference_product_id",
    ]) {
      expect(copyBlock).toContain(marker)
    }

    for (const forbiddenDomain of [
      "technical_configuration_suppliers",
      "technical_configuration_options",
      "technical_configuration_comparison_sets",
      "technical_configuration_option_responses",
      "technical_configuration_option_documents",
      "technical_configuration_option_citations",
      "technical_configuration_manual_assessments",
    ]) {
      expect(copyBlock).not.toContain(forbiddenDomain)
    }
  })

  it("ships independent rollback-safe core and URL phase gates", () => {
    for (const gate of phaseGateContracts) {
      const source = gate.source.toLowerCase()

      expect(gate.source).toContain(`-- ${gate.path}`)
      expect(countOccurrences(gate.source, "BEGIN;")).toBe(1)
      expect(countOccurrences(gate.source, "ROLLBACK;")).toBe(1)
      expect(gate.source.trimEnd().split("\n").length).toBeLessThan(450)
      expect(gate.source).not.toMatch(/has_(?:table|function)_privilege\(\s*'PUBLIC'/)

      for (const marker of [...gate.markers, ...gate.catalogMarkers]) {
        expect(source).toContain(marker.toLowerCase())
      }
      for (const marker of gate.forbiddenMarkers) {
        expect(source).not.toContain(marker.toLowerCase())
      }
      for (const rpcName of DOCUMENT_RPC_NAMES) {
        expect(gate.source).toContain(rpcName)
      }
    }
  })

  it("adds the shared RPC manifest, wire contracts, and eleven thin wrappers only", () => {
    expect(rpcNamesSource).toContain("export const DOCUMENT_RPC_FUNCTIONS")
    expect(rpcNamesSource).toContain("export const DOCUMENT_RPC_FUNCTION_NAMES")
    for (const rpcName of DOCUMENT_RPC_NAMES) {
      expect(rpcNamesSource).toContain(rpcName)
    }

    for (const exportName of [
      "TechnicalConfigurationCitationWire",
      "TechnicalConfigurationDocumentWire",
      "TechnicalConfigurationDocumentsListWireResponse",
      "TechnicalConfigurationDocumentMutationWireResponse",
      "TechnicalConfigurationDocumentDeleteWireResponse",
      "TechnicalConfigurationCitationMutationWireResponse",
      "TechnicalConfigurationCitationDeleteWireResponse",
    ]) {
      expect(typesSource).toContain(`export interface ${exportName}`)
    }

    for (const [interfaceName, fields] of Object.entries(DOCUMENT_RPC_ARG_INTERFACES)) {
      expect(getInterfaceFields(typesSource, interfaceName)).toEqual(fields)
    }

    expect(typesSource).toContain('owner_type: "baseline" | "reference_product"')
    expect(typesSource).toContain("affected_link_count: number")
    expect(adapterSource).toContain("DOCUMENT_RPC_FUNCTIONS")
    expect(adapterSource).toContain(
      'import { callTechnicalConfigurationRpc } from "./technical-configuration-rpc"'
    )
    expect(adapterSource).not.toContain("export async function callTechnicalConfigurationRpc")

    for (const wrapperName of [
      "listTechnicalConfigurationBaselineDocuments",
      "createTechnicalConfigurationBaselineDocument",
      "updateTechnicalConfigurationBaselineDocument",
      "deleteTechnicalConfigurationBaselineDocument",
      "upsertTechnicalConfigurationBaselineCitation",
      "deleteTechnicalConfigurationBaselineCitation",
      "createTechnicalConfigurationReferenceDocument",
      "updateTechnicalConfigurationReferenceDocument",
      "deleteTechnicalConfigurationReferenceDocument",
      "upsertTechnicalConfigurationReferenceCitation",
      "deleteTechnicalConfigurationReferenceCitation",
    ]) {
      expect(adapterSource).toContain(`export function ${wrapperName}`)
    }
  })
})
