/**
 * Message-level compaction for read-only / RPC tool outputs.
 *
 * Walks a UIMessage array and replaces envelope-wrapped tool outputs
 * with their compacted form (strips `uiArtifact`, keeps `modelSummary`
 * + `followUpContext`). Draft-tool and non-envelope outputs pass through.
 *
 * Pure function — does not mutate the original array.
 * Usable on both client (transport) and server (route).
 */

import { type UIMessage, isToolUIPart, getToolName } from 'ai'
import { compactToolOutput } from './tools/tool-response-envelope'

export function compactUIMessages(
  messages: readonly UIMessage[],
): UIMessage[] {
  return messages.map(msg => {
    if (msg.role !== 'assistant') return msg

    const hasToolParts = msg.parts.some(p => isToolUIPart(p))
    if (!hasToolParts) return msg

    return {
      ...msg,
      parts: msg.parts.map(part => {
        if (!isToolUIPart(part)) return part
        if (part.state !== 'output-available') return part

        const toolName = getToolName(part)
        const compacted = compactToolOutput(toolName, part.output)
        if (compacted === part.output) return part // no-op optimization

        return { ...part, output: compacted }
      }),
    }
  })
}
