/**
 * equipment-linked-request package barrel.
 *
 * Phase 1 of #338. Consumers import via '@/components/equipment-linked-request'.
 *
 * After the 2026-04-27 in-row icon pivot, the row trigger is
 * `LinkedRequestRowIndicator`.
 */

export { LinkedRequestProvider, useLinkedRequest } from './LinkedRequestContext'
export type { LinkedRequestContextValue } from './LinkedRequestContext'
export { LinkedRequestRowIndicator } from './LinkedRequestRowIndicator'
export { LinkedRequestSheetShell } from './LinkedRequestSheetShell'
export { LinkedRequestSheetHost } from './LinkedRequestSheetHost'
export type { LinkedRequestKind, LinkedRequestState, ActiveRepairResult } from './types'
