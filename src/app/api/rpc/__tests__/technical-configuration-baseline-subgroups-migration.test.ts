import { readFileSync, readdirSync } from "node:fs"
import { basename, join } from "node:path"

import { describe, expect, it } from "vitest"

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations")
const MIGRATION_FILE = "20260807091720_technical_configuration_baseline_subgroups.sql"
const MIGRATION_SUFFIX = "_technical_configuration_baseline_subgroups.sql"
const PREDECESSOR_FILE = "20260806031201_technical_configuration_dossier_delete_audit.sql"

function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR, { encoding: "utf8", recursive: true })
    .filter((file) => file.endsWith(".sql"))
    .sort()
}

function getMigrationTimestamp(filePath: string): number {
  const match = /^(\d{8}|\d{14})_/.exec(basename(filePath))
  if (!match) {
    throw new Error(`Migration file lacks a timestamp prefix: ${filePath}`)
  }

  return Number(match[1].length === 8 ? `${match[1]}000000` : match[1])
}

const migrationFiles = listMigrationFiles()
const matchingFiles = migrationFiles.filter((file) => file.endsWith(MIGRATION_SUFFIX))
const migrationSource =
  matchingFiles.length === 1 ? readFileSync(join(MIGRATIONS_DIR, matchingFiles[0]), "utf8") : ""

describe("technical configuration baseline P1A subgroup migration", () => {
  it("adds exactly one correctly ordered migration", () => {
    expect(matchingFiles).toEqual([MIGRATION_FILE])
    expect(getMigrationTimestamp(MIGRATION_FILE)).toBeGreaterThan(
      getMigrationTimestamp(PREDECESSOR_FILE)
    )
  })

  it("creates the ordered subgroup schema with scoped ownership", () => {
    expect(migrationSource).toContain(
      "CREATE TABLE public.technical_configuration_baseline_subgroups"
    )
    expect(migrationSource).toMatch(/id UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/)
    expect(migrationSource).toMatch(/baseline_version_id UUID NOT NULL/)
    expect(migrationSource).toMatch(/group_id UUID NOT NULL/)
    expect(migrationSource).toMatch(/name TEXT NOT NULL CHECK \(btrim\(name\) <> ''\)/)
    expect(migrationSource).toMatch(/sort_order INTEGER NOT NULL CHECK \(sort_order > 0\)/)
    expect(migrationSource).toMatch(/created_at TIMESTAMPTZ NOT NULL DEFAULT now\(\)/)
    expect(migrationSource).toMatch(/created_by BIGINT NOT NULL/)
    expect(migrationSource).toMatch(/updated_at TIMESTAMPTZ NOT NULL DEFAULT now\(\)/)
    expect(migrationSource).toMatch(/updated_by BIGINT NOT NULL/)
    expect(migrationSource).toMatch(
      /CONSTRAINT tc_baseline_subgroups_id_scope_key\s+UNIQUE \(id, group_id, baseline_version_id\)/
    )
    expect(migrationSource).toMatch(
      /CONSTRAINT tc_baseline_subgroups_group_sort_key\s+UNIQUE \(group_id, sort_order\) DEFERRABLE INITIALLY IMMEDIATE/
    )
    expect(migrationSource).toMatch(
      /CONSTRAINT tc_baseline_subgroups_group_scope_fkey\s+FOREIGN KEY \(group_id, baseline_version_id\)\s+REFERENCES public\.technical_configuration_baseline_groups \(id, baseline_version_id\)\s+ON DELETE CASCADE/
    )
  })

  it("keeps existing criteria direct while adding nullable subgroup ownership", () => {
    expect(migrationSource).toMatch(
      /ALTER TABLE public\.technical_configuration_baseline_criteria\s+ADD COLUMN subgroup_id UUID;/
    )
    expect(migrationSource).not.toMatch(/ADD COLUMN subgroup_id UUID\s+(?:DEFAULT|NOT NULL)/i)
    expect(migrationSource).not.toMatch(
      /ALTER TABLE public\.technical_configuration_baseline_criteria\s+ALTER COLUMN subgroup_id\s+SET (?:DEFAULT|NOT NULL)/i
    )
    expect(migrationSource).toMatch(
      /CONSTRAINT tc_baseline_criteria_subgroup_scope_fkey\s+FOREIGN KEY \(subgroup_id, group_id, baseline_version_id\)\s+REFERENCES public\.technical_configuration_baseline_subgroups\s+\(id, group_id, baseline_version_id\)\s+ON DELETE NO ACTION\s+DEFERRABLE INITIALLY DEFERRED/
    )
    expect(migrationSource).not.toMatch(
      /UPDATE\s+public\.technical_configuration_baseline_criteria/i
    )
    expect(migrationSource).not.toMatch(
      /ALTER COLUMN\s+(?:id|baseline_version_id|group_id|criterion_code|sort_order)/i
    )
  })

  it("adds only the hierarchy read indexes required by P1A", () => {
    expect(migrationSource).toContain("CREATE INDEX tc_baseline_subgroups_version_order_idx")
    expect(migrationSource).toMatch(
      /ON public\.technical_configuration_baseline_subgroups\s+\(baseline_version_id, group_id, sort_order, id\)/
    )
    expect(migrationSource).toContain("CREATE INDEX tc_baseline_criteria_subgroup_order_idx")
    expect(migrationSource).toMatch(
      /ON public\.technical_configuration_baseline_criteria\s+\(subgroup_id, sort_order, id\)\s+WHERE subgroup_id IS NOT NULL/
    )
  })

  it("keeps subgroup storage RPC-only and deny-by-default", () => {
    expect(migrationSource).toContain(
      "ALTER TABLE public.technical_configuration_baseline_subgroups ENABLE ROW LEVEL SECURITY"
    )
    expect(migrationSource).toMatch(
      /CREATE POLICY technical_configuration_baseline_subgroups_no_client_access\s+ON public\.technical_configuration_baseline_subgroups\s+FOR ALL\s+TO anon, authenticated\s+USING \(false\)\s+WITH CHECK \(false\)/
    )
    expect(migrationSource).toContain(
      "REVOKE ALL ON TABLE public.technical_configuration_baseline_subgroups FROM PUBLIC, anon, authenticated"
    )
    expect(migrationSource).toContain(
      "GRANT ALL ON TABLE public.technical_configuration_baseline_subgroups TO service_role"
    )

    const tablePrivilegeStatements =
      migrationSource.match(/\b(?:GRANT|REVOKE)\b[^;]*\bON TABLE public\.[^;]+;/gi) ?? []
    expect(tablePrivilegeStatements).toHaveLength(2)
    for (const statement of tablePrivilegeStatements) {
      expect(statement).toContain("public.technical_configuration_baseline_subgroups")
    }
  })

  it("does not redefine functions, RPC grants, or existing criterion values", () => {
    expect(migrationSource).not.toMatch(
      /\b(?:(?:CREATE(?:\s+OR\s+REPLACE)?|ALTER|DROP)\s+(?:FUNCTION|PROCEDURE)|COMMENT\s+ON\s+(?:FUNCTION|PROCEDURE))\b/i
    )
    expect(migrationSource).not.toMatch(/\b(?:GRANT|REVOKE)\b[^;]*\bON\s+FUNCTION\b/i)
    expect(migrationSource).not.toMatch(
      /\b(?:INSERT\s+INTO|DELETE\s+FROM|UPDATE|MERGE\s+INTO|TRUNCATE(?:\s+TABLE)?)\s+public\./i
    )
    expect(migrationSource).not.toMatch(
      /ALTER TABLE public\.technical_configuration_(?:dossiers|baseline_versions|baseline_groups)\b/i
    )

    const criterionAlterStatements =
      migrationSource.match(
        /ALTER TABLE public\.technical_configuration_baseline_criteria[\s\S]*?;/g
      ) ?? []
    expect(criterionAlterStatements).toHaveLength(2)
  })

  it("documents the schema-only boundary and data-preserving rollback", () => {
    expect(migrationSource).toContain("P1A is schema-only")
    expect(migrationSource).toContain("Existing criteria remain direct children")
    expect(migrationSource).toContain("Never drop populated hierarchy data")
  })
})
