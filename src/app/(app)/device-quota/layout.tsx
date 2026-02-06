import type { Metadata } from "next"
import { DeviceQuotaSubNav } from "./_components/DeviceQuotaSubNav"

export const metadata: Metadata = {
  title: "Định mức thiết bị",
  description: "Quản lý định mức thiết bị y tế theo quyết định của Bộ Y tế",
}

export default function DeviceQuotaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <DeviceQuotaSubNav />
      {children}
    </>
  )
}
