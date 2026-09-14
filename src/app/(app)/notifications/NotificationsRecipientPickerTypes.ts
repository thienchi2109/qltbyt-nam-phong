import { isGlobalRole } from "@/lib/rbac"

export type Recipient = {
  user_id: string
  username: string
  full_name: string | null
  status: "eligible" | "ineligible"
  protected: boolean
  editable: boolean
}

export type Candidate = Pick<Recipient, "user_id" | "username" | "full_name">
export type LoadState = "idle" | "loading" | "ready" | "error"

/** Empty recipient draft. */
export const EMPTY_RECIPIENTS: Record<string, Recipient> = {}

/** Checks recipient configuration roles supported by the API. */
export function isRecipientConfigRole(role: string | null | undefined): boolean {
  return isGlobalRole(role) || role?.trim().toLowerCase() === "to_qltb"
}

/** Resolves the session effective unit without inventing a fallback. */
export function getEffectiveDonVi(user: {
  current_don_vi?: string | number | null
  don_vi?: string | number | null
}): string | null {
  const value = user.current_don_vi ?? user.don_vi
  if (value === null || value === undefined || !/^[1-9][0-9]*$/.test(String(value))) {
    return null
  }
  return String(value)
}

function isCandidate(value: unknown): value is Candidate {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as Partial<Candidate>
  return (
    typeof candidate.user_id === "string" &&
    /^[1-9][0-9]*$/.test(candidate.user_id) &&
    typeof candidate.username === "string" &&
    (candidate.full_name === null || typeof candidate.full_name === "string")
  )
}

function isRecipient(value: unknown): value is Recipient {
  if (!isCandidate(value)) return false
  const recipient = value as Partial<Recipient>
  return (
    (recipient.status === "eligible" || recipient.status === "ineligible") &&
    typeof recipient.protected === "boolean" &&
    typeof recipient.editable === "boolean"
  )
}

/** Validates the complete configuration for the requested unit. */
export function parseConfigPayload(value: unknown, targetDonViId: string): Recipient[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const payload = value as { version?: unknown; don_vi_id?: unknown; recipients?: unknown }
  if (
    payload.version !== 1 ||
    String(payload.don_vi_id) !== targetDonViId ||
    !Array.isArray(payload.recipients) ||
    payload.recipients.some((recipient) => !isRecipient(recipient))
  ) {
    return null
  }
  return payload.recipients
}

/** Validates a bounded candidate page for the requested unit. */
export function parseCandidatesPayload(
  value: unknown,
  targetDonViId: string
): { candidates: Candidate[]; nextCursor: string | null } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const payload = value as {
    version?: unknown
    don_vi_id?: unknown
    candidates?: unknown
    next_cursor?: unknown
  }
  if (
    payload.version !== 1 ||
    String(payload.don_vi_id) !== targetDonViId ||
    !Array.isArray(payload.candidates) ||
    payload.candidates.some((candidate) => !isCandidate(candidate)) ||
    (payload.next_cursor !== null &&
      (typeof payload.next_cursor !== "string" || !/^[1-9][0-9]*$/.test(payload.next_cursor)))
  ) {
    return null
  }
  return { candidates: payload.candidates, nextCursor: payload.next_cursor }
}

/** Reads JSON and surfaces safe API failure codes. */
export async function readResponse(response: Response): Promise<unknown> {
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  if (!response.ok) {
    const code =
      payload && typeof payload === "object" && !Array.isArray(payload) && "error" in payload
        ? (payload.error as { code?: unknown } | null)?.code
        : null
    throw new Error(typeof code === "string" ? code : "request_failed")
  }
  return payload
}

/** Formats the account label shown in the picker. */
export function displayRecipientName(recipient: Pick<Recipient, "full_name" | "username">): string {
  return `${recipient.full_name || "Chưa có họ tên"} (${recipient.username})`
}

/** Indexes full configuration by stable account identity. */
export function recipientMapFromConfig(recipients: Recipient[]): Record<string, Recipient> {
  return recipients.reduce<Record<string, Recipient>>((next, recipient) => {
    next[recipient.user_id] = recipient
    return next
  }, {})
}

/** Serializes normal recipients; protected membership is preserved by the server. */
export function selectedRecipientNames(recipients: Record<string, Recipient>): string {
  return Object.values(recipients)
    .filter((recipient) => !recipient.protected)
    .map((recipient) => recipient.username)
    .join(",")
}
