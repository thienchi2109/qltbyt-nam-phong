import type { LanguageModel, UIMessage } from 'ai'
import type { GoogleLanguageModelOptions } from '@ai-sdk/google'

import { buildRepairRequestDraft } from './repair-request-draft-tool'
import { collectRepairRequestDraftEvidence } from './repair-request-draft-evidence'
import {
  buildRepairRequestDraftInputFromExtraction,
  extractRepairRequestDraftFields,
} from './repair-request-draft-extraction'
import { getRepairRequestDraftSessionState } from './repair-request-draft-session'
import { createRepairRequestDraftToolCallId } from './repair-request-draft-ui-stream'

export interface RepairRequestDraftOrchestrationResult {
  toolCallId: string
  input: ReturnType<typeof buildRepairRequestDraftInputFromExtraction> extends infer T
    ? Exclude<T, null>
    : never
  output: ReturnType<typeof buildRepairRequestDraft>
}

export async function maybeBuildRepairRequestDraftArtifact({
  model,
  messages,
  steps,
  providerOptions,
}: {
  model: LanguageModel
  messages: UIMessage[]
  steps: Array<{ toolResults: Array<{ toolName: string; output: unknown }> }>
  providerOptions?: {
    google?: GoogleLanguageModelOptions
  }
}): Promise<RepairRequestDraftOrchestrationResult | null> {
  const session = getRepairRequestDraftSessionState(messages)
  if (session.status !== 'active' || session.startMessageIndex === undefined) {
    return null
  }

  const activeMessages = messages.slice(session.startMessageIndex)
  const evidence = collectRepairRequestDraftEvidence({
    messages: activeMessages,
    steps,
  })
  if (evidence.equipmentResolution !== 'single' || evidence.equipment === null) {
    return null
  }

  const extraction = await extractRepairRequestDraftFields({
    model,
    messages: activeMessages,
    equipment: evidence.equipment,
    providerOptions,
  })

  const input = buildRepairRequestDraftInputFromExtraction({
    extraction,
    evidenceRefs: evidence.evidenceRefs,
    equipment: evidence.equipment,
  })
  if (input === null) {
    return null
  }

  return {
    toolCallId: createRepairRequestDraftToolCallId(input.thiet_bi_id),
    input,
    output: buildRepairRequestDraft(input),
  }
}

