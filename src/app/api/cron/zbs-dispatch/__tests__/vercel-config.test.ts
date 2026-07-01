import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

describe("Vercel cron configuration for ZBS dispatch", () => {
  it("does not schedule ZBS dispatch through Vercel Cron on Hobby deployments", () => {
    const configPath = path.resolve(process.cwd(), "vercel.json")
    expect(fs.existsSync(configPath)).toBe(true)

    const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
      crons?: Array<{ path?: string; schedule?: string }>
    }

    expect(config.crons ?? []).not.toContainEqual(
      expect.objectContaining({
        path: "/api/cron/zbs-dispatch",
      })
    )
  })
})
