import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const REPO_ROOT = process.cwd()
const RPC_NAMES_PATH = path.join(REPO_ROOT, "src/lib/technical-configuration-document-rpcs.ts")
const TYPES_PATH = path.join(REPO_ROOT, "src/app/(app)/technical-configurations/document-types.ts")
const ADAPTER_PATH = path.join(
  REPO_ROOT,
  "src/app/(app)/technical-configurations/technical-configuration-document-rpc.ts"
)
const ALLOWLIST_PATH = path.join(REPO_ROOT, "src/app/api/rpc/[fn]/allowed-functions.ts")

const OPTION_DOCUMENT_RPC_FUNCTIONS = {
  listOptionDocuments: "technical_configuration_option_documents_list",
  createOptionDocument: "technical_configuration_option_document_create",
  updateOptionDocument: "technical_configuration_option_document_update",
  deleteOptionDocument: "technical_configuration_option_document_delete",
  upsertOptionCitation: "technical_configuration_option_citation_upsert",
  deleteOptionCitation: "technical_configuration_option_citation_delete",
} as const

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

function getInterfaceFields(source: string, interfaceName: string): string[] {
  const match = source.match(new RegExp(`export interface ${interfaceName} \\{([\\s\\S]*?)\\n\\}`))
  if (!match) return []
  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

describe("technical configuration option evidence TypeScript contracts", () => {
  it("keeps the manifest, wire contracts, wrappers, and aggregate allowlist wiring", () => {
    const rpcNamesSource = readFileSync(RPC_NAMES_PATH, "utf8")
    const typesSource = readFileSync(TYPES_PATH, "utf8")
    const adapterSource = readFileSync(ADAPTER_PATH, "utf8")
    const allowlistSource = readFileSync(ALLOWLIST_PATH, "utf8")

    for (const [key, rpcName] of Object.entries(OPTION_DOCUMENT_RPC_FUNCTIONS)) {
      expect(rpcNamesSource).toContain(`${key}: "${rpcName}"`)
    }
    expect(allowlistSource).toContain("...TECHNICAL_CONFIGURATION_RPC_FUNCTION_NAMES")

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
