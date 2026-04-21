"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import type { Session } from "next-auth"

type AuthenticatedPageBoundaryProps = {
  fallback: React.ReactNode
  children: (user: Session["user"]) => React.ReactNode
}

export function AuthenticatedPageBoundary({
  fallback,
  children,
}: AuthenticatedPageBoundaryProps) {
  const { data: session, status } = useSession()

  if (status !== "authenticated" || !session?.user) {
    return <>{fallback}</>
  }

  return <>{children(session.user)}</>
}
