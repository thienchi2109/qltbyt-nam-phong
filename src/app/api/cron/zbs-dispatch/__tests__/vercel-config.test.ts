import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

describe("Vercel cron configuration for ZBS dispatch", () => {
  it("schedules the ZBS dispatch route every five minutes", () => {
    const configPath = path.resolve(process.cwd(), "vercel.json")
    expect(fs.existsSync(configPath)).toBe(true)

    const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
      crons?: Array<{ path?: string; schedule?: string }>
    }

    expect(config.crons).toContainEqual({
      path: "/api/cron/zbs-dispatch",
      schedule: "*/5 * * * *",
    })
  })
})
