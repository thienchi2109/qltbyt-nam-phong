/**
 * Server-side compaction helper for validated UI messages.
 *
 * Compacts migrated read-only / RPC tool outputs and measures the
 * resulting character budget. Keeps route.ts thin by encapsulating
 * the compaction + measurement step.
 */

import type { UIMessage } from 'ai'
import { compactUIMessages } from '@/lib/ai/compact-ui-messages'
import { calculateInputChars } from '@/lib/ai/limits'

interface CompactResult {
  compactedMessages: UIMessage[]
  compactedChars: number
}

export function compactValidatedMessages(
  validatedMessages: UIMessage[],
): CompactResult {
  const compactedMessages = compactUIMessages(validatedMessages)
  const compactedChars = calculateInputChars(compactedMessages)
  return { compactedMessages, compactedChars }
}
