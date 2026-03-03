import { tool, type ToolSet } from 'ai'
import { z } from 'zod'

import { executeRpcTool } from '@/lib/ai/tools/rpc-tool-executor'

type ReadOnlyToolDefinition = {
  description: string
  rpcFunction: string
  inputSchema: z.ZodType<Record<string, unknown>>
}

const READ_ONLY_TOOL_DEFINITIONS: Record<string, ReadOnlyToolDefinition> = {
  equipmentLookup: {
    description: 'Lookup equipment details using approved read-only RPC.',
    rpcFunction: 'ai_equipment_lookup',
    inputSchema: z
      .object({
        query: z.string().trim().min(1).max(200).optional(),
        limit: z.number().int().min(1).max(50).optional(),
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
  repairSummary: {
    description: 'Retrieve repair summary data via approved read-only RPC.',
    rpcFunction: 'ai_repair_summary',
    inputSchema: z
      .object({
        status: z.string().trim().min(1).max(50).optional(),
      })
      .strict(),
  },
}

const KNOWN_BUT_BLOCKED_TOOLS = new Set(['systemDiagnostics'])

const ALLOWED_TOOL_NAMES = new Set(Object.keys(READ_ONLY_TOOL_DEFINITIONS))
const KNOWN_TOOL_NAMES = new Set([
  ...Object.keys(READ_ONLY_TOOL_DEFINITIONS),
  ...KNOWN_BUT_BLOCKED_TOOLS,
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
}

export function buildToolRegistry({
  request,
  tenantId,
  userId,
  requestedTools,
}: BuildToolRegistryParams): ToolSet {
  const allowedRequestedTools = requestedTools.filter(toolName =>
    ALLOWED_TOOL_NAMES.has(toolName),
  )

  const tools: ToolSet = {}
  for (const toolName of allowedRequestedTools) {
    const definition = READ_ONLY_TOOL_DEFINITIONS[toolName]
    if (!definition) {
      continue
    }

    tools[toolName] = tool({
      description: definition.description,
      inputSchema: definition.inputSchema,
      execute: async (input: Record<string, unknown>) =>
        executeRpcTool({
          request,
          rpcFunction: definition.rpcFunction,
          args: {
            ...input,
            p_don_vi: tenantId,
            p_user_id: userId,
          },
        }),
    })
  }

  return tools
}
