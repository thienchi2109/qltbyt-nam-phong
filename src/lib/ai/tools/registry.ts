import { tool, type ToolSet } from 'ai'

import { generateTroubleshootingDraft } from '@/lib/ai/draft/troubleshooting-tool'
import {
  type EquipmentLookupHints,
  normalizeEquipmentLookupArgs,
} from '@/lib/ai/tools/equipment-lookup-identifiers'
import {
  QUERY_CATALOG,
  QUERY_CATALOG_PENDING_TOOL_NAMES,
  QUERY_CATALOG_TOOL_NAME_SET,
  QUERY_CATALOG_TOOL_NAMES,
  getQueryCatalogMigrationStatusMap,
  getQueryCatalogToolRpcMapping,
  type MigrationStatus,
  type QueryCatalogToolName,
} from '@/lib/ai/tools/query-catalog'
import { executeRpcTool } from '@/lib/ai/tools/rpc-tool-executor'

export type { MigrationStatus } from '@/lib/ai/tools/query-catalog'

// ============================================
// Draft Tool Definitions (non-RPC, advisory-only)
// ============================================

export type DraftToolDefinition = {
  description: string
  draftKind: 'troubleshootingDraft' | 'repairRequestDraft'
  requiresEvidence: boolean
  minEvidenceCount?: number
  tool: ToolSet[string] | null
}

const DRAFT_TOOL_DEFINITIONS: Record<string, DraftToolDefinition> = {
  generateTroubleshootingDraft: {
    description: 'Generate a schema-validated troubleshooting advisory draft.',
    draftKind: 'troubleshootingDraft',
    requiresEvidence: true,
    minEvidenceCount: 2,
    tool: generateTroubleshootingDraft,
  },
  generateRepairRequestDraft: {
    description:
      'Build a schema-validated repair-request draft from evidence. Orchestration-driven: invoked by route, not model-autonomous.',
    draftKind: 'repairRequestDraft',
    requiresEvidence: true,
    minEvidenceCount: 1,
    tool: null, // Orchestration-driven: route invokes buildRepairRequestDraft() directly
  },
}

/** Exposed for contract-shape tests only. Do NOT import in production code. */
export const DRAFT_TOOL_DEFINITIONS_FOR_TEST = DRAFT_TOOL_DEFINITIONS

const DRAFT_TOOL_NAMES = new Set(Object.keys(DRAFT_TOOL_DEFINITIONS))

const KNOWN_BUT_BLOCKED_TOOLS = new Set(['systemDiagnostics'])

const ALLOWED_TOOL_NAMES = new Set([
  ...QUERY_CATALOG_TOOL_NAMES,
  ...DRAFT_TOOL_NAMES,
])

/** Returns tool name → RPC function mapping for contract-locking tests. */
export function getToolRpcMapping(): Record<string, string> {
  return getQueryCatalogToolRpcMapping()
}

/** Returns tool name → migrationStatus for contract-locking tests. */
export function getMigrationStatusMap(): Record<string, MigrationStatus> {
  return getQueryCatalogMigrationStatusMap()
}

/**
 * Read-only tools that have NOT yet been migrated to the envelope contract.
 * Listed explicitly so later audits and batch-migration scripts can iterate.
 *
 * Pending tools (pass 2+):
 *   - equipmentLookup      — large payload, needs field-level compaction
 *   - maintenanceSummary    — needs importantFields design
 *   - maintenancePlanLookup — needs importantFields design
 *   - repairSummary         — needs importantFields design
 *   - usageHistory          — needs importantFields design
 *   - attachmentLookup      — needs importantFields design
 *   - deviceQuotaLookup     — needs importantFields design
 *   - quotaComplianceSummary — needs importantFields design
 */
export const PENDING_TOOL_NAMES: ReadonlySet<string> = new Set(
  QUERY_CATALOG_PENDING_TOOL_NAMES,
)

/** Exposed for contract-shape tests only. Do NOT import in production code. */
export const READ_ONLY_TOOL_DEFINITIONS_FOR_TEST = QUERY_CATALOG

const KNOWN_TOOL_NAMES = new Set([
  ...QUERY_CATALOG_TOOL_NAMES,
  ...KNOWN_BUT_BLOCKED_TOOLS,
  ...DRAFT_TOOL_NAMES,
])

function normalizeToolNames(toolNames: string[]): string[] {
  const normalized = toolNames.map(name => name.trim()).filter(Boolean)
  return Array.from(new Set(normalized))
}

function isQueryCatalogToolName(toolName: string): toolName is QueryCatalogToolName {
  return QUERY_CATALOG_TOOL_NAME_SET.has(toolName)
}

export function hasWriteIntentToolName(toolName: string): boolean {
  return /(create|update|delete)/i.test(toolName)
}

export type RequestedToolValidationResult =
  | { ok: true; requestedTools: string[] }
  | { ok: false; message: string }

export function validateRequestedTools(
  requestedToolNames: string[],
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

export interface BuildToolRegistryParams {
  request: Request
  tenantId: number
  userId: string
  requestedTools: string[]
  equipmentLookupHints?: EquipmentLookupHints
}

export function buildToolRegistry({
  request,
  tenantId,
  userId,
  requestedTools,
  equipmentLookupHints,
}: BuildToolRegistryParams): ToolSet {
  const allowedRequestedTools = requestedTools.filter(toolName =>
    ALLOWED_TOOL_NAMES.has(toolName),
  )

  const tools: ToolSet = {}

  for (const toolName of allowedRequestedTools) {
    // Draft tools: wire directly (no RPC proxy)
    const draftDef = DRAFT_TOOL_DEFINITIONS[toolName]
    if (draftDef) {
      if (draftDef.tool) {
        tools[toolName] = draftDef.tool
      }
      continue
    }

    // RPC-backed read-only tools
    if (!isQueryCatalogToolName(toolName)) {
      continue
    }
    const rpcDef = QUERY_CATALOG[toolName]

    tools[toolName] = tool({
      description: rpcDef.description,
      inputSchema: rpcDef.inputSchema,
      execute: async (input: Record<string, unknown>) =>
        executeRpcTool({
          request,
          rpcFunction: rpcDef.rpcFunction,
          toolName,
          args: {
            ...(toolName === 'equipmentLookup'
              ? normalizeEquipmentLookupArgs(input, equipmentLookupHints)
              : toolName === 'categorySuggestion'
                ? {
                    p_device_name: input.device_name,
                  }
              : input),
            p_don_vi: tenantId,
            p_user_id: userId,
          },
        }),
    })
  }

  return tools
}
