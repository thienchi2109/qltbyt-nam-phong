import * as React from "react"
import type { ReactNode } from "react"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { authOptions } from "@/auth/config"
import { AppLayoutShell } from "@/app/(app)/_components/AppLayoutShell"

type AppLayoutProps = {
  children: ReactNode
}

export default async function AppLayout({ children }: AppLayoutProps) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/")
  }

  return <AppLayoutShell user={session.user}>{children}</AppLayoutShell>
}
