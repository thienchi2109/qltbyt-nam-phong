import { tool, type ToolSet } from 'ai'
import { z } from 'zod'

import { generateTroubleshootingDraft } from '@/lib/ai/draft/troubleshooting-tool'
import {
  type EquipmentLookupHints,
  normalizeEquipmentLookupArgs,
} from '@/lib/ai/tools/equipment-lookup-identifiers'
import { executeRpcTool } from '@/lib/ai/tools/rpc-tool-executor'

type ReadOnlyToolDefinition = {
  description: string
  rpcFunction: string
  inputSchema: z.ZodType<Record<string, unknown>>
}

const READ_ONLY_TOOL_DEFINITIONS: Record<string, ReadOnlyToolDefinition> = {
  equipmentLookup: {
    description:
      'Lookup equipment details using approved read-only RPC. Supports text search plus structured `filters` for exact `equipmentCode`, current status, department, location, classification, model, and serial; use the returned total for aggregate counts.',
    rpcFunction: 'ai_equipment_lookup',
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
    inputSchema: z
      .object({
        thiet_bi_id: z.number().int().positive(),
        p_nam: z.number().int().min(2000).max(2100).optional(),
      })
      .strict(),
  },
  repairSummary: {
    description: 'Retrieve repair summary data via approved read-only RPC.',
    rpcFunction: 'ai_repair_summary',
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
    inputSchema: z
      .object({
        thiet_bi_id: z.number().int().positive(),
        p_months: z.number().int().min(1).max(24).optional(),
      })
      .strict(),
  },
  attachmentLookup: {
    description:
      'Lookup attachment metadata (file names, access types, URLs) for a specific equipment item. Returns normalized access contract.',
    rpcFunction: 'ai_attachment_metadata',
    inputSchema: z
      .object({
        thiet_bi_id: z.number().int().positive(),
      })
      .strict(),
  },
  deviceQuotaLookup: {
    description:
      'Check quota status for a specific equipment item against the active quota decision.',
    rpcFunction: 'ai_device_quota_lookup',
    inputSchema: z
      .object({
        thiet_bi_id: z.number().int().positive(),
      })
      .strict(),
  },
  quotaComplianceSummary: {
    description:
      'Get facility-level device quota compliance overview from the active decision.',
    rpcFunction: 'ai_quota_compliance_summary',
    inputSchema: z.object({}).strict(),
  },
  categorySuggestion: {
    description:
      'List all equipment categories for the current facility. Used when the user asks which category a device should be assigned to. The model reasons about semantic similarity between the device name and category names.',
    rpcFunction: 'ai_category_list',
    inputSchema: z.object({}).strict(),
  },
  departmentList: {
    description:
      'List all departments (khoa/phòng) with equipment in the current facility. Call this BEFORE filtering equipmentLookup by department to get exact department names from the database.',
    rpcFunction: 'ai_department_list',
    inputSchema: z.object({}).strict(),
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
          args: {
            ...(toolName === 'equipmentLookup'
              ? normalizeEquipmentLookupArgs(input, equipmentLookupHints)
              : input),
            p_don_vi: tenantId,
            p_user_id: userId,
          },
        }),
    })
  }

  return tools
}
