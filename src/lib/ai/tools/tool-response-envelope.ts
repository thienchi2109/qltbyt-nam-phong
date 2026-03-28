/**
 * Shared envelope contract for read-only / RPC assistant tool outputs.
 *
 * Draft-producing tools (generateTroubleshootingDraft, generateRepairRequestDraft)
 * are explicitly excluded — they keep their raw artifact output shape.
 */

import { isRecord } from './type-guards'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelSummary {
  summaryText: string
  importantFields?: Record<string, unknown>
  itemCount?: number
  truncated?: boolean
}

export interface ToolResponseEnvelopeUiArtifact {
  /** The original, uncompacted RPC payload — consumed by UI renderers. */
  rawPayload: unknown
}

export interface ToolResponseEnvelope {
  modelSummary: ModelSummary
  followUpContext?: Record<string, unknown>
  uiArtifact?: ToolResponseEnvelopeUiArtifact
}

// ---------------------------------------------------------------------------
// Draft-tool carve-out
// ---------------------------------------------------------------------------

/** Names of draft-producing tools that must NOT be wrapped in an envelope. */
export const DRAFT_TOOL_NAMES_SET: ReadonlySet<string> = new Set([
  'generateTroubleshootingDraft',
  'generateRepairRequestDraft',
])

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------


/**
 * Returns `true` when `output` looks like a `ToolResponseEnvelope`.
 *
 * Checks structural shape only — does not deep-validate nested fields.
 */
export function isToolResponseEnvelope(
  output: unknown,
): output is ToolResponseEnvelope {
  if (!isRecord(output)) {
    return false
  }

  const summary = output.modelSummary
  if (!isRecord(summary)) {
    return false
  }

  return typeof summary.summaryText === 'string'
}

// ---------------------------------------------------------------------------
// Compaction
// ---------------------------------------------------------------------------

/**
 * Compact a single tool output for model-visible history.
 *
 * - Draft-tool outputs pass through unchanged.
 * - Non-envelope (pending / un-migrated) outputs pass through unchanged.
 * - Envelope outputs are reduced to `{ modelSummary, followUpContext }`,
 *   stripping `uiArtifact` to save payload space.
 */
export function compactToolOutput(
  toolName: string,
  output: unknown,
): unknown {
  // Draft tools are never compacted.
  if (DRAFT_TOOL_NAMES_SET.has(toolName)) {
    return output
  }

  // Only compact if the output is a recognized envelope.
  if (!isToolResponseEnvelope(output)) {
    return output
  }

  const compacted: Record<string, unknown> = {
    modelSummary: output.modelSummary,
  }

  if (output.followUpContext !== undefined) {
    compacted.followUpContext = output.followUpContext
  }

  return compacted
}
