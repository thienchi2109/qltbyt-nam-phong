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

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })
}

export async function signOutWithReason({
  updateSession,
  reason,
  delayMs = 0,
  callbackUrl = "/",
}: SignOutWithReasonOptions): Promise<void> {
  if (updateSession) {
    try {
      await updateSession({ pending_signout_reason: reason })
    } catch {
      // Preserve logout UX even if the reason hint fails to persist.
    }
  }

  if (delayMs > 0) {
    await wait(delayMs)
  }

  await signOut({ callbackUrl })
}
