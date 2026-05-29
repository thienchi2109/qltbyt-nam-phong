import * as React from "react"
import QRScannerPageClient from "./QRScannerPageClient"

type QRScannerPageProps = {
  searchParams?: Promise<{
    autoStart?: string | string[]
  }>
}

function readFirstSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]
  return value
}

/** Renders the QR scanner through the App Router searchParams boundary. */
export default async function QRScannerPage({ searchParams }: QRScannerPageProps) {
  const resolvedSearchParams = await searchParams
  const autoStart = readFirstSearchParam(resolvedSearchParams?.autoStart) === "1"

  return (
    <React.Suspense fallback={null}>
      <QRScannerPageClient autoStart={autoStart} />
    </React.Suspense>
  )
}
