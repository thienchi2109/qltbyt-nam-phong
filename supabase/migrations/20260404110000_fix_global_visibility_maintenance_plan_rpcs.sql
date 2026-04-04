-- ============================================
-- Patch: Restore global visibility for maintenance plan RPCs
-- Date: 2026-04-04 11:00 UTC
-- Issue: #214 follow-up after PR review
-- ============================================
-- Fixes a regression introduced in Batch 3 where global users no longer
-- saw maintenance plans with don_vi IS NULL. Global-created plans can
-- legitimately have don_vi = NULL because the RPC proxy signs global JWTs
-- with don_vi = null and maintenance_plan_create persists that claim.
--
-- This patch restores the previous semantics:
-- - explicit p_don_vi filter => exact facility match
-- - no p_don_vi filter => global sees all rows, others stay tenant-scoped
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
  v_user_id TEXT;
  v_don_vi BIGINT;
  v_is_global BOOLEAN := FALSE;
  v_allowed_don_vi BIGINT[];
  v_jwt_claims JSONB;
  v_result JSONB;
  v_sanitized_q TEXT;
BEGIN
  v_jwt_claims := COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb;

  v_role := lower(COALESCE(
    v_jwt_claims->>'app_role',
    v_jwt_claims->>'role',
    ''
  ));
  v_user_id := NULLIF(COALESCE(v_jwt_claims->>'user_id', v_jwt_claims->>'sub'), '');
  v_don_vi := NULLIF(v_jwt_claims->>'don_vi', '')::BIGINT;

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;
  v_is_global := (v_role = 'global');

  IF NOT v_is_global AND v_don_vi IS NULL THEN
    RAISE EXCEPTION 'Missing don_vi claim' USING ERRCODE = '42501';
  END IF;

  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();

  IF v_allowed_don_vi IS NULL OR array_length(v_allowed_don_vi, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'Bản nháp', 0, 'Đã duyệt', 0, 'Không duyệt', 0
    );
  END IF;

  IF p_don_vi IS NOT NULL AND NOT (p_don_vi = ANY(v_allowed_don_vi)) THEN
    RAISE EXCEPTION 'Access denied to facility %', p_don_vi
      USING ERRCODE = '42501',
            HINT = 'You do not have permission to access this facility';
  END IF;

  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

  SELECT jsonb_build_object(
    'Bản nháp',     COALESCE(SUM(CASE WHEN kh.trang_thai = 'Bản nháp' THEN 1 ELSE 0 END), 0),
    'Đã duyệt',    COALESCE(SUM(CASE WHEN kh.trang_thai = 'Đã duyệt' THEN 1 ELSE 0 END), 0),
    'Không duyệt',  COALESCE(SUM(CASE WHEN kh.trang_thai = 'Không duyệt' THEN 1 ELSE 0 END), 0)
  ) INTO v_result
  FROM public.ke_hoach_bao_tri kh
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
      ELSE v_is_global OR kh.don_vi = ANY(v_allowed_don_vi)
    END
  );

  RETURN COALESCE(v_result, jsonb_build_object(
    'Bản nháp', 0, 'Đã duyệt', 0, 'Không duyệt', 0
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_plan_status_counts(BIGINT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.maintenance_plan_status_counts(BIGINT, TEXT) FROM PUBLIC;

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
  v_user_id TEXT;
  v_don_vi BIGINT;
  v_is_global BOOLEAN := FALSE;
  v_allowed_don_vi BIGINT[];
  v_jwt_claims JSONB;
  v_page INT;
  v_page_size INT;
  v_offset INT;
  v_total BIGINT;
  v_result JSONB;
  v_sanitized_q TEXT;
BEGIN
  v_jwt_claims := COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb;

  v_role := lower(COALESCE(
    v_jwt_claims->>'app_role',
    v_jwt_claims->>'role',
    ''
  ));
  v_user_id := NULLIF(COALESCE(v_jwt_claims->>'user_id', v_jwt_claims->>'sub'), '');
  v_don_vi := NULLIF(v_jwt_claims->>'don_vi', '')::BIGINT;

  IF v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;
  v_is_global := (v_role = 'global');

  IF NOT v_is_global AND v_don_vi IS NULL THEN
    RAISE EXCEPTION 'Missing don_vi claim' USING ERRCODE = '42501';
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
      ELSE v_is_global OR kh.don_vi = ANY(v_allowed_don_vi)
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
        'facility_name', kh.facility_name
      ) ORDER BY kh.nam DESC, kh.created_at DESC
    ), '[]'::jsonb),
    'total', v_total,
    'page', v_page,
    'pageSize', v_page_size
  ) INTO v_result
  FROM (
    SELECT
      kh.id,
      kh.ten_ke_hoach,
      kh.nam,
      kh.loai_cong_viec,
      kh.khoa_phong,
      kh.nguoi_lap_ke_hoach,
      kh.trang_thai,
      kh.ngay_phe_duyet,
      kh.nguoi_duyet,
      kh.ly_do_khong_duyet,
      kh.created_at,
      kh.don_vi,
      dv.name AS facility_name
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
        ELSE v_is_global OR kh.don_vi = ANY(v_allowed_don_vi)
      END
    )
    ORDER BY kh.nam DESC, kh.created_at DESC
    LIMIT v_page_size
    OFFSET v_offset
  ) kh;

  RETURN COALESCE(v_result, jsonb_build_object(
    'data', '[]'::jsonb,
    'total', 0,
    'page', v_page,
    'pageSize', v_page_size
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_plan_list(TEXT, BIGINT, INT, INT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.maintenance_plan_list(TEXT, BIGINT, INT, INT) FROM PUBLIC;

COMMIT;
