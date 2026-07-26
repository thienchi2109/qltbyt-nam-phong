import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const REPO_ROOT = process.cwd()
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase/migrations")
const MIGRATION_FILE = "20260726020000_technical_configuration_option_evidence.sql"
const MIGRATION_PATH = path.join(MIGRATIONS_DIR, MIGRATION_FILE)
const PHASE_GATE_PATH = path.join(
  REPO_ROOT,
  "supabase/tests/technical_configuration_option_documents_phase_gate.sql"
)
const RPC_NAMES_PATH = path.join(REPO_ROOT, "src/lib/technical-configuration-document-rpcs.ts")
const TYPES_PATH = path.join(REPO_ROOT, "src/app/(app)/technical-configurations/document-types.ts")
const ADAPTER_PATH = path.join(
  REPO_ROOT,
  "src/app/(app)/technical-configurations/technical-configuration-document-rpc.ts"
)
const ALLOWLIST_PATH = path.join(REPO_ROOT, "src/app/api/rpc/[fn]/allowed-functions.ts")

const TABLE_NAMES = [
  "technical_configuration_option_documents",
  "technical_configuration_option_citations",
] as const

const OPTION_DOCUMENT_RPC_FUNCTIONS = {
  listOptionDocuments: "technical_configuration_option_documents_list",
  createOptionDocument: "technical_configuration_option_document_create",
  updateOptionDocument: "technical_configuration_option_document_update",
  deleteOptionDocument: "technical_configuration_option_document_delete",
  upsertOptionCitation: "technical_configuration_option_citation_upsert",
  deleteOptionCitation: "technical_configuration_option_citation_delete",
} as const

const OPTION_DOCUMENT_RPC_NAMES = Object.values(OPTION_DOCUMENT_RPC_FUNCTIONS)

const RPC_ARGUMENTS: Record<(typeof OPTION_DOCUMENT_RPC_NAMES)[number], string> = {
  technical_configuration_option_documents_list:
    "p_option_id UUID, p_baseline_version_id UUID, p_page INTEGER DEFAULT 1, p_page_size INTEGER DEFAULT 50",
  technical_configuration_option_document_create:
    "p_option_id UUID, p_name TEXT, p_url TEXT, p_expected_revision BIGINT",
  technical_configuration_option_document_update:
    "p_option_document_id UUID, p_name TEXT, p_url TEXT, p_expected_revision BIGINT",
  technical_configuration_option_document_delete:
    "p_option_document_id UUID, p_expected_revision BIGINT",
  technical_configuration_option_citation_upsert:
    "p_option_document_id UUID, p_comparison_set_id UUID, p_criterion_id UUID, p_page_section TEXT, p_excerpt TEXT, p_expected_revision BIGINT",
  technical_configuration_option_citation_delete:
    "p_option_citation_id UUID, p_expected_revision BIGINT",
}

const RPC_ARG_INTERFACES: Record<string, string[]> = {
  TechnicalConfigurationOptionDocumentsListRpcArgs: [
    "p_option_id: string",
    "p_baseline_version_id: string",
    "p_page?: number",
    "p_page_size?: number",
  ],
  TechnicalConfigurationOptionDocumentCreateRpcArgs: [
    "p_option_id: string",
    "p_name: string",
    "p_url: string",
    "p_expected_revision: number",
  ],
  TechnicalConfigurationOptionDocumentUpdateRpcArgs: [
    "p_option_document_id: string",
    "p_name: string",
    "p_url: string",
    "p_expected_revision: number",
  ],
  TechnicalConfigurationOptionDocumentDeleteRpcArgs: [
    "p_option_document_id: string",
    "p_expected_revision: number",
  ],
  TechnicalConfigurationOptionCitationUpsertRpcArgs: [
    "p_option_document_id: string",
    "p_comparison_set_id: string",
    "p_criterion_id: string",
    "p_page_section: string | null",
    "p_excerpt: string | null",
    "p_expected_revision: number",
  ],
  TechnicalConfigurationOptionCitationDeleteRpcArgs: [
    "p_option_citation_id: string",
    "p_expected_revision: number",
  ],
}

const URL_VALIDATOR_FUNCTION = "_technical_configuration_validate_document_url"
const EXPECTED_URL_CALLERS = [
  "technical_configuration_baseline_document_create",
  "technical_configuration_baseline_document_update",
  "technical_configuration_reference_document_create",
  "technical_configuration_reference_document_update",
  "technical_configuration_option_document_create",
  "technical_configuration_option_document_update",
]

function readIfExists(filePath: string): string {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : ""
}

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1
}

function normalizeSql(source: string): string {
  return source.replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").trim()
}

function getCreateTableBlock(source: string, tableName: string): string {
  const start = source.indexOf(`CREATE TABLE public.${tableName} (`)
  if (start < 0) return ""
  const end = source.indexOf("\n);", start)
  return end < 0 ? source.slice(start) : source.slice(start, end + 3)
}

function getFunctionBlock(source: string, functionName: string): string {
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${functionName}(`)
  if (start < 0) return ""
  const end = source.indexOf("$$;", start)
  return end < 0 ? source.slice(start) : source.slice(start, end + 3)
}

function getFunctionArguments(source: string, functionName: string): string {
  const block = getFunctionBlock(source, functionName)
  const match = block.match(
    new RegExp(
      `CREATE OR REPLACE FUNCTION public\\.${functionName}\\(([\\s\\S]*?)\\)\\s*RETURNS JSONB`
    )
  )
  return match ? normalizeSql(match[1]) : ""
}

function getInterfaceFields(source: string, interfaceName: string): string[] {
  const match = source.match(new RegExp(`export interface ${interfaceName} \\{([\\s\\S]*?)\\n\\}`))
  if (!match) return []
  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

const migrationSource = readIfExists(MIGRATION_PATH)
const phaseGateSource = readIfExists(PHASE_GATE_PATH)
const rpcNamesSource = readIfExists(RPC_NAMES_PATH)
const typesSource = readIfExists(TYPES_PATH)
const adapterSource = readIfExists(ADAPTER_PATH)
const allowlistSource = readIfExists(ALLOWLIST_PATH)

describe("technical configuration P9B1 option evidence contracts", () => {
  it("ships one correctly ordered migration after P9A2", () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true)
    expect(MIGRATION_FILE > "20260725060000_technical_configuration_option_import.sql").toBe(true)
    expect(migrationSource).toContain("BEGIN;")
    expect(migrationSource).toContain("COMMIT;")
  })

  it("creates option-owned documents and exact comparison-set citations", () => {
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

    const documentBlock = getCreateTableBlock(
      migrationSource,
      "technical_configuration_option_documents"
    )
    expect(documentBlock).toContain("option_id UUID NOT NULL")
    expect(documentBlock).not.toContain("baseline_version_id")
    expect(documentBlock).toContain("UNIQUE (id, option_id)")
    expect(documentBlock).toMatch(
      /FOREIGN KEY \(option_id\)\s+REFERENCES public\.technical_configuration_options \(id\)\s+ON DELETE CASCADE/
    )

    const citationBlock = getCreateTableBlock(
      migrationSource,
      "technical_configuration_option_citations"
    )
    for (const column of [
      "option_id UUID NOT NULL",
      "baseline_version_id UUID NOT NULL",
      "comparison_set_id UUID NOT NULL",
      "option_document_id UUID NOT NULL",
      "criterion_id UUID NOT NULL",
    ]) {
      expect(citationBlock).toContain(column)
    }
    expect(citationBlock).toContain("UNIQUE (option_document_id, comparison_set_id, criterion_id)")

    const normalized = normalizeSql(migrationSource)
    expect(normalized).toContain("UNIQUE (id, option_id, baseline_version_id)")
    for (const foreignKey of [
      "FOREIGN KEY (option_document_id, option_id) REFERENCES public.technical_configuration_option_documents (id, option_id) ON DELETE CASCADE",
      "FOREIGN KEY (comparison_set_id, option_id, baseline_version_id) REFERENCES public.technical_configuration_comparison_sets (id, option_id, baseline_version_id) ON DELETE CASCADE",
      "FOREIGN KEY (criterion_id, baseline_version_id) REFERENCES public.technical_configuration_baseline_criteria (id, baseline_version_id) ON DELETE CASCADE",
    ]) {
      expect(normalized).toContain(foreignKey)
    }
  })

  it("indexes every option document and citation ownership lookup", () => {
    const normalized = normalizeSql(migrationSource)
    for (const indexColumns of [
      "technical_configuration_option_documents (option_id)",
      "technical_configuration_option_citations (option_document_id, option_id)",
      "technical_configuration_option_citations (comparison_set_id, option_id, baseline_version_id)",
      "technical_configuration_option_citations (criterion_id, baseline_version_id)",
    ]) {
      expect(normalized).toContain(`ON public.${indexColumns}`)
    }
  })

  it("keeps both tables deny-by-default behind service-role access", () => {
    const normalized = normalizeSql(migrationSource)
    for (const tableName of TABLE_NAMES) {
      expect(normalized).toContain(`ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;`)
      expect(normalized).toContain(
        `REVOKE ALL ON TABLE public.${tableName} FROM PUBLIC, anon, authenticated;`
      )
      expect(normalized).toContain(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.${tableName} TO service_role;`
      )
    }
  })

  it("defines exactly six secured option evidence RPC signatures", () => {
    const normalized = normalizeSql(migrationSource)
    const createdFunctions = [
      ...migrationSource.matchAll(
        /CREATE OR REPLACE FUNCTION public\.(technical_configuration_option_(?:documents_list|document_create|document_update|document_delete|citation_upsert|citation_delete))\(/g
      ),
    ].map((match) => match[1])
    expect(createdFunctions).toEqual(OPTION_DOCUMENT_RPC_NAMES)

    for (const functionName of OPTION_DOCUMENT_RPC_NAMES) {
      const block = getFunctionBlock(migrationSource, functionName)
      expect(getFunctionArguments(migrationSource, functionName)).toBe(
        normalizeSql(RPC_ARGUMENTS[functionName])
      )
      expect(block).toContain("RETURNS JSONB")
      expect(block).toContain("SECURITY DEFINER")
      expect(block).toContain("SET search_path = public, pg_temp")
      expect(migrationSource).toContain(`REVOKE ALL ON FUNCTION public.${functionName}(`)
      expect(migrationSource).toContain(`GRANT EXECUTE ON FUNCTION public.${functionName}(`)
    }
    expect(countOccurrences(normalized, "TO authenticated;")).toBe(OPTION_DOCUMENT_RPC_NAMES.length)
    expect(normalized).not.toContain("TO authenticated, service_role;")
  })

  it("keeps list side-effect-free and exact-set scoped", () => {
    const block = getFunctionBlock(
      migrationSource,
      OPTION_DOCUMENT_RPC_FUNCTIONS.listOptionDocuments
    )
    const citationCountsBlock = block.slice(
      block.indexOf("citation_counts AS"),
      block.indexOf("exact_citations AS")
    )
    expect(block).toContain("public._technical_configuration_require_global_user()")
    expect(block).toContain("p_option_id")
    expect(block).toContain("p_baseline_version_id")
    expect(block).toContain("technical_configuration_comparison_sets")
    expect(block).toContain("affected_citation_count")
    expect(block).toContain("'citations'")
    expect(block).toContain("'[]'::JSONB")
    expect(block).toContain("OFFSET ((v_page - 1)::BIGINT * v_page_size)")
    expect(normalizeSql(citationCountsBlock)).toContain(
      "FROM paged p JOIN public.technical_configuration_option_citations c ON c.option_document_id = p.id"
    )
    expect(citationCountsBlock).not.toContain("WHERE c.option_id = p_option_id")
    expect(block).not.toMatch(/\bINSERT INTO\b/)
    expect(block).not.toMatch(/\bUPDATE public\./)
    expect(block).not.toMatch(/\bDELETE FROM\b/)
    expect(block).not.toContain("FOR UPDATE")
  })

  it("authorizes every mutation before any object lookup", () => {
    for (const functionName of OPTION_DOCUMENT_RPC_NAMES.slice(1)) {
      const block = getFunctionBlock(migrationSource, functionName)
      const begin = block.indexOf("BEGIN")
      const globalGuard = block.indexOf(
        "public._technical_configuration_require_global_user()",
        begin
      )
      const firstLookup = block.indexOf("\n  SELECT", begin)

      expect(globalGuard).toBeGreaterThan(begin)
      expect(firstLookup).toBeGreaterThan(globalGuard)
    }
  })

  it("uses dossier revision mutations without baseline lock guards", () => {
    for (const functionName of OPTION_DOCUMENT_RPC_NAMES.slice(1)) {
      const block = getFunctionBlock(migrationSource, functionName)
      expect(block).toContain("public._technical_configuration_require_editable_dossier(")
      expect(block).toContain("p_expected_revision")
      expect(block).toContain("UPDATE public.technical_configuration_dossiers")
      expect(block).not.toContain(
        "public._technical_configuration_require_editable_baseline_version("
      )
      expect(block).not.toMatch(/status\s*=\s*'locked'/)
    }
  })

  it("calls the authoritative URL validator from exactly six create/update RPCs", () => {
    const documentMigrationSource = readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith(".sql"))
      .sort()
      .map((file) => readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"))
      .join("\n")
    const functionNames = [
      ...documentMigrationSource.matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z0-9_]+)\(/g),
    ].map((match) => match[1])
    const callers = [...new Set(functionNames)]
      .filter((functionName) =>
        getFunctionBlock(documentMigrationSource, functionName).includes(
          `public.${URL_VALIDATOR_FUNCTION}(p_url)`
        )
      )
      .sort()

    expect(callers).toEqual([...EXPECTED_URL_CALLERS].sort())

    for (const functionName of [
      OPTION_DOCUMENT_RPC_FUNCTIONS.createOptionDocument,
      OPTION_DOCUMENT_RPC_FUNCTIONS.updateOptionDocument,
    ]) {
      const block = getFunctionBlock(migrationSource, functionName)
      const validatorCall = block.indexOf(`public.${URL_VALIDATOR_FUNCTION}(p_url)`)
      const write = functionName.endsWith("_create")
        ? block.indexOf("INSERT INTO public.technical_configuration_option_documents")
        : block.indexOf("UPDATE public.technical_configuration_option_documents")
      const revisionBump = block.indexOf("UPDATE public.technical_configuration_dossiers")
      expect(countOccurrences(block, `public.${URL_VALIDATOR_FUNCTION}(p_url)`)).toBe(1)
      expect(validatorCall).toBeGreaterThanOrEqual(0)
      expect(write).toBeGreaterThan(validatorCall)
      expect(revisionBump).toBeGreaterThan(write)
    }
  })

  it("cascades confirmed document deletion and reports affected citations", () => {
    const block = getFunctionBlock(
      migrationSource,
      OPTION_DOCUMENT_RPC_FUNCTIONS.deleteOptionDocument
    )
    expect(block).toContain("technical_configuration_option_citations")
    expect(block).toContain("affected_citation_count")
    expect(block).toContain("DELETE FROM public.technical_configuration_option_documents")
    expect(block).not.toContain("COMMIT")
  })

  it("ships the rollback-only P9B1 phase gate contract", () => {
    expect(existsSync(PHASE_GATE_PATH)).toBe(true)
    for (const marker of [
      "BEGIN;",
      "pg_advisory_xact_lock",
      "technical_configuration_option_documents",
      "technical_configuration_option_citations",
      "technical_configuration_option_documents_list",
      "technical_configuration_option_document_delete",
      "technical_configuration_option_citation_upsert",
      "SAVEPOINT",
      "ROLLBACK TO SAVEPOINT",
      "SET LOCAL request.jwt.claims",
      "has zero policies",
      "denies PUBLIC table access",
      "denies anon table access",
      "allows service_role table CRUD",
      "denies PUBLIC function execute",
      "denies service_role function execute",
      "unauthorized create hides missing option",
      "unauthorized update hides missing document",
      "unauthorized document delete hides missing document",
      "unauthorized citation upsert hides missing document",
      "unauthorized citation delete hides missing citation",
      "raw admin role accepted",
      "archived dossier list remains readable",
      "large page remains valid",
      "document update succeeds",
      "citation delete succeeds",
      "invalid URL performs zero writes",
      "failure injection",
      "ROLLBACK;",
    ]) {
      expect(phaseGateSource).toContain(marker)
    }
    expect(phaseGateSource).toContain("'42501', 'permission_denied'")
    expect(phaseGateSource).toContain("'PT409', 'archived_dossier'")
    expect(phaseGateSource).not.toContain("'42501', 'Missing role claim'")
    expect(phaseGateSource).not.toContain("'PT409', 'archived'")
  })

  it("adds the dormant manifest, wire contracts, wrappers, and allowlist only", () => {
    for (const [key, rpcName] of Object.entries(OPTION_DOCUMENT_RPC_FUNCTIONS)) {
      expect(rpcNamesSource).toContain(`${key}: "${rpcName}"`)
      expect(allowlistSource).toContain("...DOCUMENT_RPC_FUNCTION_NAMES")
    }

    for (const exportName of [
      "TechnicalConfigurationOptionDocumentWire",
      "TechnicalConfigurationOptionDocumentsListWireResponse",
      "TechnicalConfigurationOptionDocumentMutationWireResponse",
      "TechnicalConfigurationOptionDocumentDeleteWireResponse",
    ]) {
      expect(typesSource).toContain(`export interface ${exportName}`)
    }
    expect(typesSource).toContain("option_id: string")
    expect(typesSource).toContain("affected_citation_count: number")
    expect(typesSource).toContain("citations: TechnicalConfigurationCitationWire[]")

    for (const [interfaceName, fields] of Object.entries(RPC_ARG_INTERFACES)) {
      expect(getInterfaceFields(typesSource, interfaceName)).toEqual(fields)
    }

    for (const functionName of [
      "listTechnicalConfigurationOptionDocuments",
      "createTechnicalConfigurationOptionDocument",
      "updateTechnicalConfigurationOptionDocument",
      "deleteTechnicalConfigurationOptionDocument",
      "upsertTechnicalConfigurationOptionCitation",
      "deleteTechnicalConfigurationOptionCitation",
    ]) {
      expect(adapterSource).toContain(`export function ${functionName}(`)
    }
  })
})
