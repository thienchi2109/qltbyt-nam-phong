import type { TechnicalConfigurationBaselineEditorProgress } from "./technical-configuration-baseline-save"

/** Updates the persisted and editor revisions carried by resumable save progress. */
export function updateRevision(
  progress: TechnicalConfigurationBaselineEditorProgress,
  revision: number
): void {
  progress.baseDraft.revision = revision
  progress.editorDraft.revision = revision
}

/** Advances the next criterion sequence number from a persisted criterion code. */
export function updateNextCriterionNumber(
  progress: TechnicalConfigurationBaselineEditorProgress,
  criterionCode: string
): void {
  const sequence = Number.parseInt(criterionCode.replace(/^TC-/, ""), 10)
  if (Number.isFinite(sequence)) {
    progress.baseDraft.next_criterion_number = Math.max(
      progress.baseDraft.next_criterion_number,
      sequence + 1
    )
  }
}

/** Compares two ID sequences without reordering either input. */
export function sameOrder(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index])
}
