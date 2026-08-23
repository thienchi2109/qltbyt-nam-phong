import { describe, expect, it } from "vitest"

import {
  evaluateLiveMigrationState,
  parseLiveMigrationObservation,
} from "../db-quality-gate/pre-live-live-state"
import type { BaselineState } from "../db-quality-gate/baseline-state"
import type { AppliedMigrationLock } from "../db-quality-gate/registries"

const CREATED_AT = "2026-08-23T07:30:00.000Z"
const LIVE_VERSION = "20260819062043"

const baselineState: BaselineState = {
  checkedAt: CREATED_AT,
  confirmedMigrations: [
    {
      liveName: "candidate",
      liveVersion: LIVE_VERSION,
      path: `supabase/migrations/${LIVE_VERSION}_candidate.sql`,
      sha256: "a".repeat(64),
    },
  ],
  generation: "phase5-baseline",
  healthy: true,
  migrationHighWater: LIVE_VERSION,
  schemaVersion: 1,
  sourceCommit: "a".repeat(40),
}

const appliedLock: AppliedMigrationLock = {
  applied: [
    {
      liveName: "candidate",
      liveVersion: LIVE_VERSION,
      path: `supabase/migrations/${LIVE_VERSION}_candidate.sql`,
      readBackDigest: "3".repeat(64),
      readBackEvidenceId: "oracle:phase-6-read-back/read-back.json",
      sha256: "a".repeat(64),
    },
  ],
  cutover: {
    commit: "b".repeat(40),
    legacyInventorySha256: "c".repeat(64),
    migrationRoot: "supabase/migrations",
  },
  legacy: [],
  schemaVersion: 1,
}

function observation(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    capturedAt: "2026-08-23T07:29:00.000Z",
    migrations: [{ name: "candidate", version: LIVE_VERSION }],
    projectRef: "cdthersvldpnlbvpufrr",
    schemaVersion: 1,
    source: "supabase-mcp",
    ...overrides,
  }
}

describe("database quality gate pre-live live state", () => {
  it("parses and hashes a fresh read-only observation deterministically", () => {
    const parsed = parseLiveMigrationObservation(observation(), CREATED_AT)

    expect(parsed).toMatchObject({
      capturedAt: "2026-08-23T07:29:00.000Z",
      migrations: [{ name: "candidate", version: LIVE_VERSION }],
      projectRef: "cdthersvldpnlbvpufrr",
    })
    expect(parsed?.inputHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it.each([
    ["wrong project", { projectRef: "another-project" }],
    ["stale capture", { capturedAt: "2026-08-23T07:14:59.999Z" }],
    ["future capture", { capturedAt: "2026-08-23T07:32:00.001Z" }],
    [
      "duplicate versions",
      {
        migrations: [
          { name: "candidate", version: LIVE_VERSION },
          { name: "duplicate", version: LIVE_VERSION },
        ],
      },
    ],
    [
      "unordered versions",
      {
        migrations: [
          { name: "later", version: "20260820000000" },
          { name: "candidate", version: LIVE_VERSION },
        ],
      },
    ],
    ["malformed migration", { migrations: [{ name: "", version: "20260819" }] }],
    ["unknown property", { permissionGranted: true }],
  ])("rejects %s evidence", (_name, overrides) => {
    expect(parseLiveMigrationObservation(observation(overrides), CREATED_AT)).toBeUndefined()
  })

  it("marks live high-water ahead of the published baseline as blocking", () => {
    const parsed = parseLiveMigrationObservation(
      observation({
        migrations: [
          { name: "candidate", version: LIVE_VERSION },
          { name: "newer", version: "20260820000000" },
        ],
      }),
      CREATED_AT
    )

    const result = evaluateLiveMigrationState({
      appliedLock,
      baselineState,
      observation: parsed,
    })

    expect(result).toMatchObject({
      liveMigrationHighWater: "20260820000000",
      status: "baseline-behind",
    })
  })

  it("rejects an applied-lock entry missing from the live observation", () => {
    const parsed = parseLiveMigrationObservation(observation({ migrations: [] }), CREATED_AT)

    expect(
      evaluateLiveMigrationState({
        appliedLock,
        baselineState,
        observation: parsed,
      })
    ).toMatchObject({ status: "invalid" })
  })

  it("rejects incomplete applied-lock coverage of confirmed post-cutover history", () => {
    const earlierVersion = "20260818062043"
    const parsed = parseLiveMigrationObservation(
      observation({
        migrations: [
          { name: "earlier", version: earlierVersion },
          { name: "candidate", version: LIVE_VERSION },
        ],
      }),
      CREATED_AT
    )
    const state: BaselineState = {
      ...baselineState,
      confirmedMigrations: [
        {
          liveName: "earlier",
          liveVersion: earlierVersion,
          path: `supabase/migrations/${earlierVersion}_earlier.sql`,
          sha256: "b".repeat(64),
        },
        ...baselineState.confirmedMigrations,
      ],
    }

    expect(
      evaluateLiveMigrationState({
        appliedLock,
        baselineState: state,
        observation: parsed,
      })
    ).toMatchObject({ status: "invalid" })
  })
})
