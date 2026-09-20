#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { choice, score, TypeSafeClient } from "@typesafe-ai/sdk"

const enabled = process.env.JEV_MODE === "enabled"
const maxCalls = Number(process.env.JEV_MONTHLY_CALL_CAP || 4)
const usageFile = join(process.cwd(), ".jev-usage.json")

function usage() {
  if (!existsSync(usageFile)) return { month: new Date().toISOString().slice(0, 7), calls: 0 }
  try {
    const parsed = JSON.parse(readFileSync(usageFile, "utf8"))
    return parsed.month === new Date().toISOString().slice(0, 7)
      ? parsed
      : { month: new Date().toISOString().slice(0, 7), calls: 0 }
  } catch {
    return { month: new Date().toISOString().slice(0, 7), calls: 0 }
  }
}

if (!enabled) {
  console.log("Jev disabled. Set JEV_MODE=enabled to make one intentional review call.")
  process.exit(0)
}
if (!process.env.TYPESAFE_API_KEY)
  throw new Error("TYPESAFE_API_KEY is required when JEV_MODE=enabled")
const current = usage()
if (current.calls >= maxCalls) throw new Error(`Jev monthly cap reached (${maxCalls} calls).`)

const diff = execFileSync("git", ["diff", "--cached", "--", "*.sql", "supabase/migrations"], {
  encoding: "utf8",
}).slice(0, 18000)
if (!diff.trim()) {
  console.log("No staged SQL migration diff found; Jev was not called.")
  process.exit(0)
}

const client = new TypeSafeClient()
const response = await client.systemOne({
  state: { repository: "qltbyt-nam-phong", staged_sql_diff: diff },
  questions: {
    review_route: choice("Where should this migration review go next?", {
      normal_gate: "The existing static and baseline-forward gates are sufficient.",
      human_review: "A maintainer should inspect the migration beyond the normal gates.",
      block: "Do not proceed until the migration is clarified or corrected.",
    }),
    change_risk: score("How risky is the migration change?", [
      "Low: additive and easy to reverse",
      "Medium: affects behavior or permissions but is bounded",
      "High: destructive, security-sensitive, or difficult to reverse",
    ]),
  },
})
const result = { ...response.answers, calledAt: new Date().toISOString(), cap: maxCalls }
writeFileSync(
  usageFile,
  JSON.stringify({ month: current.month, calls: current.calls + 1 }, null, 2) + "\n"
)
console.log(JSON.stringify(result, null, 2))
