-- ============================================
-- Migration: Align maintenance_plan_list search + tenant scope with counts RPC
-- Date: 2026-04-04 10:30 UTC
-- Issue: #214 follow-up from PR review
-- ============================================
-- Fixes:
-- 1. Apply _sanitize_ilike_pattern(p_q) so list semantics match
--    maintenance_plan_status_counts for '%' and '_' inputs.
-- 2. Remove redundant global-role OR bypass so all visibility flows through
--    allowed_don_vi_for_session_safe().
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION public.maintenance_plan_list(
  p_q TEXT DEFAULT NULL,
  p_don_vi BIGINT DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_allowed_don_vi BIGINT[];
  v_jwt_claims JSONB;
  v_page INT;
  v_page_size INT;
  v_offset INT;
  v_total BIGINT;
  v_result JSONB;
  v_sanitized_q TEXT;
BEGIN
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'data', '[]'::jsonb,
      'total', 0,
      'page', COALESCE(p_page, 1),
      'pageSize', COALESCE(p_page_size, 50)
    );
  END;

  v_role := lower(COALESCE(
    v_jwt_claims->>'app_role',
    v_jwt_claims->>'role',
    ''
  ));

  IF v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();

  IF v_allowed_don_vi IS NULL OR array_length(v_allowed_don_vi, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'data', '[]'::jsonb,
      'total', 0,
      'page', COALESCE(p_page, 1),
      'pageSize', COALESCE(p_page_size, 50)
    );
  END IF;

  v_page := GREATEST(1, COALESCE(p_page, 1));
  v_page_size := LEAST(200, GREATEST(1, COALESCE(p_page_size, 50)));
  v_offset := (v_page - 1) * v_page_size;

  IF p_don_vi IS NOT NULL AND NOT (p_don_vi = ANY(v_allowed_don_vi)) THEN
    RAISE EXCEPTION 'Access denied to facility %', p_don_vi
      USING ERRCODE = '42501',
            HINT = 'You do not have permission to access this facility';
  END IF;

  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

  SELECT COUNT(*) INTO v_total
  FROM ke_hoach_bao_tri kh
  LEFT JOIN don_vi dv ON kh.don_vi = dv.id
  WHERE (
    v_sanitized_q IS NULL
    OR kh.ten_ke_hoach ILIKE '%' || v_sanitized_q || '%'
    OR COALESCE(kh.khoa_phong, '') ILIKE '%' || v_sanitized_q || '%'
    OR COALESCE(kh.nguoi_lap_ke_hoach, '') ILIKE '%' || v_sanitized_q || '%'
    OR COALESCE(kh.loai_cong_viec, '') ILIKE '%' || v_sanitized_q || '%'
    OR COALESCE(dv.name, '') ILIKE '%' || v_sanitized_q || '%'
    OR CAST(kh.nam AS TEXT) ILIKE '%' || v_sanitized_q || '%'
  ) AND (
    CASE
      WHEN p_don_vi IS NOT NULL THEN kh.don_vi = p_don_vi
      ELSE kh.don_vi = ANY(v_allowed_don_vi)
    END
  );

  SELECT jsonb_build_object(
    'data', COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', kh.id,
        'ten_ke_hoach', kh.ten_ke_hoach,
        'nam', kh.nam,
        'loai_cong_viec', kh.loai_cong_viec,
        'khoa_phong', kh.khoa_phong,
        'nguoi_lap_ke_hoach', kh.nguoi_lap_ke_hoach,
        'trang_thai', kh.trang_thai,
        'ngay_phe_duyet', kh.ngay_phe_duyet,
        'nguoi_duyet', kh.nguoi_duyet,
        'ly_do_khong_duyet', kh.ly_do_khong_duyet,
        'created_at', kh.created_at,
        'don_vi', kh.don_vi,
        'facility_name', dv.name
      ) ORDER BY kh.nam DESC, kh.created_at DESC
    ), '[]'::jsonb),
    'total', v_total,
    'page', v_page,
    'pageSize', v_page_size
  ) INTO v_result
  FROM (
    SELECT kh.*, dv.name
    FROM ke_hoach_bao_tri kh
    LEFT JOIN don_vi dv ON kh.don_vi = dv.id
    WHERE (
      v_sanitized_q IS NULL
      OR kh.ten_ke_hoach ILIKE '%' || v_sanitized_q || '%'
      OR COALESCE(kh.khoa_phong, '') ILIKE '%' || v_sanitized_q || '%'
      OR COALESCE(kh.nguoi_lap_ke_hoach, '') ILIKE '%' || v_sanitized_q || '%'
      OR COALESCE(kh.loai_cong_viec, '') ILIKE '%' || v_sanitized_q || '%'
      OR COALESCE(dv.name, '') ILIKE '%' || v_sanitized_q || '%'
      OR CAST(kh.nam AS TEXT) ILIKE '%' || v_sanitized_q || '%'
    ) AND (
      CASE
        WHEN p_don_vi IS NOT NULL THEN kh.don_vi = p_don_vi
        ELSE kh.don_vi = ANY(v_allowed_don_vi)
      END
    )
    ORDER BY kh.nam DESC, kh.created_at DESC
    LIMIT v_page_size
    OFFSET v_offset
  ) kh
  LEFT JOIN don_vi dv ON kh.don_vi = dv.id;

  RETURN COALESCE(v_result, jsonb_build_object(
    'data', '[]'::jsonb,
    'total', 0,
    'page', v_page,
    'pageSize', v_page_size
  ));
END;
$$;

COMMENT ON FUNCTION public.maintenance_plan_list(TEXT, BIGINT, INT, INT) IS
$$Lists maintenance plans with server-side pagination and facility filtering.

PARAMETERS:
- p_q: Text search across name, department, year, work type, facility name
- p_don_vi: Facility filter (NULL = all accessible facilities)
- p_page: Page number (default 1, min 1)
- p_page_size: Items per page (default 50, max 200)

SECURITY:
- Tenant visibility governed by allowed_don_vi_for_session_safe()
- Search patterns sanitized via _sanitize_ilike_pattern()
$$;

COMMIT;
