import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"

const REPO_ROOT = process.cwd()
const MIGRATIONS_DIR = path.resolve(REPO_ROOT, "supabase/migrations")
const MIGRATION_SUFFIX = "_technical_configuration_baseline_documents.sql"
const CORE_PHASE_GATE_PATH = path.resolve(
  REPO_ROOT,
  "supabase/tests/technical_configuration_baseline_documents_phase_gate.sql"
)
const URL_PHASE_GATE_PATH = path.resolve(
  REPO_ROOT,
  "supabase/tests/technical_configuration_baseline_document_urls_phase_gate.sql"
)
const FK_INDEX_MIGRATION_PATH = path.resolve(
  MIGRATIONS_DIR,
  "20260718040000_technical_configuration_document_fk_indexes.sql"
)
export const URL_VALIDATOR_MIGRATION_FILE =
  "20260718070000_technical_configuration_document_hostname_compatibility.sql"
const URL_VALIDATOR_MIGRATION_PATH = path.resolve(MIGRATIONS_DIR, URL_VALIDATOR_MIGRATION_FILE)
const RPC_NAMES_PATH = path.resolve(REPO_ROOT, "src/lib/technical-configuration-document-rpcs.ts")
const TYPES_PATH = path.resolve(
  REPO_ROOT,
  "src/app/(app)/technical-configurations/document-types.ts"
)
const ADAPTER_PATH = path.resolve(
  REPO_ROOT,
  "src/app/(app)/technical-configurations/technical-configuration-document-rpc.ts"
)

export const MINIMUM_MIGRATION_TIMESTAMP = "20260717151806"
export const VALIDATOR_FUNCTION = "_technical_configuration_validate_document_url"

export const TABLE_NAMES = [
  "technical_configuration_baseline_documents",
  "technical_configuration_baseline_citations",
  "technical_configuration_reference_documents",
  "technical_configuration_reference_citations",
] as const

export const DOCUMENT_RPC_ARGUMENTS = {
  technical_configuration_baseline_documents_list:
    "p_baseline_version_id UUID, p_page INTEGER, p_page_size INTEGER",
  technical_configuration_baseline_document_create:
    "p_baseline_version_id UUID, p_name TEXT, p_url TEXT, p_expected_revision BIGINT",
  technical_configuration_baseline_document_update:
    "p_baseline_document_id UUID, p_name TEXT, p_url TEXT, p_expected_revision BIGINT",
  technical_configuration_baseline_document_delete:
    "p_baseline_document_id UUID, p_expected_revision BIGINT",
  technical_configuration_baseline_citation_upsert:
    "p_baseline_document_id UUID, p_criterion_id UUID, p_page_section TEXT, p_excerpt TEXT, p_expected_revision BIGINT",
  technical_configuration_baseline_citation_delete:
    "p_baseline_citation_id UUID, p_expected_revision BIGINT",
  technical_configuration_reference_document_create:
    "p_reference_product_id UUID, p_name TEXT, p_url TEXT, p_expected_revision BIGINT",
  technical_configuration_reference_document_update:
    "p_reference_document_id UUID, p_name TEXT, p_url TEXT, p_expected_revision BIGINT",
  technical_configuration_reference_document_delete:
    "p_reference_document_id UUID, p_expected_revision BIGINT",
  technical_configuration_reference_citation_upsert:
    "p_reference_document_id UUID, p_criterion_id UUID, p_page_section TEXT, p_excerpt TEXT, p_expected_revision BIGINT",
  technical_configuration_reference_citation_delete:
    "p_reference_citation_id UUID, p_expected_revision BIGINT",
} as const

export const DOCUMENT_RPC_NAMES = Object.keys(
  DOCUMENT_RPC_ARGUMENTS
) as (keyof typeof DOCUMENT_RPC_ARGUMENTS)[]

export const URL_CALLERS = [
  "technical_configuration_baseline_document_create",
  "technical_configuration_baseline_document_update",
  "technical_configuration_reference_document_create",
  "technical_configuration_reference_document_update",
] as const

export const URL_NON_CALLERS = DOCUMENT_RPC_NAMES.filter(
  (functionName) => !URL_CALLERS.includes(functionName as (typeof URL_CALLERS)[number])
)

const CORE_PHASE_GATE_MARKERS = [
  "missing role claim",
  "missing user claim",
  "denied role",
  "raw admin role",
  "raw global role",
  "ownership isolation",
  "version isolation",
  "pagination contract failed",
  "citation reuse failed",
  "citation cascade failed",
  "stale revision",
  "archived dossier",
  "locked version",
  "affected link count",
  "copy remap",
  "supplier exclusion",
  "option exclusion",
  "comparison exclusion",
  "assessment exclusion",
] as const

const CORE_CATALOG_MARKERS = [
  "relrowsecurity",
  "pg_policies",
  "has_table_privilege",
  "has_function_privilege",
  "prosecdef",
  "proconfig",
  "coalesce(",
] as const

const URL_PHASE_GATE_MARKERS = [
  "relative/spec.pdf",
  "//example.com/spec.pdf",
  "https:example.com/spec.pdf",
  "https:/example.com/spec.pdf",
  "ftp://example.com/spec.pdf",
  "https://?q=1",
  "https://[::1",
  "https://example.com:bad",
  "https://exa mple.com/spec.pdf",
  "https://%zz",
  "https://exa%2Fmple.com",
  "https://%FF.com",
  "https://example%25.com",
  "\\\\spec.pdf",
  "chr(10)",
  "chr(9)",
  "mixed-case raw equality",
  "raw list equality",
  "no data change on URL rejection",
  "no revision change on URL rejection",
  "four-or-six validator callers",
  "technical_configuration_option_document_create",
  "technical_configuration_option_document_update",
  "validator non-callers",
] as const

const URL_CATALOG_MARKERS = [
  "pg_get_functiondef",
  "has_function_privilege",
  "prosecdef",
  "proconfig",
  "coalesce(",
] as const

export const DOCUMENT_RPC_ARG_INTERFACES = {
  TechnicalConfigurationBaselineDocumentsListRpcArgs: [
    "p_baseline_version_id: string",
    "p_page?: number",
    "p_page_size?: number",
  ],
  TechnicalConfigurationBaselineDocumentCreateRpcArgs: [
    "p_baseline_version_id: string",
    "p_name: string",
    "p_url: string",
    "p_expected_revision: number",
  ],
  TechnicalConfigurationBaselineDocumentUpdateRpcArgs: [
    "p_baseline_document_id: string",
    "p_name: string",
    "p_url: string",
    "p_expected_revision: number",
  ],
  TechnicalConfigurationBaselineDocumentDeleteRpcArgs: [
    "p_baseline_document_id: string",
    "p_expected_revision: number",
  ],
  TechnicalConfigurationBaselineCitationUpsertRpcArgs: [
    "p_baseline_document_id: string",
    "p_criterion_id: string",
    "p_page_section: string | null",
    "p_excerpt: string | null",
    "p_expected_revision: number",
  ],
  TechnicalConfigurationBaselineCitationDeleteRpcArgs: [
    "p_baseline_citation_id: string",
    "p_expected_revision: number",
  ],
  TechnicalConfigurationReferenceDocumentCreateRpcArgs: [
    "p_reference_product_id: string",
    "p_name: string",
    "p_url: string",
    "p_expected_revision: number",
  ],
  TechnicalConfigurationReferenceDocumentUpdateRpcArgs: [
    "p_reference_document_id: string",
    "p_name: string",
    "p_url: string",
    "p_expected_revision: number",
  ],
  TechnicalConfigurationReferenceDocumentDeleteRpcArgs: [
    "p_reference_document_id: string",
    "p_expected_revision: number",
  ],
  TechnicalConfigurationReferenceCitationUpsertRpcArgs: [
    "p_reference_document_id: string",
    "p_criterion_id: string",
    "p_page_section: string | null",
    "p_excerpt: string | null",
    "p_expected_revision: number",
  ],
  TechnicalConfigurationReferenceCitationDeleteRpcArgs: [
    "p_reference_citation_id: string",
    "p_expected_revision: number",
  ],
} as const

function readIfExists(filePath: string): string {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : ""
}

function getMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(MIGRATION_SUFFIX))
    .sort()
}

export function getFunctionBlock(source: string, functionName: string): string {
  const marker = `CREATE OR REPLACE FUNCTION public.${functionName}(`
  const start = source.indexOf(marker)
  if (start === -1) return ""

  const end = source.indexOf("$$;", start)
  return end === -1 ? source.slice(start) : source.slice(start, end + 3)
}

export function getCreateTableBlock(source: string, tableName: string): string {
  const marker = `CREATE TABLE public.${tableName}`
  const start = source.indexOf(marker)
  if (start === -1) return ""

  const end = source.indexOf("\n);", start)
  return end === -1 ? source.slice(start) : source.slice(start, end + 3)
}

export function countOccurrences(source: string, value: string): number {
  return source.split(value).length - 1
}

export function getFunctionContract(
  source: string,
  functionName: string
): { args: string[]; returnType: string } {
  const match = getFunctionBlock(source, functionName).match(/\(([\s\S]*?)\)\s*RETURNS\s+([A-Z]+)/)
  const args =
    match?.[1].split(",").map((arg) =>
      arg
        .replace(/\s+DEFAULT\s+[\s\S]+$/, "")
        .replace(/\s+/g, " ")
        .trim()
    ) ?? []
  return { args, returnType: match?.[2] ?? "" }
}

export function getInterfaceFields(source: string, interfaceName: string): string[] {
  const marker = `export interface ${interfaceName} {`
  const start = source.indexOf(marker)
  const end = source.indexOf("\n}", start)
  if (start === -1 || end === -1) return []
  return source
    .slice(start + marker.length, end)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

export const migrationFiles = getMigrationFiles()
export const migrationFile = migrationFiles[0] ?? ""
export const migrationSource = migrationFile
  ? readFileSync(path.resolve(MIGRATIONS_DIR, migrationFile), "utf8")
  : ""
export const fkIndexMigrationSource = readIfExists(FK_INDEX_MIGRATION_PATH)
export const urlValidatorMigrationSource = readIfExists(URL_VALIDATOR_MIGRATION_PATH)
const corePhaseGateSource = readIfExists(CORE_PHASE_GATE_PATH)
const urlPhaseGateSource = readIfExists(URL_PHASE_GATE_PATH)
export const phaseGateContracts = [
  {
    path: "supabase/tests/technical_configuration_baseline_documents_phase_gate.sql",
    source: corePhaseGateSource,
    markers: CORE_PHASE_GATE_MARKERS,
    catalogMarkers: CORE_CATALOG_MARKERS,
    forbiddenMarkers: [],
  },
  {
    path: "supabase/tests/technical_configuration_baseline_document_urls_phase_gate.sql",
    source: urlPhaseGateSource,
    markers: URL_PHASE_GATE_MARKERS,
    catalogMarkers: URL_CATALOG_MARKERS,
    forbiddenMarkers: [],
  },
] as const
export const rpcNamesSource = readIfExists(RPC_NAMES_PATH)
export const typesSource = readIfExists(TYPES_PATH)
export const adapterSource = readIfExists(ADAPTER_PATH)
