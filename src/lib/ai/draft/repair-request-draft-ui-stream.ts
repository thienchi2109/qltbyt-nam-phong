import type { UIMessage, UIMessageStreamWriter } from 'ai'

import type { RepairRequestDraft } from './repair-request-draft-schema'
import type { RepairRequestDraftInput } from './repair-request-draft-tool'

const REPAIR_REQUEST_DRAFT_TOOL_NAME = 'generateRepairRequestDraft'

export function createRepairRequestDraftToolCallId(
  equipmentId: number,
): string {
  return `${REPAIR_REQUEST_DRAFT_TOOL_NAME}-${equipmentId}`
}

export function writeRepairRequestDraftToolResult(
  writer: UIMessageStreamWriter<UIMessage>,
  {
    toolCallId,
    input,
    output,
  }: {
    toolCallId: string
    input: RepairRequestDraftInput
    output: RepairRequestDraft
  },
): void {
  writer.write({
    type: 'tool-input-available',
    toolCallId,
    toolName: REPAIR_REQUEST_DRAFT_TOOL_NAME,
    input,
  })
  writer.write({
    type: 'tool-output-available',
    toolCallId,
    output,
  })
}

