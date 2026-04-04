-- ============================================
-- Migration: Maintenance Plan Status Counts RPC
-- Date: 2026-04-04 08:34 UTC
-- Pattern: maintenance_plan_list (tenant scoping via allowed_don_vi_for_session_safe)
-- Issue: #214 — KPI Status Cards Batch 3
-- ============================================
-- Security: SECURITY DEFINER + pinned search_path, JWT claim guards,
--           tenant scoping via allowed_don_vi_for_session_safe().
--           ILIKE sanitization via _sanitize_ilike_pattern().
-- Read-only aggregate (STABLE). Accepts p_q for search-scoped counts.
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION public.maintenance_plan_status_counts(
  p_don_vi BIGINT DEFAULT NULL,
  p_q TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_role TEXT;
  v_allowed_don_vi BIGINT[];
  v_jwt_claims JSONB;
  v_result JSONB;
  v_sanitized_q TEXT;
BEGIN
  -- ============================================
  -- JWT Claims Extraction
  -- ============================================
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    -- No JWT claims — fail safe with empty counts
    RETURN jsonb_build_object(
      'Bản nháp', 0, 'Đã duyệt', 0, 'Không duyệt', 0
    );
  END;

  -- Extract role from JWT claims
  v_role := lower(COALESCE(
    v_jwt_claims->>'app_role',
    v_jwt_claims->>'role',
    ''
  ));

  -- JWT claim guard (mandatory)
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  -- Normalize admin → global (repo convention)
  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  -- ============================================
  -- Multi-Tenant Security: Get Allowed Facilities
  -- ============================================
  -- Uses helper function that returns facilities based on role:
  -- - global: all active tenants
  -- - regional_leader: facilities in assigned region (dia_ban)
  -- - other roles: only their tenant
  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();

  -- Defensive check: ensure user has access to at least one facility
  IF v_allowed_don_vi IS NULL OR array_length(v_allowed_don_vi, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'Bản nháp', 0, 'Đã duyệt', 0, 'Không duyệt', 0
    );
  END IF;

  -- ============================================
  -- Security Check: Validate Facility Filter
  -- ============================================
  -- If user requests specific facility, verify they have access
  IF p_don_vi IS NOT NULL THEN
    IF NOT (p_don_vi = ANY(v_allowed_don_vi)) THEN
      RAISE EXCEPTION 'Access denied to facility %', p_don_vi
        USING ERRCODE = '42501',
              HINT = 'You do not have permission to access this facility';
    END IF;
  END IF;

  -- ============================================
  -- Sanitize ILIKE metacharacters (MANDATORY per repo rules)
  -- ============================================
  -- _sanitize_ilike_pattern returns NULL for NULL/empty input, so the
  -- v_sanitized_q IS NULL guard correctly skips the clause when p_q is absent.
  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

  -- ============================================
  -- Aggregate Query: Status Counts (tenant-scoped)
  -- ============================================
  SELECT jsonb_build_object(
    'Bản nháp',     COALESCE(SUM(CASE WHEN kh.trang_thai = 'Bản nháp' THEN 1 ELSE 0 END), 0),
    'Đã duyệt',    COALESCE(SUM(CASE WHEN kh.trang_thai = 'Đã duyệt' THEN 1 ELSE 0 END), 0),
    'Không duyệt',  COALESCE(SUM(CASE WHEN kh.trang_thai = 'Không duyệt' THEN 1 ELSE 0 END), 0)
  ) INTO v_result
  FROM public.ke_hoach_bao_tri kh
  LEFT JOIN don_vi dv ON kh.don_vi = dv.id
  WHERE (
    -- Search filter (text search across multiple fields)
    -- Uses sanitized pattern to prevent ILIKE metacharacter injection
    v_sanitized_q IS NULL
    OR kh.ten_ke_hoach ILIKE '%' || v_sanitized_q || '%'
    OR COALESCE(kh.khoa_phong, '') ILIKE '%' || v_sanitized_q || '%'
    OR COALESCE(kh.nguoi_lap_ke_hoach, '') ILIKE '%' || v_sanitized_q || '%'
    OR COALESCE(kh.loai_cong_viec, '') ILIKE '%' || v_sanitized_q || '%'
    OR COALESCE(dv.name, '') ILIKE '%' || v_sanitized_q || '%'
    OR CAST(kh.nam AS TEXT) ILIKE '%' || v_sanitized_q || '%'
  ) AND (
    -- ============================================
    -- SERVER-SIDE FACILITY FILTER (CRITICAL!)
    -- ============================================
    CASE
      WHEN p_don_vi IS NOT NULL THEN
        -- Specific facility requested: filter by that facility only
        -- (access already validated above)
        kh.don_vi = p_don_vi
      ELSE
        -- No specific facility: show all facilities user can access
        -- Global users see all, regional leaders see their region
        v_role = 'global' OR kh.don_vi = ANY(v_allowed_don_vi)
    END
  );

  RETURN COALESCE(v_result, jsonb_build_object(
    'Bản nháp', 0, 'Đã duyệt', 0, 'Không duyệt', 0
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_plan_status_counts(BIGINT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.maintenance_plan_status_counts(BIGINT, TEXT) FROM PUBLIC;

COMMENT ON FUNCTION public.maintenance_plan_status_counts(BIGINT, TEXT) IS
'Returns status distribution counts for maintenance plans, scoped by tenant security.

PARAMETERS:
- p_don_vi: Facility filter (NULL = all accessible facilities)
- p_q: Text search across name, department, year, work type, facility name

RETURNS: JSONB { "Bản nháp": N, "Đã duyệt": N, "Không duyệt": N }

SECURITY:
- Global users: see all plans from all active tenants
- Regional leaders: see plans only from facilities in assigned region
- Regular users: see plans only from their tenant
- Facility filter enforces access via allowed_don_vi_for_session_safe()
- ILIKE patterns sanitized via _sanitize_ilike_pattern()

PATTERN: Matches maintenance_plan_list tenant scoping (migration 20251013093831)
ISSUE: #214 — KPI Status Cards Batch 3';

COMMIT;
