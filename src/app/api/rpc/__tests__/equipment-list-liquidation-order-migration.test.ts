import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const MIGRATION_SUFFIX = "equipment_list_liquidation_last.sql"
const PREVIOUS_MIGRATION = "20260704074500_align_equipment_list_filters_with_bucket_labels.sql"

function getMigration() {
  const migrationsDir = path.resolve(process.cwd(), "supabase/migrations")
  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(MIGRATION_SUFFIX))
    .sort()

  expect(migrationFiles).toHaveLength(1)

  const migrationFile = migrationFiles[0] ?? ""
  expect(migrationFile > PREVIOUS_MIGRATION).toBe(true)

  return {
    file: migrationFile,
    source: migrationFile ? readFileSync(path.join(migrationsDir, migrationFile), "utf8") : "",
  }
}

function compactSql(source: string) {
  return source.replace(/\s+/g, " ").trim()
}

describe("equipment list liquidation-last migration", () => {
  it("replaces the sole RPC signature with a backward-compatible opt-in flag", () => {
    const { source } = getMigration()
    const compact = compactSql(source)
    const dropPosition = compact.indexOf(
      "DROP FUNCTION IF EXISTS public.equipment_list_enhanced( text, text, integer, integer, bigint, text, text[], text, text[], text, text[], text, text[], text, text[], text, text[] )"
    )
    const createPosition = compact.indexOf(
      "CREATE OR REPLACE FUNCTION public.equipment_list_enhanced("
    )

    expect(dropPosition).toBeGreaterThanOrEqual(0)
    expect(createPosition).toBeGreaterThan(dropPosition)
    expect(compact).toContain("p_liquidation_last boolean DEFAULT false ) RETURNS jsonb")
    expect(compact).toContain("SECURITY DEFINER")
    expect(compact).toContain("SET search_path = public, pg_temp")
  })

  it("prioritizes only exact both-condition matches before requested sorting and pagination", () => {
    const { source } = getMigration()
    const compact = compactSql(source)
    const flagBranch = compact.indexOf("IF p_liquidation_last THEN")
    const priorityStart = compact.indexOf("CASE", flagBranch)
    const priorityEnd = compact.indexOf("END ASC", priorityStart)
    const requestedSort = compact.indexOf("tb.%I %s", priorityEnd)
    const dynamicOrder = compact.indexOf("ORDER BY %s", requestedSort)
    const offset = compact.indexOf("OFFSET %s LIMIT %s", dynamicOrder)
    const priorityExpression = compact.slice(priorityStart, priorityEnd).replace(/''/g, "'")

    expect(flagBranch).toBeGreaterThanOrEqual(0)
    expect(priorityStart).toBeGreaterThanOrEqual(0)
    expect(priorityEnd).toBeGreaterThan(priorityStart)
    expect(priorityExpression).toContain(
      "public._normalize_department_scope(tb.khoa_phong_quan_ly) = public._normalize_department_scope('VT-TBYT- KHO THANH LÍ')"
    )
    expect(priorityExpression).toContain("AND btrim(tb.tinh_trang_hien_tai) = 'Ngưng sử dụng'")
    expect(priorityExpression).not.toMatch(/\b(?:LIKE|ILIKE)\b/i)
    expect(requestedSort).toBeGreaterThan(priorityEnd)
    expect(dynamicOrder).toBeGreaterThan(requestedSort)
    expect(offset).toBeGreaterThan(dynamicOrder)
    expect(compact).toContain("ELSE v_order_by := format('tb.%I %s', v_sort_col, v_sort_dir)")
  })

  it("restores least-privilege execute grants for the 18-argument signature", () => {
    const { source } = getMigration()
    const compact = compactSql(source)
    const signature =
      "text, text, integer, integer, bigint, text, text[], text, text[], text, text[], text, text[], text, text[], text, text[], boolean"

    expect(compact).toContain(
      `REVOKE ALL ON FUNCTION public.equipment_list_enhanced( ${signature} ) FROM PUBLIC`
    )
    expect(compact).toContain(
      `REVOKE ALL ON FUNCTION public.equipment_list_enhanced( ${signature} ) FROM anon`
    )
    expect(compact).toContain(
      `GRANT EXECUTE ON FUNCTION public.equipment_list_enhanced( ${signature} ) TO authenticated`
    )
  })
})
