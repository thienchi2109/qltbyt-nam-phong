"use client"

import React from "react"
import type { Session } from "next-auth"
import { SessionProvider, signOut, useSession } from "next-auth/react"

import { subscribeAuthSignout } from "@/lib/auth-signout-broadcast"
import {
  cleanupBrowserSubscription,
  discardLocalBrowserSubscription,
  readStoredBrowserSubscriptionOwnerIds,
} from "@/lib/web-push/browser-lifecycle"

type Props = {
  children: React.ReactNode
  session?: Session | null
}

function AuthSignoutBroadcastListener(): null {
  const { data: session, status } = useSession()
  const userId = session?.user?.id == null ? null : String(session.user.id)
  const authenticatedUserId = status === "authenticated" ? userId : null
  const previousUserIdRef = React.useRef<string | null>(authenticatedUserId)
  const restoredOwnerHandoffRef = React.useRef(false)

  React.useEffect(() => {
    const previousUserId = previousUserIdRef.current
    if (status === "loading") return
    if (authenticatedUserId && !restoredOwnerHandoffRef.current) {
      restoredOwnerHandoffRef.current = true
      for (const storedOwnerId of readStoredBrowserSubscriptionOwnerIds()) {
        if (storedOwnerId !== authenticatedUserId) {
          discardLocalBrowserSubscription(storedOwnerId).catch(() => undefined)
        }
      }
    }
    if (authenticatedUserId && previousUserId && previousUserId !== authenticatedUserId) {
      discardLocalBrowserSubscription(previousUserId).catch(() => undefined)
    }
    // Keep the last owner through signout so same-account relogin is not treated as a switch.
    if (authenticatedUserId) {
      previousUserIdRef.current = authenticatedUserId
    }
  }, [authenticatedUserId, status])

  React.useEffect(() => {
    return subscribeAuthSignout((payload) => {
      void (async () => {
        try {
          if (payload.reason === "forced_password_change" && authenticatedUserId) {
            await cleanupBrowserSubscription(authenticatedUserId)
          }
          await signOut({ callbackUrl: payload.callbackUrl })
        } catch (error: unknown) {
          console.error("subscribeAuthSignout failed to sign out", {
            callbackUrl: payload.callbackUrl,
            error,
          })
        }
      })()
    })
  }, [authenticatedUserId])

  return null
}

/** Web Push lifecycle entrypoint. */
export function NextAuthSessionProvider({ children, session }: Props) {
  return (
    <SessionProvider session={session} refetchInterval={60} refetchOnWindowFocus>
      <AuthSignoutBroadcastListener />
      {children}
    </SessionProvider>
  )
}
