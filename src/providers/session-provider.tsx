"use client"

import React from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { Session } from "next-auth"
import { SessionProvider, signOut, useSession } from "next-auth/react"

import { subscribeAuthSignout } from "@/lib/auth-signout-broadcast"
import {
  hasBrowserPushConsent,
  readBrowserPushConsent,
  setBrowserPushConsent,
} from "@/lib/web-push/browser-consent"
import {
  cleanupBrowserSubscription,
  discardLocalBrowserSubscription,
  readBrowserSubscriptionRecord,
  readStoredBrowserSubscriptionOwnerIds,
} from "@/lib/web-push/browser-lifecycle"
import {
  readPublicKey,
  registerBrowserSubscription,
  VAPID_VERSION_STORAGE_KEY,
} from "@/lib/web-push/browser-registration"

type Props = {
  children: React.ReactNode
  session?: Session | null
}

function AuthSignoutBroadcastListener(): null {
  const { data: session, status } = useSession()
  const queryClient = useQueryClient()
  const userId = session?.user?.id == null ? null : String(session.user.id)
  const authenticatedUserId = status === "authenticated" ? userId : null
  const previousUserIdRef = React.useRef<string | null>(authenticatedUserId)
  const restoredOwnerHandoffRef = React.useRef(false)
  const restoreRef = React.useRef<{
    ownerId: string | null
    controller: AbortController
    promise: Promise<void>
  } | null>(null)

  React.useEffect(() => {
    const previousUserId = previousUserIdRef.current
    if (status === "loading") return
    const previousRestore = restoreRef.current
    previousRestore?.controller.abort()
    const controller = new AbortController()
    const cleanups: Promise<void>[] = []
    if (authenticatedUserId && !restoredOwnerHandoffRef.current) {
      restoredOwnerHandoffRef.current = true
      for (const storedOwnerId of readStoredBrowserSubscriptionOwnerIds()) {
        if (storedOwnerId !== authenticatedUserId) {
          cleanups.push(discardLocalBrowserSubscription(storedOwnerId))
        }
      }
    }
    if (authenticatedUserId && previousUserId && previousUserId !== authenticatedUserId) {
      cleanups.push(discardLocalBrowserSubscription(previousUserId))
    }
    // Keep the last owner through signout so same-account relogin is not treated as a switch.
    if (authenticatedUserId) {
      previousUserIdRef.current = authenticatedUserId
    }

    if (
      authenticatedUserId &&
      readBrowserPushConsent(authenticatedUserId) === null &&
      readBrowserSubscriptionRecord(authenticatedUserId)?.status === "enabled"
    ) {
      setBrowserPushConsent(authenticatedUserId, true)
    }

    const ownerId = authenticatedUserId
    const shouldRestore =
      Boolean(ownerId) &&
      hasBrowserPushConsent(ownerId ?? "") &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    const promise = (async () => {
      await previousRestore?.promise.catch(() => undefined)
      await Promise.all(cleanups)
      if (controller.signal.aborted) return
      if (!shouldRestore || !ownerId) return

      const artifact = await readPublicKey()
      if (
        controller.signal.aborted ||
        !hasBrowserPushConsent(ownerId) ||
        !artifact.registration_enabled ||
        !artifact.vapid
      ) {
        return
      }
      const storedVersion = window.localStorage.getItem(VAPID_VERSION_STORAGE_KEY)
      await registerBrowserSubscription(
        ownerId,
        artifact.vapid,
        storedVersion !== null && storedVersion !== artifact.vapid.version,
        controller.signal,
        undefined,
        true
      )
    })()
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted && ownerId) {
          void queryClient.invalidateQueries({ queryKey: ["web-push", "public-key", ownerId] })
        }
        if (restoreRef.current?.controller === controller) restoreRef.current = null
      })
    restoreRef.current = { ownerId, controller, promise }
    return () => controller.abort()
  }, [authenticatedUserId, queryClient, status])

  React.useEffect(() => {
    return subscribeAuthSignout((payload) => {
      void (async () => {
        try {
          if (payload.reason === "forced_password_change" && authenticatedUserId) {
            setBrowserPushConsent(authenticatedUserId, false)
            const activeRestore = restoreRef.current
            if (activeRestore?.ownerId === authenticatedUserId) {
              activeRestore.controller.abort()
              await activeRestore.promise
            }
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
