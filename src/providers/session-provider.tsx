"use client"

import { SessionProvider } from "next-auth/react"
import React from "react"

type Props = {
  children: React.ReactNode
}

export function NextAuthSessionProvider({ children }: Props) {
  return <SessionProvider>{children}</SessionProvider>
}
