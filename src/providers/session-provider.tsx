"use client"

import type { Session } from "next-auth"
import { SessionProvider, signOut } from "next-auth/react"
import React from "react"

import { subscribeAuthSignout } from "@/lib/auth-signout-broadcast"

type Props = {
  children: React.ReactNode
  session?: Session | null
}

function AuthSignoutBroadcastListener() {
  React.useEffect(() => {
    return subscribeAuthSignout((payload) => {
      void signOut({ callbackUrl: payload.callbackUrl })
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
