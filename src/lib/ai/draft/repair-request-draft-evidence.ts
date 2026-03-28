import type { UIMessage } from 'ai'

import { DRAFT_ELIGIBLE_TOOLS } from '@/lib/ai/tools/rpc-tool-executor'
import { isRecord } from '@/lib/ai/tools/type-guards'

export interface RepairRequestDraftEquipmentContext {
  thiet_bi_id: number
  ma_thiet_bi?: string
  ten_thiet_bi?: string
}

export interface RepairRequestDraftEvidenceSummary {
  evidenceRefs: string[]
  equipment: RepairRequestDraftEquipmentContext | null
  equipmentMatches: RepairRequestDraftEquipmentContext[]
  equipmentResolution: 'none' | 'single' | 'multiple'
}

interface ToolResultLike {
  toolName: string
  output: unknown
}


function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readPositiveInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim())
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed
    }
  }

  return null
}

function normalizeEquipmentRow(
  value: unknown,
): RepairRequestDraftEquipmentContext | null {
  if (!isRecord(value)) {
    return null
  }

  const thietBiId = readPositiveInt(value.thiet_bi_id)
  if (thietBiId === null) {
    return null
  }

  return {
    thiet_bi_id: thietBiId,
    ma_thiet_bi: readOptionalString(value.ma_thiet_bi),
    ten_thiet_bi: readOptionalString(value.ten_thiet_bi),
  }
}

function readFollowUpContext(output: unknown): Record<string, unknown> | null {
  if (!isRecord(output)) {
    return null
  }

  const ctx = output.followUpContext
  if (!isRecord(ctx)) {
    return null
  }

  return ctx
}

function extractEquipmentMatchesFromFollowUp(
  output: unknown,
): RepairRequestDraftEquipmentContext[] {
  // New envelope path: followUpContext.equipment
  const ctx = readFollowUpContext(output)
  if (ctx && Array.isArray(ctx.equipment)) {
    return ctx.equipment
      .map(normalizeEquipmentRow)
      .filter(
        (item): item is RepairRequestDraftEquipmentContext => item !== null,
      )
  }

  // Backward-compat: pre-envelope history messages use { data: [...], total }
  if (isRecord(output) && Array.isArray(output.data)) {
    return output.data
      .map(normalizeEquipmentRow)
      .filter(
        (item): item is RepairRequestDraftEquipmentContext => item !== null,
      )
  }

  return []
}

function hasEvidenceRef(output: unknown): boolean {
  const ctx = readFollowUpContext(output)
  if (!ctx) {
    return false
  }
  return typeof ctx.evidenceRef === 'string' && ctx.evidenceRef.trim().length > 0
}

function extractToolResultsFromMessages(messages: UIMessage[]): ToolResultLike[] {
  return messages.flatMap(message => {
    if (!Array.isArray(message.parts)) {
      return []
    }

    return message.parts.flatMap(part => {
      if (!part || typeof part !== 'object') {
        return []
      }

      const record = part as Record<string, unknown>
      if (
        typeof record.toolName !== 'string' ||
        record.state !== 'output-available' ||
        !('output' in record)
      ) {
        return []
      }

      return [
        {
          toolName: record.toolName,
          output: record.output,
        },
      ]
    })
  })
}

function extractToolResultsFromSteps(
  steps: Array<{ toolResults: Array<{ toolName: string; output: unknown }> }>,
): ToolResultLike[] {
  return steps.flatMap(step => step.toolResults)
}

export function collectRepairRequestDraftEvidence({
  messages,
  steps,
}: {
  messages: UIMessage[]
  steps: Array<{ toolResults: Array<{ toolName: string; output: unknown }> }>
}): RepairRequestDraftEvidenceSummary {
  const evidenceRefs = new Set<string>()
  const equipmentMatches = new Map<number, RepairRequestDraftEquipmentContext>()

  const toolResults = [
    ...extractToolResultsFromMessages(messages),
    ...extractToolResultsFromSteps(steps),
  ]

  for (const result of toolResults) {
    if (
      DRAFT_ELIGIBLE_TOOLS.has(result.toolName) ||
      hasEvidenceRef(result.output)
    ) {
      evidenceRefs.add(result.toolName)
    }

    if (result.toolName !== 'equipmentLookup') {
      continue
    }

    for (const match of extractEquipmentMatchesFromFollowUp(result.output)) {
      if (!equipmentMatches.has(match.thiet_bi_id)) {
        equipmentMatches.set(match.thiet_bi_id, match)
      }
    }
  }

  const normalizedMatches = Array.from(equipmentMatches.values())
  const equipmentResolution =
    normalizedMatches.length === 0
      ? 'none'
      : normalizedMatches.length === 1
        ? 'single'
        : 'multiple'

  return {
    evidenceRefs: Array.from(evidenceRefs),
    equipment: equipmentResolution === 'single' ? normalizedMatches[0] : null,
    equipmentMatches: normalizedMatches,
    equipmentResolution,
  }
}

