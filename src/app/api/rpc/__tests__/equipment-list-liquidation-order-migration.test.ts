import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const MIGRATION_SUFFIX = "equipment_list_liquidation_chronology.sql"
const PREVIOUS_MIGRATION = "20260722094302_equipment_list_liquidation_last.sql"

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
    const createEnd = compact.indexOf(") RETURNS jsonb", createPosition)
    const parameterDeclarations = [
      "p_q text DEFAULT NULL::text",
      "p_sort text DEFAULT 'id.asc'::text",
      "p_page integer DEFAULT 1",
      "p_page_size integer DEFAULT 50",
      "p_don_vi bigint DEFAULT NULL::bigint",
      "p_khoa_phong text DEFAULT NULL::text",
      "p_khoa_phong_array text[] DEFAULT NULL::text[]",
      "p_nguoi_su_dung text DEFAULT NULL::text",
      "p_nguoi_su_dung_array text[] DEFAULT NULL::text[]",
      "p_vi_tri_lap_dat text DEFAULT NULL::text",
      "p_vi_tri_lap_dat_array text[] DEFAULT NULL::text[]",
      "p_tinh_trang text DEFAULT NULL::text",
      "p_tinh_trang_array text[] DEFAULT NULL::text[]",
      "p_phan_loai text DEFAULT NULL::text",
      "p_phan_loai_array text[] DEFAULT NULL::text[]",
      "p_nguon_kinh_phi text DEFAULT NULL::text",
      "p_nguon_kinh_phi_array text[] DEFAULT NULL::text[]",
      "p_liquidation_last boolean DEFAULT false",
    ]
    const createSignature = compact
      .slice(
        createPosition + "CREATE OR REPLACE FUNCTION public.equipment_list_enhanced(".length,
        createEnd
      )
      .trim()

    expect(dropPosition).toBeGreaterThanOrEqual(0)
    expect(createPosition).toBeGreaterThan(dropPosition)
    expect(createEnd).toBeGreaterThan(createPosition)
    expect(parameterDeclarations).toHaveLength(18)
    expect(createSignature).toBe(parameterDeclarations.join(", "))
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
    const chronologyStart = compact.indexOf("CASE", priorityEnd)
    const chronologyEnd = compact.indexOf("END ASC", chronologyStart)
    const requestedSort = compact.indexOf("tb.%I %s", chronologyEnd)
    const dynamicOrder = compact.indexOf("ORDER BY %s", requestedSort)
    const offset = compact.indexOf("OFFSET %s LIMIT %s", dynamicOrder)
    const priorityExpression = compact.slice(priorityStart, priorityEnd).replace(/''/g, "'")
    const chronologyExpression = compact.slice(chronologyStart, chronologyEnd).replace(/''/g, "'")

    expect(flagBranch).toBeGreaterThanOrEqual(0)
    expect(priorityStart).toBeGreaterThanOrEqual(0)
    expect(priorityEnd).toBeGreaterThan(priorityStart)
    expect(priorityExpression).toContain(
      "public._normalize_department_scope(tb.khoa_phong_quan_ly) = public._normalize_department_scope('VT-TBYT- KHO THANH LÍ')"
    )
    expect(priorityExpression).toContain("AND btrim(tb.tinh_trang_hien_tai) = 'Ngưng sử dụng'")
    expect(priorityExpression).not.toMatch(/\b(?:LIKE|ILIKE)\b/i)
    expect(chronologyStart).toBeGreaterThan(priorityEnd)
    expect(chronologyEnd).toBeGreaterThan(chronologyStart)
    expect(chronologyExpression).toContain(
      "public._normalize_department_scope(tb.khoa_phong_quan_ly) = public._normalize_department_scope('VT-TBYT- KHO THANH LÍ')"
    )
    expect(chronologyExpression).toContain("AND btrim(tb.tinh_trang_hien_tai) = 'Ngưng sử dụng'")
    expect(chronologyExpression).toContain(
      "THEN COALESCE(NULLIF(btrim(tb.ngay_ngung_su_dung), ''), '')"
    )
    expect(chronologyExpression).toContain("ELSE ''")
    expect(chronologyExpression).not.toMatch(/\b(?:LIKE|ILIKE)\b/i)
    expect(requestedSort).toBeGreaterThan(chronologyEnd)
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

  it("preserves JWT, tenant, filter, envelope, and pagination contracts", () => {
    const { source } = getMigration()
    const compact = compactSql(source)

    expect(compact).toContain("v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb")
    expect(compact).toContain("v_user_id := NULLIF(v_jwt_claims ->>'user_id', '')")
    expect(compact).toContain(
      "RAISE EXCEPTION 'Missing required JWT claims' USING ERRCODE = '42501'"
    )
    expect(compact).toContain("v_allowed_don_vi := public.allowed_don_vi_for_session_safe()")
    expect(compact).toContain("IF lower(v_role) IN ('global', 'admin') THEN")
    expect(compact).toContain(
      "IF v_effective_donvi IS NULL AND lower(v_role) NOT IN ('global', 'admin')"
    )
    expect(compact).toContain(
      "v_where := v_where || ' AND don_vi = ANY(ARRAY[' || array_to_string(v_allowed_don_vi, ',') || '])'"
    )
    expect(compact).toContain(
      "IF lower(v_role) = 'user' THEN v_where := v_where || ' AND public._normalize_department_scope(khoa_phong_quan_ly) = ' || quote_literal(v_department_scope)"
    )

    for (const arrayFilter of [
      "p_khoa_phong_array",
      "p_nguoi_su_dung_array",
      "p_vi_tri_lap_dat_array",
      "p_tinh_trang_array",
      "p_phan_loai_array",
      "p_nguon_kinh_phi_array",
    ]) {
      expect(compact).toContain(`unnest(${arrayFilter})`)
    }

    expect(compact).toContain("v_sanitized_q := public._sanitize_ilike_pattern(p_q)")
    expect(compact).toContain(
      "v_limit INT := GREATEST(p_page_size, 1); v_offset INT := GREATEST(p_page - 1, 0) * GREATEST(p_page_size, 1)"
    )
    expect(compact).toContain("OFFSET %s LIMIT %s")
    expect(compact).toContain(
      "RETURN jsonb_build_object( 'data', v_data, 'total', v_total, 'page', p_page, 'pageSize', p_page_size )"
    )
  })
})
