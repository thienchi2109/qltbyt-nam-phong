/**
 * Shared Change History presentation contract.
 * Domain-agnostic: Transfers, Repairs, and future domains all normalize
 * their history data to this contract before rendering.
 * @module components/change-history/ChangeHistoryTypes
 */

/** A single key-value detail row within a history entry */
export interface ChangeHistoryDetail {
  label: string
  value: string
}

/** Normalized history entry — the universal contract for all domains */
export interface ChangeHistoryEntry {
  /** Unique identifier for the entry (for React key) */
  id: string
  /** When the change occurred (ISO 8601 string) */
  occurredAt: string
  /** Human-readable action label, e.g. "Tạo yêu cầu", "Duyệt" */
  actionLabel: string
  /** Display name of the person who made the change. Null if unknown/system action */
  actorName: string | null
  /** Key-value pairs describing what changed */
  details: ChangeHistoryDetail[]
}
