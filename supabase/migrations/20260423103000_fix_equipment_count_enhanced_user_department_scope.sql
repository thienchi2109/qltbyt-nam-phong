-- Migration: align equipment_count_enhanced with role=user department scope
-- Date: 2026-04-23
-- Issue: #306
--
-- Notes:
-- - Keep the public.equipment_count_enhanced(TEXT[], TEXT, BIGINT, TEXT)
--   signature unchanged.
-- - Preserve existing non-user behavior for global/admin/regional_leader.
-- - Reuse public._normalize_department_scope(text) to match the read/filter
--   RPC contract introduced in Issue #301.
-- - Fail closed for role=user when khoa_phong claim is missing/blank or when
--   the requested department does not match the user's normalized scope.
--
-- Rollback:
-- - Forward-only. Restore the previous function body in a new timestamped
--   migration if this behavior must be reverted.

BEGIN;

CREATE OR REPLACE FUNCTION public.equipment_count_enhanced(
  p_statuses text[] DEFAULT NULL::text[],
  p_q text DEFAULT NULL::text,
  p_don_vi bigint DEFAULT NULL::bigint,
  p_khoa_phong text DEFAULT NULL::text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_user_id text;
  v_allowed bigint[];
  v_effective_donvi bigint;
  v_cnt bigint;
  v_sanitized_q text;
  v_department_scope text;
  v_requested_department_scope text;
BEGIN
  v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_user_id := NULLIF(public._get_jwt_claim('user_id'), '');

  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_role = '' OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing required JWT claims' USING ERRCODE = '42501';
  END IF;

  v_allowed := public.allowed_don_vi_for_session_safe();

  IF v_role = 'global' THEN
    v_effective_donvi := p_don_vi;
  ELSIF v_role = 'regional_leader' THEN
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN 0;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
      END IF;
    ELSE
      v_effective_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::bigint;
      IF v_effective_donvi IS NULL THEN
        RETURN 0;
      END IF;
    END IF;
  ELSIF v_role IN ('to_qltb', 'qltb_khoa', 'technician', 'user') THEN
    v_effective_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::bigint;
    IF v_effective_donvi IS NULL THEN
      RAISE EXCEPTION 'Missing don_vi claim for role %', v_role USING ERRCODE = '42501';
    END IF;

    IF v_allowed IS NULL
       OR array_length(v_allowed, 1) IS NULL
       OR NOT (v_effective_donvi = ANY(v_allowed)) THEN
      RAISE EXCEPTION 'Access denied for role %', v_role USING ERRCODE = '42501';
    END IF;

    IF p_don_vi IS NOT NULL AND p_don_vi <> v_effective_donvi THEN
      RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'Access denied for role %', v_role USING ERRCODE = '42501';
  END IF;

  IF v_role = 'user' THEN
    v_department_scope := public._normalize_department_scope(public._get_jwt_claim('khoa_phong'));
    IF v_department_scope IS NULL THEN
      RETURN 0;
    END IF;

    IF p_khoa_phong IS NOT NULL THEN
      v_requested_department_scope := public._normalize_department_scope(p_khoa_phong);
      IF v_requested_department_scope IS DISTINCT FROM v_department_scope THEN
        RETURN 0;
      END IF;
    END IF;
  END IF;

  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

  SELECT COUNT(*)
  INTO v_cnt
  FROM public.thiet_bi tb
  WHERE tb.is_deleted = false
    AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
    AND (
      (v_role = 'user' AND public._normalize_department_scope(tb.khoa_phong_quan_ly) = v_department_scope)
      OR
      (v_role <> 'user' AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong))
    )
    AND (
      v_sanitized_q IS NULL
      OR tb.ten_thiet_bi ILIKE ('%' || v_sanitized_q || '%')
      OR tb.ma_thiet_bi ILIKE ('%' || v_sanitized_q || '%')
    )
    AND (p_statuses IS NULL OR tb.tinh_trang_hien_tai = ANY(p_statuses));

  RETURN COALESCE(v_cnt, 0);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.equipment_count_enhanced(TEXT[], TEXT, BIGINT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.equipment_count_enhanced(TEXT[], TEXT, BIGINT, TEXT) FROM PUBLIC;

COMMIT;
