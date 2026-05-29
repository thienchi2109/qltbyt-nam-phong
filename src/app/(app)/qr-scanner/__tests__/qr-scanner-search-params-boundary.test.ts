import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const pageSource = readFileSync(
  join(process.cwd(), "src/app/(app)/qr-scanner/page.tsx"),
  "utf8",
)
const clientSource = readFileSync(
  join(process.cwd(), "src/app/(app)/qr-scanner/QRScannerPageClient.tsx"),
  "utf8",
)

describe("QR scanner search params boundary", () => {
  it("keeps URL search handling at the App Router page boundary", () => {
    expect(pageSource).not.toContain("\"use client\"")
    expect(pageSource).toContain("searchParams")
    expect(pageSource).toContain("<React.Suspense")
    expect(pageSource).toContain("<QRScannerPageClient autoStart={autoStart}")
  })

  it("keeps the QR scanner client component free of router search-param shims", () => {
    expect(clientSource).not.toContain("useSearchParams")
    expect(clientSource).not.toContain("useSyncExternalStore")
    expect(clientSource).not.toContain("window.history")
    expect(pageSource).not.toContain("useSearchParams")
  })
})
