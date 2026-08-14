import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const REPO_ROOT = path.resolve(process.cwd())
const CHANGE_DIR = path.join(
  REPO_ROOT,
  "openspec/changes/archive/2026-08-14-revise-technical-configuration-baseline-hierarchy"
)
const ACTIVE_CHANGE_DIR = path.join(
  REPO_ROOT,
  "openspec/changes/revise-technical-configuration-baseline-hierarchy"
)
const PARENT_SPEC_PATH = path.join(
  REPO_ROOT,
  "openspec/changes/add-technical-configuration-comparison/specs/technical-configuration-comparison/spec.md"
)
const SMOKE_PATH = path.join(
  REPO_ROOT,
  "supabase/tests/technical_configuration_baseline_hierarchy_p6c_live_acceptance.sql"
)
const REPORT_PATH = path.join(CHANGE_DIR, "p6c-live-acceptance.md")
const ARCHIVED_SPEC_PATH = path.join(CHANGE_DIR, "specs/technical-configuration-comparison/spec.md")
const HIERARCHY_REQUIREMENT_NAMES = [
  "Structured three-level baseline authoring",
  "Standard baseline Excel template",
  "Hierarchical aggregate evaluation status",
  "Hierarchy-aware technical configuration surfaces",
] as const

function readIfExists(filePath: string): string {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : ""
}

function readRequirementBlocks(source: string): Array<{ name: string; block: string }> {
  const matches = [...source.matchAll(/^### Requirement: (.+)$/gm)]

  return matches.map((match, index) => {
    const start = match.index ?? 0
    const end = matches[index + 1]?.index ?? source.length

    return {
      name: match[1],
      block: source
        .slice(start, end)
        .replace(/^## (?:ADDED|MODIFIED|REMOVED|RENAMED) Requirements\s*$/gm, "")
        .trim(),
    }
  })
}

const smokeSource = readIfExists(SMOKE_PATH)
const reportSource = readIfExists(REPORT_PATH)
const archivedSpecSource = readIfExists(ARCHIVED_SPEC_PATH)
const parentSpecSource = readIfExists(PARENT_SPEC_PATH)
const residueMarker = "-- P6C_POST_ROLLBACK_FIXTURE_CHECK"
const residueBlock = smokeSource.slice(smokeSource.indexOf(residueMarker))
const sourceRestorationMarker = "-- P6C_POST_ROLLBACK_SOURCE_RESTORATION_CHECK"
const sourceRestorationBlock = smokeSource.slice(
  smokeSource.indexOf(sourceRestorationMarker),
  smokeSource.indexOf(residueMarker)
)

describe("P6C hierarchy live acceptance closeout", () => {
  it("ships an exception-safe import, copy, lock, and rollback contract", () => {
    expect(existsSync(SMOKE_PATH)).toBe(true)
    expect(smokeSource).not.toMatch(/\bCOMMIT;/)
    expect(smokeSource).not.toMatch(
      /\b(?:CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b|COMMENT\s+ON|SECURITY\s+LABEL/i
    )
    expect(smokeSource).toContain("'request.jwt.claims'")
    expect(smokeSource).toContain("technical_configuration_baseline_import_preview_v2")
    expect(smokeSource).toContain("technical_configuration_baseline_import_apply_v2")
    expect(smokeSource).toContain("technical_configuration_baseline_copy")
    expect(smokeSource).toContain("technical_configuration_baseline_lock")
    expect(smokeSource).toContain("P6C_ROLLBACK_SENTINEL")
    expect(smokeSource).toContain("WHEN SQLSTATE 'P6C01'")
    expect(smokeSource).toContain("WHEN OTHERS")
    expect(smokeSource).toContain("v_stage TEXT := 'preflight'")
    expect(smokeSource).toContain("v_failure_stage TEXT")
    expect(smokeSource).toContain("v_failure_detail TEXT")
    expect(smokeSource).toContain("v_failure_context TEXT")
    expect(smokeSource).toContain("GET STACKED DIAGNOSTICS")
    expect(smokeSource).toContain("v_failure_detail = PG_EXCEPTION_DETAIL")
    expect(smokeSource).toContain("v_failure_context = PG_EXCEPTION_CONTEXT")
    expect(smokeSource).toContain("COALESCE(NULLIF(v_failure_detail, ''), '<none>')")
    expect(smokeSource).toContain("COALESCE(NULLIF(v_failure_context, ''), '<none>')")
    expect(smokeSource).toContain("v_stage := 'apply'")
    expect(smokeSource).toContain("v_stage := 'lock'")
    expect(smokeSource).toContain("v_source_snapshot_before JSONB")
    expect(smokeSource).toContain("v_source_lock_snapshot JSONB")
    expect(sourceRestorationBlock).toContain(sourceRestorationMarker)
    expect(sourceRestorationBlock).toContain(
      "public._technical_configuration_baseline_snapshot(v_source_version_id)"
    )
    expect(sourceRestorationBlock).toContain("v_source_snapshot_before")
    const applyIndex = smokeSource.indexOf(
      "SELECT public.technical_configuration_baseline_import_apply_v2"
    )
    const sourceLockIndex = smokeSource.indexOf(
      "SELECT public.technical_configuration_baseline_lock(\n      v_source_version_id"
    )
    const copyIndex = smokeSource.indexOf("SELECT public.technical_configuration_baseline_copy")
    expect(applyIndex).toBeGreaterThanOrEqual(0)
    expect(sourceLockIndex).toBeGreaterThan(applyIndex)
    expect(copyIndex).toBeGreaterThan(sourceLockIndex)
    expect(smokeSource).toMatch(
      /technical_configuration_baseline_lock\(\s*v_copy_version_id,\s*v_copy_revision\s*\)/
    )
    const copyContractBlock = smokeSource.slice(
      smokeSource.indexOf("IF v_copy_version_id IS NULL"),
      smokeSource.indexOf("v_stage := 'lock'")
    )
    expect(
      copyContractBlock.match(
        /FROM public\.technical_configuration_baseline_criteria criterion_row/g
      )
    ).toHaveLength(2)
    expect(
      copyContractBlock.match(/WHERE criterion_row\.baseline_version_id = v_copy_version_id/g)
    ).toHaveLength(2)
    expect(copyContractBlock).toContain("criterion_row.source_criterion_id = v_source_criterion_id")
    expect(copyContractBlock.match(/\) IS DISTINCT FROM 1::BIGINT/g)).toHaveLength(3)
    expect(residueBlock).toContain(residueMarker)
    expect(residueBlock).toContain("FROM public.technical_configuration_baseline_versions")
    expect(residueBlock).toContain("FROM public.technical_configuration_baseline_groups")
    expect(residueBlock).toContain("FROM public.technical_configuration_baseline_subgroups")
    expect(residueBlock).toContain("FROM public.technical_configuration_baseline_criteria")
    expect(residueBlock).toContain("FROM public.technical_configuration_baseline_documents")
    expect(residueBlock).toContain("FROM public.technical_configuration_baseline_citations")
    expect(residueBlock).toContain("version_row.id = v_copy_version_id")
    expect(residueBlock.match(/baseline_version_id = v_copy_version_id/g)).toHaveLength(5)
    expect(smokeSource).toMatch(
      /v_source_lock_snapshot->'groups'\s+IS DISTINCT FROM\s+v_apply_snapshot->'groups'/
    )
    expect(smokeSource).toMatch(
      /v_lock_snapshot->'groups'\s+IS DISTINCT FROM\s+v_copy_snapshot_before_lock->'groups'/
    )
  })

  it("records the authorization, acceptance, recovery, and review evidence", () => {
    expect(existsSync(REPORT_PATH)).toBe(true)
    expect(existsSync(ACTIVE_CHANGE_DIR)).toBe(false)
    expect(reportSource).toContain("Issue #896")
    expect(reportSource).toContain("4f2be3bd")
    expect(reportSource).toContain("## Live Write Authorization")
    expect(reportSource).toContain("## Live Migration And RPC State")
    expect(reportSource).toContain("## Security Advisors")
    expect(reportSource).toContain("## Performance Advisors")
    expect(reportSource).toContain("## XLSX v2 Production Acceptance")
    expect(reportSource).toContain("## Protected P6B Surfaces")
    expect(reportSource).toContain("HeroActionDropdown.tsx")
    expect(reportSource).toContain("## Browser Test Exception")
    expect(reportSource).toContain("## Rollback And Recovery")
    expect(reportSource).toContain("never drop populated hierarchy data")
    expect(reportSource).toContain("## Independent Review")
    expect(reportSource).toContain("## Merge And Deployment Blockers")
  })

  it("preserves the archived hierarchy deltas in the active parent change", () => {
    expect(existsSync(ARCHIVED_SPEC_PATH)).toBe(true)
    expect(existsSync(PARENT_SPEC_PATH)).toBe(true)
    const archivedBlocks = readRequirementBlocks(archivedSpecSource)
    const parentBlocks = readRequirementBlocks(parentSpecSource)
    const parentNames = parentBlocks.map(({ name }) => name)

    expect(parentNames).not.toContain("Flexible two-level baseline authoring")
    expect(new Set(parentNames).size).toBe(parentNames.length)
    expect(
      parentNames.filter((name) =>
        HIERARCHY_REQUIREMENT_NAMES.includes(name as (typeof HIERARCHY_REQUIREMENT_NAMES)[number])
      )
    ).toEqual(HIERARCHY_REQUIREMENT_NAMES)

    for (const requirementName of HIERARCHY_REQUIREMENT_NAMES) {
      expect(parentBlocks.find(({ name }) => name === requirementName)?.block).toBe(
        archivedBlocks.find(({ name }) => name === requirementName)?.block
      )
    }

    expect(
      archivedBlocks.filter(({ name }) =>
        HIERARCHY_REQUIREMENT_NAMES.includes(name as (typeof HIERARCHY_REQUIREMENT_NAMES)[number])
      )
    ).toHaveLength(HIERARCHY_REQUIREMENT_NAMES.length)
    expect(
      parentBlocks.filter(({ name }) =>
        HIERARCHY_REQUIREMENT_NAMES.includes(name as (typeof HIERARCHY_REQUIREMENT_NAMES)[number])
      )
    ).toHaveLength(HIERARCHY_REQUIREMENT_NAMES.length)
    expect(archivedBlocks.map(({ name }) => name)).toEqual(
      expect.arrayContaining(HIERARCHY_REQUIREMENT_NAMES)
    )
  })
})
