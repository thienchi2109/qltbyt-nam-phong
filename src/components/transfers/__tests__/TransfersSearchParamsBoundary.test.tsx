import { describe, expect, it } from "vitest"
import * as fs from "fs"
import * as path from "path"

const pageSource = fs.readFileSync(
  path.resolve(__dirname, "../../../app/(app)/transfers/page.tsx"),
  "utf-8",
)

describe("Transfers page search params boundary", () => {
  it("keeps the transfers page content behind a suspense boundary", () => {
    expect(pageSource).toContain("<React.Suspense")
    expect(pageSource).toContain("<TransfersPageContent user={session.user} />")
  })
})
