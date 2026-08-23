import * as React from "react"
import type { ReactNode } from "react"
import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { authOptions } from "@/auth/config"
import { DeviceQuotaSubNav } from "./_components/DeviceQuotaSubNav"

/** Metadata shared by the device-quota route family. */
export const metadata: Metadata = {
  title: "Định mức thiết bị",
  description: "Quản lý định mức thiết bị y tế theo quyết định của Bộ Y tế",
}

/** Preserves the authenticated layout boundary for device-quota pages. */
export default async function DeviceQuotaLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/")
  }

  return (
    <>
      <DeviceQuotaSubNav />
      {children}
    </>
  )
}
