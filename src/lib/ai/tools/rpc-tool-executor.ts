import type { ToolResponseEnvelope } from './tool-response-envelope'
import { isRecord } from './type-guards'

export interface RpcToolExecutionParams {
  request: Request
  rpcFunction: string
  toolName: string
  args: Record<string, unknown>
}

function buildRpcUrl(request: Request, rpcFunction: string): string {
  const origin = new URL(request.url).origin
  return new URL(`/api/rpc/${encodeURIComponent(rpcFunction)}`, origin).toString()
}

// ---------------------------------------------------------------------------
// Draft-eligible tools that must populate followUpContext
// ---------------------------------------------------------------------------

export const DRAFT_ELIGIBLE_TOOLS: ReadonlySet<string> = new Set([
  'equipmentLookup',
  'repairSummary',
  'maintenanceSummary',
  'maintenancePlanLookup',
  'usageHistory',
])

// ---------------------------------------------------------------------------
// followUpContext builders
// ---------------------------------------------------------------------------

interface EquipmentFollowUpRow {
  thiet_bi_id: number
  ma_thiet_bi?: string
  ten_thiet_bi?: string
}


function buildEquipmentFollowUp(
  payload: unknown,
): Record<string, unknown> | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    return undefined
  }

  const equipment: EquipmentFollowUpRow[] = payload.data
    .filter(
      (row: unknown): row is Record<string, unknown> =>
        isRecord(row) &&
        typeof row.thiet_bi_id === 'number' &&
        Number.isInteger(row.thiet_bi_id) &&
        row.thiet_bi_id > 0,
    )
    .map((row: Record<string, unknown>) => {
      const entry: EquipmentFollowUpRow = {
        thiet_bi_id: row.thiet_bi_id as number,
      }
      if (typeof row.ma_thiet_bi === 'string' && row.ma_thiet_bi.trim()) {
        entry.ma_thiet_bi = row.ma_thiet_bi.trim()
      }
      if (typeof row.ten_thiet_bi === 'string' && row.ten_thiet_bi.trim()) {
        entry.ten_thiet_bi = row.ten_thiet_bi.trim()
      }
      return entry
    })

  return { equipment }
}

function buildEvidenceRefFollowUp(
  toolName: string,
): Record<string, unknown> {
  return { evidenceRef: toolName }
}

function buildFollowUpContext(
  toolName: string,
  payload: unknown,
): Record<string, unknown> | undefined {
  if (!DRAFT_ELIGIBLE_TOOLS.has(toolName)) {
    return undefined
  }

  if (toolName === 'equipmentLookup') {
    return buildEquipmentFollowUp(payload)
  }

  return buildEvidenceRefFollowUp(toolName)
}

// ---------------------------------------------------------------------------
// Envelope builder
// ---------------------------------------------------------------------------

function buildModelSummaryText(
  toolName: string,
  payload: unknown,
): string {
  if (isRecord(payload) && typeof payload.total === 'number') {
    return `${toolName}: ${payload.total} result(s).`
  }
  if (Array.isArray(payload)) {
    return `${toolName}: ${payload.length} item(s).`
  }
  return `${toolName}: completed.`
}

function buildItemCount(payload: unknown): number | undefined {
  if (isRecord(payload) && typeof payload.total === 'number') {
    return payload.total
  }
  if (Array.isArray(payload)) {
    return payload.length
  }
  return undefined
}

/** Exposed for tests only. */
export function wrapRpcResultAsEnvelope(
  toolName: string,
  payload: unknown,
): ToolResponseEnvelope {
  const followUpContext = buildFollowUpContext(toolName, payload)
  const itemCount = buildItemCount(payload)

  return {
    modelSummary: {
      summaryText: buildModelSummaryText(toolName, payload),
      ...(itemCount !== undefined && { itemCount }),
    },
    ...(followUpContext !== undefined && { followUpContext }),
    uiArtifact: { rawPayload: payload },
  }
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function executeRpcTool({
  request,
  rpcFunction,
  toolName,
  args,
}: RpcToolExecutionParams): Promise<ToolResponseEnvelope> {
  const headers = new Headers({ 'content-type': 'application/json' })
  const cookie = request.headers.get('cookie')
  if (cookie) {
    headers.set('cookie', cookie)
  }

  const response = await fetch(buildRpcUrl(request, rpcFunction), {
    method: 'POST',
    headers,
    cache: 'no-store',
    body: JSON.stringify(args),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(`RPC tool "${rpcFunction}" failed`)
  }

  return wrapRpcResultAsEnvelope(toolName, payload)
}
