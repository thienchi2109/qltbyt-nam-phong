import { describe, expect, it } from "vitest"

import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"

type BootstrapSqlModule = {
  hasSafeBootstrapPsqlMetaCommands: (content: string) => boolean
}

const KEY = "a".repeat(64)

describe("database quality gate bootstrap SQL psql commands", () => {
  it("allows only the deterministic PostgreSQL 17 restrict envelope", async () => {
    const source = await loadDatabaseQualityGateModule<BootstrapSqlModule>("oracle-remote-sql")
    const content = `\\restrict ${KEY}\nCREATE TABLE public.bootstrap_contract (id bigint);\n\\unrestrict ${KEY}\n`

    expect(source.hasSafeBootstrapPsqlMetaCommands(content)).toBe(true)
  })

  it("rejects unpaired, mismatched, or unrelated psql commands", async () => {
    const source = await loadDatabaseQualityGateModule<BootstrapSqlModule>("oracle-remote-sql")

    expect(source.hasSafeBootstrapPsqlMetaCommands("SELECT 1;\n")).toBe(false)
    expect(source.hasSafeBootstrapPsqlMetaCommands(`\\restrict ${KEY}\nSELECT 1;\n`)).toBe(false)
    expect(
      source.hasSafeBootstrapPsqlMetaCommands(
        `\\restrict ${KEY}\nSELECT 1;\n\\unrestrict ${"b".repeat(64)}\n`
      )
    ).toBe(false)
    expect(
      source.hasSafeBootstrapPsqlMetaCommands(
        `\\restrict ${KEY}\n\\i /tmp/untrusted.sql\n\\unrestrict ${KEY}\n`
      )
    ).toBe(false)
  })
})
