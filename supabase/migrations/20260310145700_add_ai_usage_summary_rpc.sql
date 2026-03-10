-- Add read-only AI usage summary RPC with strict JWT guardrails.
-- Aggregates usage logs from nhat_ky_su_dung for a specific equipment item.
--
-- Security: SECURITY DEFINER + pinned search_path, JWT claim guards,
-- tenant isolation via thiet_bi.don_vi, authenticated-only.

BEGIN;

DROP FUNCTION IF EXISTS public.ai_usage_summary(INTEGER, INTEGER, BIGINT, TEXT);

CREATE OR REPLACE FUNCTION public.ai_usage_summary(
  thiet_bi_id INTEGER,
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
  -- JWT claim guards
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

  -- Validate equipment exists and get its facility
  SELECT tb.don_vi INTO v_equip_don_vi
  FROM public.thiet_bi tb
  WHERE tb.id = thiet_bi_id AND tb.is_deleted = FALSE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'Equipment not found',
      'thiet_bi_id', thiet_bi_id
    );
  END IF;

  -- Tenant isolation check
  IF v_is_global THEN
    IF p_don_vi IS NOT NULL AND p_don_vi IS DISTINCT FROM v_equip_don_vi THEN
      RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
    END IF;
  ELSIF v_role = 'regional_leader' THEN
    v_allowed := public.allowed_don_vi_for_session_safe();
    IF v_allowed IS NULL OR cardinality(v_allowed) = 0 THEN
      RETURN jsonb_build_object(
        'error', 'No accessible facilities',
        'thiet_bi_id', thiet_bi_id
      );
    END IF;
    IF NOT (v_equip_don_vi = ANY(v_allowed)) THEN
      RAISE EXCEPTION 'Access denied for facility %', v_equip_don_vi USING ERRCODE = '42501';
    END IF;
  ELSE
    IF v_equip_don_vi IS DISTINCT FROM v_don_vi THEN
      RAISE EXCEPTION 'Access denied for facility %', v_equip_don_vi USING ERRCODE = '42501';
    END IF;
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
      WHERE nk.thiet_bi_id = ai_usage_summary.thiet_bi_id
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
      SELECT COUNT(*)::BIGINT AS c FROM usage_data
      WHERE thoi_gian_bat_dau >= NOW() - INTERVAL '30 days'
    ),
    last_90 AS (
      SELECT COUNT(*)::BIGINT AS c FROM usage_data
      WHERE thoi_gian_bat_dau >= NOW() - INTERVAL '90 days'
    )
    SELECT jsonb_build_object(
      'thiet_bi_id', ai_usage_summary.thiet_bi_id,
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

GRANT EXECUTE ON FUNCTION public.ai_usage_summary(INTEGER, INTEGER, BIGINT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.ai_usage_summary(INTEGER, INTEGER, BIGINT, TEXT) FROM PUBLIC;

COMMIT;
