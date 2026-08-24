import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  decodeTechnicalConfigurationBaselineDraftWireResponse,
  decodeTechnicalConfigurationBaselineVersionsListWireResponse,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-decoders"

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations")
const TASKS_PATH = path.resolve(
  process.cwd(),
  "openspec/changes/archive/2026-08-14-revise-technical-configuration-baseline-hierarchy/tasks.md"
)
const PHASE_GATE_PATH = path.resolve(
  process.cwd(),
  "supabase/tests/technical_configuration_baseline_hierarchy_snapshots_phase_gate.sql"
)
const P1C_MIGRATION_FILE = "20260807134535_technical_configuration_baseline_hierarchy_reads.sql"
const P1D_MIGRATION_SUFFIX = "_technical_configuration_baseline_hierarchy_snapshots.sql"

const migrationFiles = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
const p1dMigrationFiles = migrationFiles.filter((file) => file.endsWith(P1D_MIGRATION_SUFFIX))
const p1dMigrationFile = p1dMigrationFiles[0] ?? ""
const p1dMigrationSource = p1dMigrationFile
  ? readFileSync(path.join(MIGRATIONS_DIR, p1dMigrationFile), "utf8")
  : ""
const allMigrationSource = migrationFiles
  .map((file) => readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"))
  .join("\n")
const phaseGateSource = existsSync(PHASE_GATE_PATH) ? readFileSync(PHASE_GATE_PATH, "utf8") : ""

function getFunctionBlock(migrationSource: string, functionName: string): string {
  const start = migrationSource.lastIndexOf(`CREATE OR REPLACE FUNCTION public.${functionName}`)
  expect(start).toBeGreaterThanOrEqual(0)

  const end = migrationSource.indexOf("\n$$;", start)
  expect(end).toBeGreaterThan(start)
  return migrationSource.slice(start, end + 4)
}

function hierarchySnapshot(
  status: "draft" | "locked",
  sourceVersionId = "source-version"
): Record<string, unknown> {
  const versionId = "copied-version"
  const groupId = "copied-group"
  const subgroupId = "copied-subgroup"
  const timestamp = "2026-08-07T00:00:00.000Z"

  return {
    id: versionId,
    dossier_id: "dossier-1",
    version_number: 2,
    status,
    source_baseline_version_id: sourceVersionId,
    source_version_number: 1,
    next_criterion_number: 3,
    revision: status === "draft" ? 1 : 2,
    locked_at: status === "locked" ? timestamp : null,
    locked_by: status === "locked" ? 1 : null,
    created_at: timestamp,
    created_by: 1,
    updated_at: timestamp,
    updated_by: 1,
    groups: [
      {
        id: groupId,
        baseline_version_id: versionId,
        name: "Main section",
        sort_order: 1,
        created_at: timestamp,
        created_by: 1,
        updated_at: timestamp,
        updated_by: 1,
        criteria: [
          {
            id: "copied-direct-criterion",
            baseline_version_id: versionId,
            group_id: groupId,
            subgroup_id: null,
            criterion_code: "TC-0001",
            title: null,
            requirement_text: "Direct criterion",
            sort_order: 1,
            source_criterion_id: "source-direct-criterion",
            created_at: timestamp,
            created_by: 1,
            updated_at: timestamp,
            updated_by: 1,
          },
        ],
        subgroups: [
          {
            id: subgroupId,
            baseline_version_id: versionId,
            group_id: groupId,
            name: "Subgroup",
            sort_order: 1,
            created_at: timestamp,
            created_by: 1,
            updated_at: timestamp,
            updated_by: 1,
            criteria: [
              {
                id: "copied-subgroup-criterion",
                baseline_version_id: versionId,
                group_id: groupId,
                subgroup_id: subgroupId,
                criterion_code: "TC-0002",
                title: null,
                requirement_text: "Subgroup criterion",
                sort_order: 2,
                source_criterion_id: "source-subgroup-criterion",
                created_at: timestamp,
                created_by: 1,
                updated_at: timestamp,
                updated_by: 1,
              },
            ],
          },
        ],
      },
    ],
  }
}

describe("technical configuration baseline P1D hierarchy snapshot migration", () => {
  it("ships one migration after the P1C hierarchy read producers", () => {
    expect(p1dMigrationFiles).toHaveLength(1)
    expect(p1dMigrationFile > P1C_MIGRATION_FILE).toBe(true)
  })

  const describeP1DMigration = p1dMigrationFiles.length === 1 ? describe : describe.skip

  describeP1DMigration("hierarchy copy and lock contracts", () => {
    it("changes only the internal aggregate copy helper", () => {
      const redefinedFunctions = [
        ...p1dMigrationSource.matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z0-9_]+)\s*\(/g),
      ].map((match) => match[1])

      expect(redefinedFunctions).toEqual(["_technical_configuration_baseline_copy_p4"])
      expect(p1dMigrationSource).not.toContain("CREATE TABLE")
      expect(p1dMigrationSource).not.toContain("ALTER TABLE")
      expect(p1dMigrationSource).not.toContain("GRANT EXECUTE")
      expect(p1dMigrationSource).not.toContain("technical_configuration_baseline_subgroup_create")
      expect(p1dMigrationSource).not.toContain("technical_configuration_baseline_subgroup_update")
      expect(p1dMigrationSource).not.toContain("technical_configuration_baseline_subgroup_delete")
    })

    it("copies groups, subgroups, and criteria through one-to-one identity maps", () => {
      const block = getFunctionBlock(
        p1dMigrationSource,
        "_technical_configuration_baseline_copy_p4"
      )

      expect(block).toContain("CREATE TEMP TABLE technical_configuration_baseline_group_copy_map")
      expect(block).toContain("source_group_id UUID PRIMARY KEY")
      expect(block).toContain("target_group_id UUID NOT NULL UNIQUE")
      expect(block).toContain(
        "CREATE TEMP TABLE technical_configuration_baseline_subgroup_copy_map"
      )
      expect(block).toContain("source_subgroup_id UUID PRIMARY KEY")
      expect(block).toContain("target_subgroup_id UUID NOT NULL UNIQUE")
      expect(block).toContain("INSERT INTO public.technical_configuration_baseline_subgroups")
      expect(block).toContain("group_map.target_group_id")
      expect(block).toContain("s.name")
      expect(block).toContain("s.sort_order")
      expect(block).toMatch(
        /INSERT INTO public\.technical_configuration_baseline_criteria \([\s\S]*subgroup_id,[\s\S]*source_criterion_id/
      )
      expect(block).toContain("subgroup_map.target_subgroup_id")
      expect(block).toContain(
        "LEFT JOIN pg_temp.technical_configuration_baseline_subgroup_copy_map"
      )
      expect(block).toContain("c.criterion_code")
      expect(block).toContain("c.sort_order")
      expect(block).toContain("c.id")
      expect(block).toContain("gen_random_uuid()")
    })

    it("preserves the existing copy lifecycle, revision guards, and wrapper composition", () => {
      const block = getFunctionBlock(
        p1dMigrationSource,
        "_technical_configuration_baseline_copy_p4"
      )
      const copyWrapper = getFunctionBlock(
        allMigrationSource,
        "technical_configuration_baseline_copy"
      )

      expect(block).toContain("RETURNS JSONB")
      expect(block).toContain("SECURITY DEFINER")
      expect(block).toContain("SET search_path = public, pg_temp")
      expect(block).toContain("public._technical_configuration_require_global_user()")
      expect(block).toContain("v_source_status <> 'locked'")
      expect(block).toContain("v_source_revision IS DISTINCT FROM p_expected_revision")
      expect(block).toContain("draft_already_exists")
      expect(block).toMatch(/COALESCE\(MAX\(v\.version_number\), 0\) \+ 1/)
      expect(block).toContain("source_baseline_version_id")
      expect(block).toContain("v_next_criterion_number")
      expect(block).toMatch(/revision = revision \+ 1/)
      expect(block).toContain("public._technical_configuration_baseline_snapshot(v_new_version_id)")
      expect(copyWrapper).toContain("public._technical_configuration_baseline_copy_p7a1(")
      expect(allMigrationSource).toContain("RENAME TO _technical_configuration_baseline_copy_p7a1")
      expect(allMigrationSource).toContain("public._technical_configuration_baseline_copy_p4(")
    })

    it("keeps lock immutable and returns the canonical hierarchy snapshot", () => {
      const lockBlock = getFunctionBlock(
        allMigrationSource,
        "technical_configuration_baseline_lock"
      )
      const snapshotBlock = getFunctionBlock(
        allMigrationSource,
        "_technical_configuration_baseline_snapshot"
      )

      expect(lockBlock).toContain("status = 'locked'")
      expect(lockBlock).toContain("revision = revision + 1")
      expect(lockBlock).toContain(
        "public._technical_configuration_baseline_snapshot(p_baseline_version_id)"
      )
      expect(lockBlock).not.toMatch(
        /(INSERT INTO|UPDATE|DELETE FROM) public\.technical_configuration_baseline_(groups|subgroups|criteria)/
      )
      expect(snapshotBlock).toContain("direct_criteria_by_group")
      expect(snapshotBlock).toContain("criteria_by_subgroup")
      expect(snapshotBlock).toContain("subgroups_by_group")
      expect(snapshotBlock).toContain("c.subgroup_id IS NULL")
      expect(snapshotBlock).toContain("c.subgroup_id IS NOT NULL")
      expect(snapshotBlock).toContain("'subgroups'")
    })

    it("keeps client decoders compatible with copied and locked hierarchy snapshots", () => {
      const draft = decodeTechnicalConfigurationBaselineDraftWireResponse({
        data: hierarchySnapshot("draft"),
      }).data
      const locked = decodeTechnicalConfigurationBaselineVersionsListWireResponse({
        data: [hierarchySnapshot("locked")],
        total: 1,
        page: 1,
        page_size: 20,
      }).data[0]

      const draftGroup = draft.groups[0]
      const lockedGroup = locked?.groups[0]
      const draftCriterionIds = [
        ...draftGroup.criteria.map((criterion) => criterion.id),
        ...draftGroup.subgroups.flatMap((subgroup) =>
          subgroup.criteria.map((criterion) => criterion.id)
        ),
      ]
      const lockedCriterionIds = [
        ...(lockedGroup?.criteria.map((criterion) => criterion.id) ?? []),
        ...(lockedGroup?.subgroups.flatMap((subgroup) =>
          subgroup.criteria.map((criterion) => criterion.id)
        ) ?? []),
      ]

      expect(draftCriterionIds).toEqual(["copied-direct-criterion", "copied-subgroup-criterion"])
      expect(new Set(draftCriterionIds).size).toBe(draftCriterionIds.length)
      expect(lockedCriterionIds).toEqual(draftCriterionIds)
      expect(lockedGroup?.subgroups[0]?.id).toBe(draftGroup.subgroups[0]?.id)
      expect(lockedGroup?.criteria[0]?.criterion_code).toBe("TC-0001")
      expect(lockedGroup?.subgroups[0]?.criteria[0]?.criterion_code).toBe("TC-0002")
      expect(lockedGroup?.criteria[0]?.source_criterion_id).toBe("source-direct-criterion")
      expect(lockedGroup?.subgroups[0]?.criteria[0]?.source_criterion_id).toBe(
        "source-subgroup-criterion"
      )
    })

    it("ships a rollback-only copy and lock hierarchy phase gate", () => {
      expect(phaseGateSource).toContain("BEGIN;")
      expect(phaseGateSource).toContain("ROLLBACK;")
      expect(phaseGateSource).toContain(
        "technical_configuration_baseline_hierarchy_snapshots_phase_gate"
      )
      expect(phaseGateSource).toContain("pg_temp.set_claims('global'")
      expect(phaseGateSource).toContain("public.technical_configuration_baseline_copy(")
      expect(phaseGateSource).toContain("public.technical_configuration_baseline_lock(")
      expect(phaseGateSource).toContain("technical_configuration_baseline_subgroups")
      expect(phaseGateSource).toContain("source_criterion_id")
      expect(phaseGateSource).toContain("copied hierarchy remap failed")
      expect(phaseGateSource).toContain("copied criteria identity failed")
      expect(phaseGateSource).toContain("copied mixed ordering failed")
      expect(phaseGateSource).toContain("copy wrapper leaf remap failed")
      expect(phaseGateSource).toContain("locked hierarchy identity changed")
      expect(phaseGateSource).toContain(
        "jsonb_array_length(v_copy_snapshot->'groups') IS DISTINCT FROM 1"
      )
      expect(phaseGateSource).toContain("cardinality(v_copy_subgroup_ids) IS DISTINCT FROM 2")
    })

    it("keeps the internal copy helper unavailable to client and service roles", () => {
      expect(p1dMigrationSource).toContain(
        "REVOKE ALL ON FUNCTION public._technical_configuration_baseline_copy_p4(UUID, BIGINT) FROM PUBLIC, anon, authenticated, service_role;"
      )
    })

    it("keeps P1D complete after P1E advances", () => {
      const tasksSource = readFileSync(TASKS_PATH, "utf8")

      for (const task of ["P1D.1", "P1D.2", "P1D.3"]) {
        expect(tasksSource).toContain(`- [x] ${task}`)
      }
      expect(tasksSource).toContain("- [x] P1E.1")
    })
  })
})
