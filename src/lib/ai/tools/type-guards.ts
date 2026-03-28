/**
 * Shared type-guard utilities for AI tool infrastructure.
 */

/** Returns `true` when `value` is a plain JS object (not null, not an array). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
