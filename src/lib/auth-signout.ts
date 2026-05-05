import { signOut } from "next-auth/react"

import type { AuthPendingSignoutReason } from "@/types/auth"

type SignOutReasonUpdate = {
  pending_signout_reason: AuthPendingSignoutReason
}

type UpdateSessionFn = ((data?: SignOutReasonUpdate) => Promise<unknown>) | null | undefined

type SignOutWithReasonOptions = {
  updateSession?: UpdateSessionFn
  reason: AuthPendingSignoutReason
  delayMs?: number
  callbackUrl?: string
}

const UPDATE_SESSION_TIMEOUT_MS = 1_000

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })
}

async function persistReasonWithTimeout(
  updateSession: Exclude<UpdateSessionFn, null | undefined>,
  reason: AuthPendingSignoutReason
): Promise<void> {
  try {
    await Promise.race([
      updateSession({ pending_signout_reason: reason }),
      wait(UPDATE_SESSION_TIMEOUT_MS),
    ])
  } catch {
    // Preserve logout UX even if the reason hint fails to persist.
  }
}

export async function signOutWithReason({
  updateSession,
  reason,
  delayMs = 0,
  callbackUrl = "/",
}: SignOutWithReasonOptions): Promise<void> {
  if (updateSession) {
    await persistReasonWithTimeout(updateSession, reason)
  }

  if (delayMs > 0) {
    await wait(delayMs)
  }

  await signOut({ callbackUrl })
}
