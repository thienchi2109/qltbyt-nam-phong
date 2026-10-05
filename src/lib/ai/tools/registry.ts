import {
  QUERY_CATALOG,
  QUERY_CATALOG_PENDING_TOOL_NAMES,
  QUERY_CATALOG_TOOL_NAMES,
  getQueryCatalogMigrationStatusMap,
  type MigrationStatus,
} from "@/lib/ai/tools/query-catalog"

export type { MigrationStatus } from "@/lib/ai/tools/query-catalog"

const ASSISTANT_SQL_TOOL_NAME = "query_database"
const KNOWN_BUT_BLOCKED_TOOLS = new Set(["systemDiagnostics"])
const DESCRIPTOR_ONLY_TOOL_NAMES = new Set([
  "generateTroubleshootingDraft",
  "generateRepairRequestDraft",
])

const ALLOWED_TOOL_NAMES = new Set([
  ...QUERY_CATALOG_TOOL_NAMES,
  ...DESCRIPTOR_ONLY_TOOL_NAMES,
  ASSISTANT_SQL_TOOL_NAME,
])

/** Exposed for contract-shape tests only. Do NOT import in production code. */
export function getAllowedToolNamesForTest(): string[] {
  return [...ALLOWED_TOOL_NAMES].sort()
}

/** Returns tool name → migrationStatus for contract-locking tests. */
export function getMigrationStatusMap(): Record<string, MigrationStatus> {
  return getQueryCatalogMigrationStatusMap()
}

/** Read-only tools that still need a later envelope-contract migration. */
export const PENDING_TOOL_NAMES: ReadonlySet<string> = new Set(QUERY_CATALOG_PENDING_TOOL_NAMES)

/** Exposed for contract-shape tests only. Do NOT import in production code. */
export const READ_ONLY_TOOL_DEFINITIONS_FOR_TEST = QUERY_CATALOG

const KNOWN_TOOL_NAMES = new Set([
  ...QUERY_CATALOG_TOOL_NAMES,
  ...DESCRIPTOR_ONLY_TOOL_NAMES,
  ...KNOWN_BUT_BLOCKED_TOOLS,
  ASSISTANT_SQL_TOOL_NAME,
])

function normalizeToolNames(toolNames: string[]): string[] {
  const normalized = toolNames.map((name) => name.trim()).filter(Boolean)
  return Array.from(new Set(normalized))
}

function hasWriteIntentToolName(toolName: string): boolean {
  return /(create|update|delete)/i.test(toolName)
}

export type RequestedToolValidationResult =
  { ok: true; requestedTools: string[] } | { ok: false; message: string }

/** Validates the browser tool allowlist before the BFF signs a Go request. */
export function validateRequestedTools(
  requestedToolNames: string[]
): RequestedToolValidationResult {
  const requestedTools = normalizeToolNames(requestedToolNames)
  for (const toolName of requestedTools) {
    if (hasWriteIntentToolName(toolName)) {
      return {
        ok: false,
        message: `Write-intent tool names are blocked: ${toolName}`,
      }
    }

    if (!KNOWN_TOOL_NAMES.has(toolName)) {
      return { ok: false, message: `Unknown tool requested: ${toolName}` }
    }

    if (!ALLOWED_TOOL_NAMES.has(toolName)) {
      return { ok: false, message: `Tool is not allowed in v1: ${toolName}` }
    }
  }

  return { ok: true, requestedTools }
}
