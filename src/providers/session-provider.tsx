"use client"

import React from "react"
import type { Session } from "next-auth"
import { SessionProvider, signOut } from "next-auth/react"

import { subscribeAuthSignout } from "@/lib/auth-signout-broadcast"

type Props = {
  children: React.ReactNode
  session?: Session | null
}

function AuthSignoutBroadcastListener(): null {
  React.useEffect(() => {
    return subscribeAuthSignout((payload) => {
      const signOutPromise = signOut({ callbackUrl: payload.callbackUrl })
      signOutPromise.catch((error: unknown) => {
        console.error("subscribeAuthSignout failed to sign out", {
          callbackUrl: payload.callbackUrl,
          error,
        })
      })
    })
  }, [])

  return null
}

export function NextAuthSessionProvider({ children, session }: Props) {
  return (
    <SessionProvider session={session} refetchInterval={60} refetchOnWindowFocus>
      <AuthSignoutBroadcastListener />
      {children}
    </SessionProvider>
  )
}
