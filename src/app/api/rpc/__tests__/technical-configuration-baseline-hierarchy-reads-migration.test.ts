import { readFileSync, readdirSync } from "node:fs"
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
const P1A_MIGRATION_FILE = "20260807091720_technical_configuration_baseline_subgroups.sql"
const P1C_MIGRATION_SUFFIX = "_technical_configuration_baseline_hierarchy_reads.sql"
const P1C_FUNCTIONS = [
  "_technical_configuration_baseline_snapshot",
  "technical_configuration_baseline_versions_list",
  "technical_configuration_baseline_documents_list",
] as const

const migrationFiles = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
const p1cMigrationFiles = migrationFiles.filter((file) => file.endsWith(P1C_MIGRATION_SUFFIX))
const p1cMigrationFile = p1cMigrationFiles[0] ?? ""
const p1cMigrationSource = p1cMigrationFile
  ? readFileSync(path.join(MIGRATIONS_DIR, p1cMigrationFile), "utf8")
  : ""
const allMigrationSource = migrationFiles
  .map((file) => readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"))
  .join("\n")

function getFunctionBlock(migrationSource: string, functionName: string): string {
  const start = migrationSource.lastIndexOf(`CREATE OR REPLACE FUNCTION public.${functionName}`)
  expect(start).toBeGreaterThanOrEqual(0)

  const end = migrationSource.indexOf("\n$$;", start)
  expect(end).toBeGreaterThan(start)
  return migrationSource.slice(start, end + 4)
}

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1
}

function legacyBaselineVersion(id: string, status: "draft" | "locked") {
  const timestamp = "2026-08-07T00:00:00.000Z"

  return {
    id,
    dossier_id: "dossier-1",
    version_number: status === "draft" ? 2 : 1,
    status,
    source_baseline_version_id: null,
    source_version_number: null,
    next_criterion_number: 2,
    revision: 1,
    locked_at: status === "locked" ? timestamp : null,
    locked_by: status === "locked" ? 1 : null,
    created_at: timestamp,
    created_by: 1,
    updated_at: timestamp,
    updated_by: 1,
    groups: [
      {
        id: `${id}-group`,
        baseline_version_id: id,
        name: "Main section",
        sort_order: 1,
        created_at: timestamp,
        created_by: 1,
        updated_at: timestamp,
        updated_by: 1,
        criteria: [
          {
            id: `${id}-criterion`,
            baseline_version_id: id,
            group_id: `${id}-group`,
            criterion_code: "TC-0001",
            title: null,
            requirement_text: "Legacy direct criterion",
            sort_order: 1,
            source_criterion_id: null,
            created_at: timestamp,
            created_by: 1,
            updated_at: timestamp,
            updated_by: 1,
          },
        ],
      },
    ],
  }
}

describe("technical configuration baseline P1C hierarchy read migration", () => {
  it("ships one migration after the additive P1A subgroup schema", () => {
    expect(p1cMigrationFiles).toHaveLength(1)
    expect(p1cMigrationFile > P1A_MIGRATION_FILE).toBe(true)
  })

  const describeP1CMigration = p1cMigrationFiles.length === 1 ? describe : describe.skip

  describeP1CMigration("hierarchy-aware read contracts", () => {
    it("changes only the three phase-scoped read producers", () => {
      const redefinedFunctions = [
        ...p1cMigrationSource.matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z0-9_]+)\s*\(/g),
      ].map((match) => match[1])

      expect(redefinedFunctions).toEqual(P1C_FUNCTIONS)
      expect(p1cMigrationSource).not.toMatch(
        /\b(?:INSERT INTO|UPDATE public\.|DELETE FROM|ALTER TABLE|CREATE TABLE)\b/
      )
    })

    it("returns direct criteria and complete subgroup blocks in canonical order", () => {
      const block = getFunctionBlock(
        p1cMigrationSource,
        "_technical_configuration_baseline_snapshot"
      )

      for (const cte of [
        "direct_criteria_by_group",
        "criteria_by_subgroup",
        "subgroups_by_group",
        "groups_by_version",
      ]) {
        expect(block).toContain(cte)
      }

      expect(block).toContain("public.technical_configuration_baseline_subgroups")
      expect(block).toContain("c.subgroup_id IS NULL")
      expect(block).toContain("c.subgroup_id IS NOT NULL")
      expect(countOccurrences(block, "'subgroup_id', c.subgroup_id")).toBe(2)
      expect(countOccurrences(block, "ORDER BY c.sort_order, c.id")).toBe(2)
      expect(block).toContain("ORDER BY sg.sort_order, sg.id")
      expect(block).toContain("ORDER BY g.sort_order, g.id")
      expect(block).toContain("'criteria', COALESCE(dcbg.criteria, '[]'::JSONB)")
      expect(block).toContain("'subgroups', COALESCE(sbg.subgroups, '[]'::JSONB)")
    })

    it("keeps draft get and version detail on the canonical snapshot helper", () => {
      const draftGetBlock = getFunctionBlock(
        allMigrationSource,
        "technical_configuration_baseline_draft_get"
      )

      expect(draftGetBlock).toContain(
        "public._technical_configuration_baseline_snapshot(v_version_id)"
      )
      expect(p1cMigrationSource).not.toContain(
        "CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_draft_get"
      )
    })

    it("keeps paginated history hierarchy reads bounded and set-based", () => {
      const block = getFunctionBlock(
        p1cMigrationSource,
        "technical_configuration_baseline_versions_list"
      )

      for (const cte of [
        "paged_versions",
        "direct_criteria_by_group",
        "criteria_by_subgroup",
        "subgroups_by_group",
        "groups_by_version",
      ]) {
        expect(block).toContain(cte)
      }

      expect(countOccurrences(block, "INNER JOIN paged_versions")).toBeGreaterThanOrEqual(3)
      expect(block).toContain("p_page_size BETWEEN 1 AND 100")
      expect(block).toContain("ORDER BY v.version_number DESC, v.id")
      expect(block).toContain("LIMIT p_page_size")
      expect(block).toContain("OFFSET (p_page - 1)::BIGINT * p_page_size")
      expect(block).not.toContain("_technical_configuration_baseline_snapshot(")
      expect(block).toContain("'subgroups', COALESCE(sbg.subgroups, '[]'::JSONB)")
      expect(countOccurrences(block, "ORDER BY c.sort_order, c.id")).toBe(2)
      expect(block).toContain("ORDER BY sg.sort_order, sg.id")
      expect(block).toContain("ORDER BY g.sort_order, g.id")
    })

    it("returns set-based hierarchy ownership for paged evidence citations", () => {
      const block = getFunctionBlock(
        p1cMigrationSource,
        "technical_configuration_baseline_documents_list"
      )

      for (const cte of [
        "documents",
        "paged_documents",
        "citation_rows",
        "citations_by_document",
      ]) {
        expect(block).toContain(cte)
      }

      expect(block).toContain("INNER JOIN paged_documents")
      expect(block).toContain("public.technical_configuration_baseline_criteria")
      expect(block).toContain("id, 'baseline'::TEXT AS owner_type, baseline_version_id AS owner_id")
      expect(block).toContain("id, 'reference_product', reference_product_id")
      expect(block).toContain("'owner_type', d.owner_type")
      expect(block).toContain("'owner_id', d.owner_id")
      expect(block).toContain("'baseline_version_id', cr.baseline_version_id")
      expect(block).toContain("'group_id', cr.group_id")
      expect(block).toContain("'subgroup_id', cr.subgroup_id")
      expect(block).toContain("'citations', COALESCE(cbd.citations, '[]'::JSONB)")
      expect(block).toContain("GROUP BY cr.owner_type, cr.document_id")
      expect(block).toContain("cbd.owner_type = d.owner_type")
      expect(countOccurrences(block, "ORDER BY created_at, owner_type, id")).toBe(1)
      expect(block).toContain("ORDER BY d.created_at, d.owner_type, d.id")
      expect(block).not.toMatch(/CASE d\.owner_type[\s\S]*SELECT jsonb_agg/)
      expect(block).toContain("v_page_size > 100")
    })

    it("preserves signatures, auth boundaries, and least-privilege grants", () => {
      const snapshotBlock = getFunctionBlock(
        p1cMigrationSource,
        "_technical_configuration_baseline_snapshot"
      )
      const historyBlock = getFunctionBlock(
        p1cMigrationSource,
        "technical_configuration_baseline_versions_list"
      )
      const evidenceBlock = getFunctionBlock(
        p1cMigrationSource,
        "technical_configuration_baseline_documents_list"
      )
      const publicSignatures = [
        "technical_configuration_baseline_versions_list(UUID, INTEGER, INTEGER)",
        "technical_configuration_baseline_documents_list(UUID, INTEGER, INTEGER)",
      ]

      for (const block of [snapshotBlock, historyBlock, evidenceBlock]) {
        expect(block).toContain("RETURNS JSONB")
        expect(block).toContain("SECURITY DEFINER")
        expect(block).toContain("SET search_path = public, pg_temp")
      }

      expect(snapshotBlock).toContain("p_baseline_version_id UUID")
      expect(snapshotBlock).toContain("LANGUAGE sql")
      expect(snapshotBlock).toContain("STABLE")
      expect(historyBlock).toContain("p_dossier_id UUID")
      expect(historyBlock).toContain("p_page INTEGER DEFAULT 1")
      expect(historyBlock).toContain("p_page_size INTEGER DEFAULT 20")
      expect(historyBlock).toContain("LANGUAGE plpgsql")
      expect(evidenceBlock).toContain("p_baseline_version_id UUID")
      expect(evidenceBlock).toContain("p_page INTEGER DEFAULT 1")
      expect(evidenceBlock).toContain("p_page_size INTEGER DEFAULT 50")
      expect(evidenceBlock).toContain("LANGUAGE plpgsql")
      expect(historyBlock).toContain("public._technical_configuration_require_global_user()")
      expect(evidenceBlock).toContain("public._technical_configuration_require_global_user()")
      expect(p1cMigrationSource).toContain(
        "REVOKE ALL ON FUNCTION public._technical_configuration_baseline_snapshot(UUID) FROM PUBLIC, anon, authenticated, service_role;"
      )
      expect(p1cMigrationSource).toContain(
        "GRANT EXECUTE ON FUNCTION public._technical_configuration_baseline_snapshot(UUID) TO service_role;"
      )

      for (const signature of publicSignatures) {
        expect(p1cMigrationSource).toContain(
          `REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated, service_role;`
        )
        expect(p1cMigrationSource).toContain(
          `GRANT EXECUTE ON FUNCTION public.${signature} TO authenticated;`
        )
      }
    })

    it("behaviorally keeps legacy draft and locked consumers on empty subgroup arrays", () => {
      const draft = decodeTechnicalConfigurationBaselineDraftWireResponse({
        data: legacyBaselineVersion("legacy-draft", "draft"),
      }).data
      const locked = decodeTechnicalConfigurationBaselineVersionsListWireResponse({
        data: [legacyBaselineVersion("legacy-locked", "locked")],
        total: 1,
        page: 1,
        page_size: 20,
      }).data[0]

      for (const version of [draft, locked]) {
        expect(version?.groups[0]?.subgroups).toEqual([])
        expect(version?.groups[0]?.criteria[0]?.subgroup_id).toBeNull()
      }
    })

    it("keeps P1C complete after P1E advances", () => {
      const tasksSource = readFileSync(TASKS_PATH, "utf8")

      for (const task of ["P1C.1", "P1C.2", "P1C.3", "P1C.4"]) {
        expect(tasksSource).toContain(`- [x] ${task}`)
      }
      expect(tasksSource).toContain("- [x] P1E.1")
    })
  })
})
