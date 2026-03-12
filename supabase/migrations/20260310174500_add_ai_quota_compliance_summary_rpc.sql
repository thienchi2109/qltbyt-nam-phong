-- Add read-only AI quota compliance summary RPC with strict JWT guardrails.
-- Returns facility-scoped compliance overview from the active decision,
-- providing bounded evidence-ready data for the AI assistant.
--
-- Security: SECURITY DEFINER + pinned search_path, JWT claim guards,
-- tenant isolation, authenticated-only.

BEGIN;

DROP FUNCTION IF EXISTS public.ai_quota_compliance_summary(BIGINT, TEXT);

CREATE OR REPLACE FUNCTION public.ai_quota_compliance_summary(
  p_don_vi BIGINT DEFAULT NULL,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_user_id TEXT := NULLIF(COALESCE(public._get_jwt_claim('user_id'), public._get_jwt_claim('sub')), '');
  v_don_vi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_allowed BIGINT[] := NULL;
  v_is_global BOOLEAN := FALSE;
  v_effective_don_vi BIGINT;
  v_facility_name TEXT;

  v_decision_id BIGINT;
  v_decision_so TEXT;
  v_decision_trang_thai TEXT;
  v_decision_ngay_hieu_luc DATE;

  v_total_categories BIGINT;
  v_dat_count BIGINT;
  v_thieu_count BIGINT;
  v_vuot_count BIGINT;
  v_unmapped_count BIGINT;
BEGIN
  -- ── JWT claim guards ──────────────────────────────────────────
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

  IF p_user_id IS NOT NULL
     AND NULLIF(BTRIM(p_user_id), '') IS NOT NULL
     AND BTRIM(p_user_id) IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'user_id claim mismatch' USING ERRCODE = '42501';
  END IF;

  -- ── Resolve tenant scope ──────────────────────────────────────
  IF v_is_global THEN
    IF p_don_vi IS NULL THEN
      RETURN jsonb_build_object(
        'kind', 'quotaSummary',
        'error', 'Facility selection required',
        'evidence_status', 'none'
      );
    END IF;
    v_effective_don_vi := p_don_vi;
  ELSIF v_role = 'regional_leader' THEN
    v_allowed := public.allowed_don_vi_for_session_safe();
    IF v_allowed IS NULL OR cardinality(v_allowed) = 0 THEN
      RETURN jsonb_build_object(
        'kind', 'quotaSummary',
        'error', 'No accessible facilities',
        'evidence_status', 'none'
      );
    END IF;
    IF p_don_vi IS NULL THEN
      RETURN jsonb_build_object(
        'kind', 'quotaSummary',
        'error', 'Facility selection required',
        'evidence_status', 'none'
      );
    END IF;
    IF NOT (p_don_vi = ANY(v_allowed)) THEN
      RETURN jsonb_build_object(
        'kind', 'quotaSummary',
        'error', 'Access denied for selected facility',
        'evidence_status', 'none'
      );
    END IF;
    v_effective_don_vi := p_don_vi;
  ELSE
    -- Local user: reject mismatched facility override, then force own facility
    IF p_don_vi IS NOT NULL AND p_don_vi IS DISTINCT FROM v_don_vi THEN
      RAISE EXCEPTION 'don_vi claim mismatch' USING ERRCODE = '42501';
    END IF;
    v_effective_don_vi := v_don_vi;
  END IF;

  -- ── Validate facility exists ────────────────────────────────────
  SELECT dv.name INTO v_facility_name
  FROM public.don_vi dv WHERE dv.id = v_effective_don_vi;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'kind', 'quotaSummary',
      'error', 'Facility not found',
      'evidence_status', 'none'
    );
  END IF;

  -- ── Find active decision ──────────────────────────────────────
  SELECT qd.id, qd.so_quyet_dinh, qd.trang_thai, qd.ngay_hieu_luc
  INTO v_decision_id, v_decision_so, v_decision_trang_thai, v_decision_ngay_hieu_luc
  FROM public.quyet_dinh_dinh_muc qd
  WHERE qd.don_vi_id = v_effective_don_vi
    AND qd.trang_thai = 'active'
  ORDER BY qd.ngay_hieu_luc DESC
  LIMIT 1;

  -- Count unmapped equipment regardless
  SELECT COUNT(*)::BIGINT INTO v_unmapped_count
  FROM public.thiet_bi tb
  WHERE tb.don_vi = v_effective_don_vi
    AND tb.nhom_thiet_bi_id IS NULL
    AND tb.is_deleted = FALSE;

  IF v_decision_id IS NULL THEN
    RETURN jsonb_build_object(
      'kind', 'quotaSummary',
      'scope', jsonb_build_object(
        'mode', 'facility',
        'don_vi_id', v_effective_don_vi,
        'label', COALESCE(v_facility_name, 'Unknown')
      ),
      'decision', NULL,
      'summary', jsonb_build_object(
        'total_categories', 0,
        'dat_count', 0,
        'thieu_count', 0,
        'vuot_count', 0,
        'unmapped_equipment', v_unmapped_count
      ),
      'evidence_status', 'none',
      'message', 'No active quota decision found for this facility'
    );
  END IF;

  -- ── Calculate compliance statistics ───────────────────────────
  WITH equipment_counts AS (
    SELECT
      tb.nhom_thiet_bi_id,
      COUNT(*)::BIGINT AS so_luong_hien_co
    FROM public.thiet_bi tb
    WHERE tb.don_vi = v_effective_don_vi
      AND tb.nhom_thiet_bi_id IS NOT NULL
      AND tb.is_deleted = FALSE
    GROUP BY tb.nhom_thiet_bi_id
  ),
  compliance_status AS (
    SELECT
      CASE
        WHEN COALESCE(ec.so_luong_hien_co, 0) < cd.so_luong_toi_thieu THEN 'thieu'
        WHEN COALESCE(ec.so_luong_hien_co, 0) > cd.so_luong_toi_da THEN 'vuot'
        ELSE 'dat'
      END AS trang_thai
    FROM public.chi_tiet_dinh_muc cd
    LEFT JOIN equipment_counts ec ON ec.nhom_thiet_bi_id = cd.nhom_thiet_bi_id
    WHERE cd.quyet_dinh_id = v_decision_id
  )
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE trang_thai = 'dat')::BIGINT,
    COUNT(*) FILTER (WHERE trang_thai = 'thieu')::BIGINT,
    COUNT(*) FILTER (WHERE trang_thai = 'vuot')::BIGINT
  INTO v_total_categories, v_dat_count, v_thieu_count, v_vuot_count
  FROM compliance_status;

  RETURN jsonb_build_object(
    'kind', 'quotaSummary',
    'scope', jsonb_build_object(
      'mode', 'facility',
      'don_vi_id', v_effective_don_vi,
      'label', COALESCE(v_facility_name, 'Unknown')
    ),
    'decision', jsonb_build_object(
      'id', v_decision_id,
      'so_quyet_dinh', v_decision_so,
      'trang_thai', v_decision_trang_thai,
      'ngay_hieu_luc', v_decision_ngay_hieu_luc
    ),
    'summary', jsonb_build_object(
      'total_categories', COALESCE(v_total_categories, 0),
      'dat_count', COALESCE(v_dat_count, 0),
      'thieu_count', COALESCE(v_thieu_count, 0),
      'vuot_count', COALESCE(v_vuot_count, 0),
      'unmapped_equipment', v_unmapped_count
    ),
    'evidence_status', 'complete',
    'suggested_follow_ups', jsonb_build_array(
      'Xem nhóm thiếu định mức',
      'Xem nhóm vượt định mức',
      'Xem thiết bị chưa gán danh mục',
      'Kiểm tra thiết bị cụ thể'
    )
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ai_quota_compliance_summary(BIGINT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.ai_quota_compliance_summary(BIGINT, TEXT) FROM PUBLIC;

COMMIT;
