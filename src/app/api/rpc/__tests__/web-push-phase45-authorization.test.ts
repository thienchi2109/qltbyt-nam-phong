import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  functionBlocks,
  type SqlFunctionBlock,
} from "../../../../../scripts/db-quality-gate/static-policy-objects"
import { failClosedJwtAuthorizedFunctions } from "../../../../../scripts/db-quality-gate/static-sql-authorization"
import { safeInternalFunctionTargets } from "../../../../../scripts/db-quality-gate/static-policy-authorization"

const read = (file: string) => readFileSync(path.resolve("supabase/migrations", file), "utf8")
const configFile = "20260913020000_web_push_recipient_config_phase45.sql"

describe("Phase45 authorization proof", () => {
  it("proves config authorization before any request processing through the existing helper", () => {
    const latest = new Map<string, { content: string; functionBlock: SqlFunctionBlock }>()
    for (const file of [
      "20260911030000_web_push_schema.sql",
      "20260911030100_web_push_recipients.sql",
      "20260911030200_web_push_subscriptions.sql",
      configFile,
    ]) {
      const content = read(file)
      for (const functionBlock of functionBlocks(content))
        latest.set(functionBlock.identity, { content, functionBlock })
    }
    const definitions = [...latest.values()]
    const targets = safeInternalFunctionTargets(definitions)
    const functions = functionBlocks(read(configFile))
    const authorized = failClosedJwtAuthorizedFunctions(
      functions,
      (fn) => targets.has(fn.identity),
      undefined,
      definitions.map((entry) => entry.functionBlock)
    )
    for (const name of [
      "web_push_recipient_config_set",
      "web_push_recipient_config_set_with_self_action",
    ]) {
      const fn = functions.find((item) => item.name === "public." + name)!
      expect(authorized.has(fn), name).toBe(true)
      const unguarded = {
        ...fn,
        body: fn.body.replace("PERFORM public.web_push_config_authorize(p_don_vi);", ""),
      }
      expect(
        failClosedJwtAuthorizedFunctions(
          [unguarded],
          (item) => targets.has(item.identity),
          undefined,
          definitions.map((entry) => entry.functionBlock)
        ).has(unguarded),
        name + " without guard"
      ).toBe(false)
    }
  })

  it("keeps repair creation authorization byte-identical to the Phase3 source", () => {
    const body = (file: string) =>
      functionBlocks(read(file))
        .find((fn) => fn.name === "public.repair_request_create")!
        .body.split("  v_snapshot_status :=")[0]
    expect(body("20260913020100_web_push_enqueue_recipient_eligibility.sql")).toBe(
      body("20260911030300_web_push_atomic_enqueue.sql")
    )
  })
})
