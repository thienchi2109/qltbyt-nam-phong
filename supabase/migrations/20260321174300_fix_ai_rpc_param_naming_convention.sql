-- Fix: Rename parameter `thiet_bi_id` → `p_thiet_bi_id` in 4 AI functions.
-- Root cause: parameter name collides with column `nhat_ky_su_dung.thiet_bi_id`,
-- causing ERROR 42702 (ambiguous column reference) in ai_usage_summary.
-- Also fixes same latent issue in ai_attachment_metadata, ai_device_quota_lookup,
-- and ai_maintenance_plan_lookup for convention alignment (p_ prefix).
--
-- Security: SECURITY DEFINER + pinned search_path, JWT claim guards retained.

BEGIN;

-- ════════════════════════════════════════════════════════════════════
-- 1. ai_usage_summary  (crash bug — ambiguous column in last_30/last_90)
-- ════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.ai_usage_summary(BIGINT, INTEGER, BIGINT, TEXT);

CREATE OR REPLACE FUNCTION public.ai_usage_summary(
  p_thiet_bi_id BIGINT,
  p_months INTEGER DEFAULT 6,
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
  v_equip_don_vi BIGINT;
  v_cutoff TIMESTAMPTZ;
  v_months INT := GREATEST(LEAST(COALESCE(p_months, 6), 24), 1);
BEGIN
  -- ── JWT claim guards ───────────────────────────────────────────
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

  -- ── Defense-in-depth: validate p_thiet_bi_id ───────────────────
  IF p_thiet_bi_id IS NULL OR p_thiet_bi_id <= 0 THEN
    RETURN jsonb_build_object(
      'error', 'Invalid thiet_bi_id',
      'thiet_bi_id', p_thiet_bi_id
    );
  END IF;

  -- ── Resolve tenant scope FIRST ─────────────────────────────────
  IF v_is_global THEN
    IF p_don_vi IS NULL THEN
      RETURN jsonb_build_object('error', 'Facility selection required', 'thiet_bi_id', p_thiet_bi_id);
    END IF;
  ELSIF v_role = 'regional_leader' THEN
    v_allowed := public.allowed_don_vi_for_session_safe();
    IF v_allowed IS NULL OR cardinality(v_allowed) = 0 THEN
      RETURN jsonb_build_object('error', 'No accessible facilities', 'thiet_bi_id', p_thiet_bi_id);
    END IF;
    IF p_don_vi IS NULL THEN
      RETURN jsonb_build_object('error', 'Facility selection required', 'thiet_bi_id', p_thiet_bi_id);
    END IF;
    IF NOT (p_don_vi = ANY(v_allowed)) THEN
      RETURN jsonb_build_object('error', 'Access denied for selected facility', 'thiet_bi_id', p_thiet_bi_id);
    END IF;
  END IF;

  -- ── Tenant-scoped equipment lookup ─────────────────────────────
  SELECT tb.don_vi INTO v_equip_don_vi
  FROM public.thiet_bi tb
  WHERE tb.id = p_thiet_bi_id
    AND tb.is_deleted = FALSE
    AND (
      CASE
        WHEN v_is_global THEN tb.don_vi = p_don_vi
        WHEN v_role = 'regional_leader' THEN tb.don_vi = p_don_vi
        ELSE tb.don_vi = v_don_vi
      END
    );

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Equipment not found or not accessible', 'thiet_bi_id', p_thiet_bi_id);
  END IF;

  v_cutoff := NOW() - (v_months || ' months')::INTERVAL;

  RETURN (
    WITH usage_data AS (
      SELECT
        nk.thoi_gian_bat_dau,
        nk.thoi_gian_ket_thuc,
        nk.tinh_trang_thiet_bi,
        EXTRACT(EPOCH FROM (nk.thoi_gian_ket_thuc - nk.thoi_gian_bat_dau)) / 3600.0 AS duration_hours
      FROM public.nhat_ky_su_dung nk
      WHERE nk.thiet_bi_id = p_thiet_bi_id
        AND nk.thoi_gian_bat_dau >= v_cutoff
    ),
    condition_agg AS (
      SELECT
        COALESCE(NULLIF(BTRIM(tinh_trang_thiet_bi), ''), 'Không xác định') AS condition,
        COUNT(*)::BIGINT AS cnt
      FROM usage_data
      GROUP BY 1
    ),
    last_30 AS (
      SELECT COUNT(*)::BIGINT AS c FROM public.nhat_ky_su_dung nk
      WHERE nk.thiet_bi_id = p_thiet_bi_id
        AND nk.thoi_gian_bat_dau >= NOW() - INTERVAL '30 days'
    ),
    last_90 AS (
      SELECT COUNT(*)::BIGINT AS c FROM public.nhat_ky_su_dung nk
      WHERE nk.thiet_bi_id = p_thiet_bi_id
        AND nk.thoi_gian_bat_dau >= NOW() - INTERVAL '90 days'
    )
    SELECT jsonb_build_object(
      'thiet_bi_id', p_thiet_bi_id,
      'total_sessions', COALESCE((SELECT COUNT(*)::BIGINT FROM usage_data), 0),
      'avg_duration_hours', COALESCE((SELECT ROUND(AVG(duration_hours)::NUMERIC, 2) FROM usage_data WHERE duration_hours IS NOT NULL), 0),
      'sessions_last_30_days', COALESCE((SELECT c FROM last_30), 0),
      'sessions_last_90_days', COALESCE((SELECT c FROM last_90), 0),
      'condition_counts', COALESCE((SELECT jsonb_object_agg(condition, cnt) FROM condition_agg), '{}'::JSONB),
      'earliest_session', (SELECT MIN(thoi_gian_bat_dau)::DATE FROM usage_data),
      'latest_session', (SELECT MAX(thoi_gian_bat_dau)::DATE FROM usage_data),
      'months_range', v_months
    )
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ai_usage_summary(BIGINT, INTEGER, BIGINT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.ai_usage_summary(BIGINT, INTEGER, BIGINT, TEXT) FROM PUBLIC;

-- ════════════════════════════════════════════════════════════════════
-- 2. ai_attachment_metadata  (latent: same param naming issue)
-- ════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.ai_attachment_metadata(BIGINT, BIGINT, TEXT);

CREATE OR REPLACE FUNCTION public.ai_attachment_metadata(
  p_thiet_bi_id BIGINT,
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
  v_equip_don_vi BIGINT;
BEGIN
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;
  IF v_role = 'admin' THEN v_role := 'global'; END IF;
  v_is_global := (v_role = 'global');
  IF NOT v_is_global AND v_don_vi IS NULL THEN
    RAISE EXCEPTION 'Missing don_vi claim' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NOT NULL
     AND NULLIF(BTRIM(p_user_id), '') IS NOT NULL
     AND BTRIM(p_user_id) IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'user_id claim mismatch' USING ERRCODE = '42501';
  END IF;

  IF p_thiet_bi_id IS NULL OR p_thiet_bi_id <= 0 THEN
    RETURN jsonb_build_object('error', 'Invalid thiet_bi_id', 'thiet_bi_id', p_thiet_bi_id);
  END IF;

  IF v_is_global THEN
    IF p_don_vi IS NULL THEN
      RETURN jsonb_build_object('error', 'Facility selection required', 'thiet_bi_id', p_thiet_bi_id);
    END IF;
  ELSIF v_role = 'regional_leader' THEN
    v_allowed := public.allowed_don_vi_for_session_safe();
    IF v_allowed IS NULL OR cardinality(v_allowed) = 0 THEN
      RETURN jsonb_build_object('error', 'No accessible facilities', 'thiet_bi_id', p_thiet_bi_id);
    END IF;
    IF p_don_vi IS NULL THEN
      RETURN jsonb_build_object('error', 'Facility selection required', 'thiet_bi_id', p_thiet_bi_id);
    END IF;
    IF NOT (p_don_vi = ANY(v_allowed)) THEN
      RETURN jsonb_build_object('error', 'Access denied for selected facility', 'thiet_bi_id', p_thiet_bi_id);
    END IF;
  END IF;

  SELECT tb.don_vi INTO v_equip_don_vi
  FROM public.thiet_bi tb
  WHERE tb.id = p_thiet_bi_id
    AND tb.is_deleted = FALSE
    AND (CASE WHEN v_is_global THEN tb.don_vi = p_don_vi WHEN v_role = 'regional_leader' THEN tb.don_vi = p_don_vi ELSE tb.don_vi = v_don_vi END);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Equipment not found or not accessible', 'thiet_bi_id', p_thiet_bi_id);
  END IF;

  RETURN (
    WITH full_count AS (
      SELECT COUNT(*)::BIGINT AS cnt
      FROM public.file_dinh_kem f
      WHERE f.thiet_bi_id = p_thiet_bi_id
    ),
    attachments AS (
      SELECT
        f.id,
        f.ten_file,
        CASE WHEN f.duong_dan_luu_tru ~* '^https?://' THEN 'external_url' ELSE 'storage_path' END AS access_type,
        CASE WHEN f.duong_dan_luu_tru ~* '^https?://' THEN f.duong_dan_luu_tru ELSE NULL END AS url,
        f.ngay_tai_len
      FROM public.file_dinh_kem f
      WHERE f.thiet_bi_id = p_thiet_bi_id
      ORDER BY f.ngay_tai_len DESC NULLS LAST
      LIMIT 20
    )
    SELECT jsonb_build_object(
      'kind', 'attachmentMetadata',
      'thiet_bi_id', p_thiet_bi_id,
      'attachments', COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('id', a.id, 'ten_file', a.ten_file, 'access_type', a.access_type, 'url', a.url, 'ngay_tai_len', a.ngay_tai_len) ORDER BY a.ngay_tai_len DESC NULLS LAST) FROM attachments a),
        '[]'::JSONB
      ),
      'total_count', (SELECT cnt FROM full_count)
    )
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ai_attachment_metadata(BIGINT, BIGINT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.ai_attachment_metadata(BIGINT, BIGINT, TEXT) FROM PUBLIC;

-- ════════════════════════════════════════════════════════════════════
-- 3. ai_device_quota_lookup  (latent: same param naming issue)
-- ════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.ai_device_quota_lookup(BIGINT, BIGINT, TEXT);

CREATE OR REPLACE FUNCTION public.ai_device_quota_lookup(
  p_thiet_bi_id BIGINT,
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

  v_equip_don_vi BIGINT;
  v_equip_ma TEXT;
  v_equip_ten TEXT;
  v_equip_nhom_id BIGINT;

  v_decision_id BIGINT;
  v_decision_so TEXT;
  v_decision_trang_thai TEXT;
  v_decision_ngay_hieu_luc DATE;

  v_category_id BIGINT;
  v_category_ma TEXT;
  v_category_ten TEXT;

  v_quota_max INT;
  v_quota_min INT;
  v_current_count BIGINT;
BEGIN
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

  IF p_thiet_bi_id IS NULL OR p_thiet_bi_id <= 0 THEN
    RETURN jsonb_build_object(
      'kind', 'deviceQuotaLookup',
      'error', 'Invalid thiet_bi_id',
      'thiet_bi_id', p_thiet_bi_id
    );
  END IF;

  IF v_is_global THEN
    IF p_don_vi IS NULL THEN
      RETURN jsonb_build_object('kind', 'deviceQuotaLookup', 'error', 'Facility selection required');
    END IF;
  ELSIF v_role = 'regional_leader' THEN
    v_allowed := public.allowed_don_vi_for_session_safe();
    IF v_allowed IS NULL OR cardinality(v_allowed) = 0 THEN
      RETURN jsonb_build_object('kind', 'deviceQuotaLookup', 'error', 'No accessible facilities');
    END IF;
    IF p_don_vi IS NULL THEN
      RETURN jsonb_build_object('kind', 'deviceQuotaLookup', 'error', 'Facility selection required');
    END IF;
    IF NOT (p_don_vi = ANY(v_allowed)) THEN
      RETURN jsonb_build_object('kind', 'deviceQuotaLookup', 'error', 'Access denied for selected facility');
    END IF;
  END IF;

  SELECT tb.don_vi, tb.ma_thiet_bi, tb.ten_thiet_bi, tb.nhom_thiet_bi_id
  INTO v_equip_don_vi, v_equip_ma, v_equip_ten, v_equip_nhom_id
  FROM public.thiet_bi tb
  WHERE tb.id = p_thiet_bi_id
    AND tb.is_deleted = FALSE
    AND (
      CASE
        WHEN v_is_global THEN tb.don_vi = p_don_vi
        WHEN v_role = 'regional_leader' THEN tb.don_vi = p_don_vi
        ELSE tb.don_vi = v_don_vi
      END
    );

  IF NOT FOUND THEN
    RETURN jsonb_build_object('kind', 'deviceQuotaLookup', 'error', 'Equipment not found or not accessible', 'thiet_bi_id', p_thiet_bi_id);
  END IF;

  SELECT qd.id, qd.so_quyet_dinh, qd.trang_thai, qd.ngay_hieu_luc
  INTO v_decision_id, v_decision_so, v_decision_trang_thai, v_decision_ngay_hieu_luc
  FROM public.quyet_dinh_dinh_muc qd
  WHERE qd.don_vi_id = v_equip_don_vi
    AND qd.trang_thai = 'active'
  ORDER BY qd.ngay_hieu_luc DESC NULLS LAST, qd.id DESC
  LIMIT 1;

  IF v_decision_id IS NULL THEN
    RETURN jsonb_build_object(
      'kind', 'deviceQuotaLookup',
      'device', jsonb_build_object('id', p_thiet_bi_id, 'ma_thiet_bi', v_equip_ma, 'ten_thiet_bi', v_equip_ten),
      'status', 'insufficientEvidence',
      'scope', jsonb_build_object('mode', 'facility', 'don_vi_id', v_equip_don_vi),
      'reason', 'No active quota decision found for this facility',
      'evidence_status', 'none'
    );
  END IF;

  IF v_equip_nhom_id IS NULL THEN
    RETURN jsonb_build_object(
      'kind', 'deviceQuotaLookup',
      'device', jsonb_build_object('id', p_thiet_bi_id, 'ma_thiet_bi', v_equip_ma, 'ten_thiet_bi', v_equip_ten),
      'status', 'notMapped',
      'scope', jsonb_build_object('mode', 'facility', 'don_vi_id', v_equip_don_vi),
      'decision', jsonb_build_object('id', v_decision_id, 'so_quyet_dinh', v_decision_so, 'trang_thai', v_decision_trang_thai, 'ngay_hieu_luc', v_decision_ngay_hieu_luc),
      'evidence_status', 'partial'
    );
  END IF;

  SELECT ntb.id, ntb.ma_nhom, ntb.ten_nhom
  INTO v_category_id, v_category_ma, v_category_ten
  FROM public.nhom_thiet_bi ntb
  WHERE ntb.id = v_equip_nhom_id
    AND ntb.don_vi_id = v_equip_don_vi;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'kind', 'deviceQuotaLookup',
      'device', jsonb_build_object('id', p_thiet_bi_id, 'ma_thiet_bi', v_equip_ma, 'ten_thiet_bi', v_equip_ten),
      'status', 'insufficientEvidence',
      'scope', jsonb_build_object('mode', 'facility', 'don_vi_id', v_equip_don_vi),
      'reason', 'Category metadata not found for equipment group',
      'decision', jsonb_build_object('id', v_decision_id, 'so_quyet_dinh', v_decision_so, 'trang_thai', v_decision_trang_thai, 'ngay_hieu_luc', v_decision_ngay_hieu_luc),
      'evidence_status', 'partial'
    );
  END IF;

  SELECT cd.so_luong_toi_da, cd.so_luong_toi_thieu
  INTO v_quota_max, v_quota_min
  FROM public.chi_tiet_dinh_muc cd
  WHERE cd.quyet_dinh_id = v_decision_id
    AND cd.nhom_thiet_bi_id = v_equip_nhom_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'kind', 'deviceQuotaLookup',
      'device', jsonb_build_object('id', p_thiet_bi_id, 'ma_thiet_bi', v_equip_ma, 'ten_thiet_bi', v_equip_ten),
      'status', 'notInApprovedCatalog',
      'scope', jsonb_build_object('mode', 'facility', 'don_vi_id', v_equip_don_vi),
      'decision', jsonb_build_object('id', v_decision_id, 'so_quyet_dinh', v_decision_so, 'trang_thai', v_decision_trang_thai, 'ngay_hieu_luc', v_decision_ngay_hieu_luc),
      'category', jsonb_build_object('id', v_category_id, 'ma_nhom', v_category_ma, 'ten_nhom', v_category_ten),
      'evidence_status', 'partial'
    );
  END IF;

  SELECT COUNT(*)::BIGINT INTO v_current_count
  FROM public.thiet_bi tb
  WHERE tb.nhom_thiet_bi_id = v_equip_nhom_id
    AND tb.don_vi = v_equip_don_vi
    AND tb.is_deleted = FALSE;

  RETURN jsonb_build_object(
    'kind', 'deviceQuotaLookup',
    'device', jsonb_build_object('id', p_thiet_bi_id, 'ma_thiet_bi', v_equip_ma, 'ten_thiet_bi', v_equip_ten),
    'status', 'inQuotaCatalog',
    'scope', jsonb_build_object('mode', 'facility', 'don_vi_id', v_equip_don_vi),
    'decision', jsonb_build_object('id', v_decision_id, 'so_quyet_dinh', v_decision_so, 'trang_thai', v_decision_trang_thai, 'ngay_hieu_luc', v_decision_ngay_hieu_luc),
    'category', jsonb_build_object('id', v_category_id, 'ma_nhom', v_category_ma, 'ten_nhom', v_category_ten),
    'quota', jsonb_build_object(
      'so_luong_toi_da', v_quota_max,
      'so_luong_toi_thieu', v_quota_min,
      'so_luong_hien_co', v_current_count,
      'remaining', GREATEST(v_quota_max - v_current_count, 0)
    ),
    'evidence_status', 'complete'
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ai_device_quota_lookup(BIGINT, BIGINT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.ai_device_quota_lookup(BIGINT, BIGINT, TEXT) FROM PUBLIC;

-- ════════════════════════════════════════════════════════════════════
-- 4. ai_maintenance_plan_lookup  (latent: same param naming issue)
-- ════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.ai_maintenance_plan_lookup(BIGINT, INTEGER, BIGINT, TEXT);

CREATE OR REPLACE FUNCTION public.ai_maintenance_plan_lookup(
  p_thiet_bi_id BIGINT,
  p_nam INTEGER DEFAULT NULL,
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
  v_effective BIGINT[] := NULL;
  v_is_global BOOLEAN := FALSE;
BEGIN
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF p_thiet_bi_id IS NULL OR p_thiet_bi_id <= 0 THEN
    RAISE EXCEPTION 'thiet_bi_id is required' USING ERRCODE = '22023';
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

  IF v_is_global THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    END IF;
  ELSIF v_role = 'regional_leader' THEN
    v_allowed := public.allowed_don_vi_for_session_safe();
    IF v_allowed IS NULL OR cardinality(v_allowed) = 0 THEN
      RETURN jsonb_build_object('equipment', NULL, 'plans', '[]'::JSONB, 'totalPlans', 0, 'yearFilter', p_nam);
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF NOT (p_don_vi = ANY(v_allowed)) THEN
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := v_allowed;
    END IF;
  ELSE
    IF p_don_vi IS NOT NULL AND p_don_vi IS DISTINCT FROM v_don_vi THEN
      RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
    END IF;
    v_effective := ARRAY[v_don_vi];
  END IF;

  RETURN (
    WITH rows AS (
      SELECT
        kh.id AS plan_id,
        kh.ten_ke_hoach,
        kh.nam,
        kh.loai_cong_viec,
        kh.trang_thai AS plan_trang_thai,
        kh.ngay_phe_duyet,
        cv.id AS task_id,
        cv.don_vi_thuc_hien,
        cv.diem_hieu_chuan,
        cv.thang_1, cv.thang_2, cv.thang_3,
        cv.thang_4, cv.thang_5, cv.thang_6,
        cv.thang_7, cv.thang_8, cv.thang_9,
        cv.thang_10, cv.thang_11, cv.thang_12,
        cv.thang_1_hoan_thanh, cv.thang_2_hoan_thanh, cv.thang_3_hoan_thanh,
        cv.thang_4_hoan_thanh, cv.thang_5_hoan_thanh, cv.thang_6_hoan_thanh,
        cv.thang_7_hoan_thanh, cv.thang_8_hoan_thanh, cv.thang_9_hoan_thanh,
        cv.thang_10_hoan_thanh, cv.thang_11_hoan_thanh, cv.thang_12_hoan_thanh,
        cv.ghi_chu,
        tb.id AS equipment_id,
        tb.ma_thiet_bi,
        tb.ten_thiet_bi,
        tb.model,
        tb.don_vi
      FROM public.cong_viec_bao_tri cv
      JOIN public.ke_hoach_bao_tri kh ON kh.id = cv.ke_hoach_id
      JOIN public.thiet_bi tb ON tb.id = cv.thiet_bi_id
      WHERE cv.thiet_bi_id = p_thiet_bi_id
        AND (p_nam IS NULL OR kh.nam = p_nam)
        AND tb.is_deleted = FALSE
        AND (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
    )
    SELECT jsonb_build_object(
      'equipment',
      (
        SELECT jsonb_build_object(
          'id', equipment_id, 'ma_thiet_bi', ma_thiet_bi,
          'ten_thiet_bi', ten_thiet_bi, 'model', model, 'don_vi', don_vi
        )
        FROM rows
        LIMIT 1
      ),
      'plans',
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'plan_id', plan_id, 'ten_ke_hoach', ten_ke_hoach, 'nam', nam,
              'loai_cong_viec', loai_cong_viec, 'plan_trang_thai', plan_trang_thai,
              'ngay_phe_duyet', ngay_phe_duyet, 'task_id', task_id,
              'don_vi_thuc_hien', don_vi_thuc_hien, 'diem_hieu_chuan', diem_hieu_chuan,
              'thang_1', thang_1, 'thang_2', thang_2, 'thang_3', thang_3,
              'thang_4', thang_4, 'thang_5', thang_5, 'thang_6', thang_6,
              'thang_7', thang_7, 'thang_8', thang_8, 'thang_9', thang_9,
              'thang_10', thang_10, 'thang_11', thang_11, 'thang_12', thang_12,
              'thang_1_hoan_thanh', thang_1_hoan_thanh, 'thang_2_hoan_thanh', thang_2_hoan_thanh, 'thang_3_hoan_thanh', thang_3_hoan_thanh,
              'thang_4_hoan_thanh', thang_4_hoan_thanh, 'thang_5_hoan_thanh', thang_5_hoan_thanh, 'thang_6_hoan_thanh', thang_6_hoan_thanh,
              'thang_7_hoan_thanh', thang_7_hoan_thanh, 'thang_8_hoan_thanh', thang_8_hoan_thanh, 'thang_9_hoan_thanh', thang_9_hoan_thanh,
              'thang_10_hoan_thanh', thang_10_hoan_thanh, 'thang_11_hoan_thanh', thang_11_hoan_thanh, 'thang_12_hoan_thanh', thang_12_hoan_thanh,
              'ghi_chu', ghi_chu
            )
            ORDER BY nam DESC, loai_cong_viec, plan_id, task_id
          )
          FROM rows
        ),
        '[]'::JSONB
      ),
      'totalPlans', COALESCE((SELECT COUNT(DISTINCT plan_id)::BIGINT FROM rows), 0),
      'yearFilter', p_nam
    )
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ai_maintenance_plan_lookup(BIGINT, INTEGER, BIGINT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.ai_maintenance_plan_lookup(BIGINT, INTEGER, BIGINT, TEXT) FROM PUBLIC;

COMMIT;
