/**
 * equipment-linked-request package barrel.
 *
 * Phase 1 of #338. Consumers import via '@/components/equipment-linked-request'.
 *
 * After the 2026-04-27 in-row icon pivot, the chip-style `LinkedRequestButton`
 * is no longer part of this package — its role is taken over by
 * `LinkedRequestRowIndicator`, added in PR-3b.
 */

export { LinkedRequestProvider, useLinkedRequest, Context } from './LinkedRequestContext'
export type { LinkedRequestContextValue } from './LinkedRequestContext'
export { LinkedRequestSheetHost } from './LinkedRequestSheetHost'
export { LinkedRequestRowIndicator } from './LinkedRequestRowIndicator'
export { useIsLinkedRequestActive } from './useIsLinkedRequestActive'
export type { LinkedRequestKind, LinkedRequestState, ActiveRepairResult } from './types'
