import { tool, type ToolSet } from 'ai'
import { z } from 'zod'

import { generateTroubleshootingDraft } from '@/lib/ai/draft/troubleshooting-tool'
import {
  type EquipmentLookupHints,
  normalizeEquipmentLookupArgs,
} from '@/lib/ai/tools/equipment-lookup-identifiers'
import { executeRpcTool } from '@/lib/ai/tools/rpc-tool-executor'

// ---------------------------------------------------------------------------
// Migration status: tracks which tools have been migrated to the envelope
// contract. Only 'migrated' tools produce a ToolResponseEnvelope with
// importantFields / modelBudget; 'pending' tools still return raw payloads.
// ---------------------------------------------------------------------------

export type MigrationStatus = 'migrated' | 'pending'

type ReadOnlyToolDefinition = {
  description: string
  rpcFunction: string
  inputSchema: z.ZodType<Record<string, unknown>>
  migrationStatus: MigrationStatus
  modelBudget?: {
    maxItems?: number
    maxBytes?: number
    modelVisibleFields?: string[]
  }
}

const READ_ONLY_TOOL_DEFINITIONS: Record<string, ReadOnlyToolDefinition> = {
  equipmentLookup: {
    description:
      'Lookup equipment details using approved read-only RPC. Supports text search plus structured `filters` for exact `equipmentCode`, current status, department, location, classification, model, and serial; use the returned total for aggregate counts.',
    rpcFunction: 'ai_equipment_lookup',
    migrationStatus: 'pending',
    inputSchema: z
      .object({
        query: z.string().trim().min(1).max(200).optional(),
        limit: z.number().int().min(1).max(50).optional(),
        status: z.string().trim().min(1).max(100).optional(),
        filters: z
          .object({
            equipmentCode: z.string().trim().min(1).max(200).optional(),
            status: z.string().trim().min(1).max(100).optional(),
            department: z.string().trim().min(1).max(200).optional(),
            location: z.string().trim().min(1).max(200).optional(),
            classification: z.string().trim().min(1).max(50).optional(),
            model: z.string().trim().min(1).max(200).optional(),
            serial: z.string().trim().min(1).max(200).optional(),
          })
          .strict()
          .optional(),
      })
      .strict(),
  },
  maintenanceSummary: {
    description: 'Retrieve maintenance summary data via approved read-only RPC.',
    rpcFunction: 'ai_maintenance_summary',
    migrationStatus: 'pending',
    inputSchema: z
      .object({
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      })
      .strict(),
  },
  maintenancePlanLookup: {
    description:
      'Lookup maintenance, calibration, and inspection plans for a specific equipment item.',
    rpcFunction: 'ai_maintenance_plan_lookup',
    migrationStatus: 'pending',
    inputSchema: z
      .object({
        p_thiet_bi_id: z.number().int().positive(),
        p_nam: z.number().int().min(2000).max(2100).optional(),
      })
      .strict(),
  },
  repairSummary: {
    description: 'Retrieve repair summary data via approved read-only RPC.',
    rpcFunction: 'ai_repair_summary',
    migrationStatus: 'pending',
    inputSchema: z
      .object({
        status: z.string().trim().min(1).max(50).optional(),
      })
      .strict(),
  },
  usageHistory: {
    description:
      'Retrieve usage summary evidence for a specific equipment item from usage logs.',
    rpcFunction: 'ai_usage_summary',
    migrationStatus: 'pending',
    inputSchema: z
      .object({
        p_thiet_bi_id: z.number().int().positive(),
        p_months: z.number().int().min(1).max(24).optional(),
      })
      .strict(),
  },
  attachmentLookup: {
    description:
      'Lookup attachment metadata (file names, access types, URLs) for a specific equipment item. Returns normalized access contract.',
    rpcFunction: 'ai_attachment_metadata',
    migrationStatus: 'pending',
    inputSchema: z
      .object({
        p_thiet_bi_id: z.number().int().positive(),
      })
      .strict(),
  },
  deviceQuotaLookup: {
    description:
      'Check quota status for a specific equipment item against the active quota decision.',
    rpcFunction: 'ai_device_quota_lookup',
    migrationStatus: 'pending',
    inputSchema: z
      .object({
        p_thiet_bi_id: z.number().int().positive(),
      })
      .strict(),
  },
  quotaComplianceSummary: {
    description:
      'Get facility-level device quota compliance overview from the active decision.',
    rpcFunction: 'ai_quota_compliance_summary',
    migrationStatus: 'pending',
    inputSchema: z.object({}).strict(),
  },
  categorySuggestion: {
    description:
      'Suggest the best matching equipment categories for a provided device name. Call this only after the user has given `device_name`; the RPC returns a bounded candidate set instead of the full category catalog.',
    rpcFunction: 'ai_category_suggestion',
    migrationStatus: 'migrated',
    inputSchema: z
      .object({
        device_name: z.string().trim().min(1).max(200),
      })
      .strict(),
    modelBudget: {
      maxItems: 10,
      modelVisibleFields: ['ma_nhom', 'ten_nhom', 'parent_name', 'phan_loai', 'match_reason'],
    },
  },
  departmentList: {
    description:
      'List all departments (khoa/phòng) with equipment in the current facility. Call this BEFORE filtering equipmentLookup by department to get exact department names from the database.',
    rpcFunction: 'ai_department_list',
    migrationStatus: 'migrated',
    inputSchema: z.object({}).strict(),
    modelBudget: {
      maxItems: 50,
      modelVisibleFields: ['name', 'equipment_count'],
    },
  },
}

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
  ...Object.keys(READ_ONLY_TOOL_DEFINITIONS),
  ...DRAFT_TOOL_NAMES,
])

/** Returns tool name → RPC function mapping for contract-locking tests. */
export function getToolRpcMapping(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(READ_ONLY_TOOL_DEFINITIONS).map(([k, v]) => [k, v.rpcFunction]),
  )
}

/** Returns tool name → migrationStatus for contract-locking tests. */
export function getMigrationStatusMap(): Record<string, MigrationStatus> {
  return Object.fromEntries(
    Object.entries(READ_ONLY_TOOL_DEFINITIONS).map(([k, v]) => [k, v.migrationStatus]),
  )
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
  Object.entries(READ_ONLY_TOOL_DEFINITIONS)
    .filter(([, def]) => def.migrationStatus === 'pending')
    .map(([name]) => name),
)

/** Exposed for contract-shape tests only. Do NOT import in production code. */
export const READ_ONLY_TOOL_DEFINITIONS_FOR_TEST = READ_ONLY_TOOL_DEFINITIONS

const KNOWN_TOOL_NAMES = new Set([
  ...Object.keys(READ_ONLY_TOOL_DEFINITIONS),
  ...KNOWN_BUT_BLOCKED_TOOLS,
  ...DRAFT_TOOL_NAMES,
])

function normalizeToolNames(toolNames: string[]): string[] {
  const normalized = toolNames.map(name => name.trim()).filter(Boolean)
  return Array.from(new Set(normalized))
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
    const rpcDef = READ_ONLY_TOOL_DEFINITIONS[toolName]
    if (!rpcDef) {
      continue
    }

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
