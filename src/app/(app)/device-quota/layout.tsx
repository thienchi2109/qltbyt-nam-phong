import * as React from "react"
import type { ReactNode } from "react"
import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { authOptions } from "@/auth/config"
import { canAccessDeviceQuotaModule } from "@/lib/rbac"
import { DeviceQuotaSubNav } from "./_components/DeviceQuotaSubNav"

export const metadata: Metadata = {
  title: "Định mức thiết bị",
  description: "Quản lý định mức thiết bị y tế theo quyết định của Bộ Y tế",
}

export default async function DeviceQuotaLayout({
  children,
}: {
  children: ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/")
  }

  if (!canAccessDeviceQuotaModule(session.user.role)) {
    redirect("/dashboard")
  }

  return (
    <>
      <DeviceQuotaSubNav />
      {children}
    </>
  )
}
