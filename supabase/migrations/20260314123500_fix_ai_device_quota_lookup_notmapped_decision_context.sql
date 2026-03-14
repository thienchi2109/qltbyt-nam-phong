-- Preserve active decision context for device quota lookups even when the
-- device is not yet mapped to a quota category. This prevents the assistant
-- from inferring "no active decision" solely from a notMapped result.

BEGIN;

CREATE OR REPLACE FUNCTION public.ai_device_quota_lookup(
  thiet_bi_id BIGINT,
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

  IF ai_device_quota_lookup.thiet_bi_id IS NULL
     OR ai_device_quota_lookup.thiet_bi_id <= 0 THEN
    RETURN jsonb_build_object(
      'kind', 'deviceQuotaLookup',
      'error', 'Invalid thiet_bi_id',
      'thiet_bi_id', ai_device_quota_lookup.thiet_bi_id
    );
  END IF;

  IF v_is_global THEN
    IF p_don_vi IS NULL THEN
      RETURN jsonb_build_object(
        'kind', 'deviceQuotaLookup',
        'error', 'Facility selection required'
      );
    END IF;
  ELSIF v_role = 'regional_leader' THEN
    v_allowed := public.allowed_don_vi_for_session_safe();
    IF v_allowed IS NULL OR cardinality(v_allowed) = 0 THEN
      RETURN jsonb_build_object(
        'kind', 'deviceQuotaLookup',
        'error', 'No accessible facilities'
      );
    END IF;
    IF p_don_vi IS NULL THEN
      RETURN jsonb_build_object(
        'kind', 'deviceQuotaLookup',
        'error', 'Facility selection required'
      );
    END IF;
    IF NOT (p_don_vi = ANY(v_allowed)) THEN
      RETURN jsonb_build_object(
        'kind', 'deviceQuotaLookup',
        'error', 'Access denied for selected facility'
      );
    END IF;
  END IF;

  SELECT tb.don_vi, tb.ma_thiet_bi, tb.ten_thiet_bi, tb.nhom_thiet_bi_id
  INTO v_equip_don_vi, v_equip_ma, v_equip_ten, v_equip_nhom_id
  FROM public.thiet_bi tb
  WHERE tb.id = ai_device_quota_lookup.thiet_bi_id
    AND tb.is_deleted = FALSE
    AND (
      CASE
        WHEN v_is_global THEN tb.don_vi = p_don_vi
        WHEN v_role = 'regional_leader' THEN tb.don_vi = p_don_vi
        ELSE tb.don_vi = v_don_vi
      END
    );

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'kind', 'deviceQuotaLookup',
      'error', 'Equipment not found or not accessible',
      'thiet_bi_id', ai_device_quota_lookup.thiet_bi_id
    );
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
      'device', jsonb_build_object(
        'id', ai_device_quota_lookup.thiet_bi_id,
        'ma_thiet_bi', v_equip_ma,
        'ten_thiet_bi', v_equip_ten
      ),
      'status', 'insufficientEvidence',
      'scope', jsonb_build_object('mode', 'facility', 'don_vi_id', v_equip_don_vi),
      'reason', 'No active quota decision found for this facility',
      'evidence_status', 'none'
    );
  END IF;

  IF v_equip_nhom_id IS NULL THEN
    RETURN jsonb_build_object(
      'kind', 'deviceQuotaLookup',
      'device', jsonb_build_object(
        'id', ai_device_quota_lookup.thiet_bi_id,
        'ma_thiet_bi', v_equip_ma,
        'ten_thiet_bi', v_equip_ten
      ),
      'status', 'notMapped',
      'scope', jsonb_build_object('mode', 'facility', 'don_vi_id', v_equip_don_vi),
      'decision', jsonb_build_object(
        'id', v_decision_id,
        'so_quyet_dinh', v_decision_so,
        'trang_thai', v_decision_trang_thai,
        'ngay_hieu_luc', v_decision_ngay_hieu_luc
      ),
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
      'device', jsonb_build_object(
        'id', ai_device_quota_lookup.thiet_bi_id,
        'ma_thiet_bi', v_equip_ma,
        'ten_thiet_bi', v_equip_ten
      ),
      'status', 'insufficientEvidence',
      'scope', jsonb_build_object('mode', 'facility', 'don_vi_id', v_equip_don_vi),
      'reason', 'Category metadata not found for equipment group',
      'decision', jsonb_build_object(
        'id', v_decision_id,
        'so_quyet_dinh', v_decision_so,
        'trang_thai', v_decision_trang_thai,
        'ngay_hieu_luc', v_decision_ngay_hieu_luc
      ),
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
      'device', jsonb_build_object(
        'id', ai_device_quota_lookup.thiet_bi_id,
        'ma_thiet_bi', v_equip_ma,
        'ten_thiet_bi', v_equip_ten
      ),
      'status', 'notInApprovedCatalog',
      'scope', jsonb_build_object('mode', 'facility', 'don_vi_id', v_equip_don_vi),
      'decision', jsonb_build_object(
        'id', v_decision_id,
        'so_quyet_dinh', v_decision_so,
        'trang_thai', v_decision_trang_thai,
        'ngay_hieu_luc', v_decision_ngay_hieu_luc
      ),
      'category', jsonb_build_object(
        'id', v_category_id,
        'ma_nhom', v_category_ma,
        'ten_nhom', v_category_ten
      ),
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
    'device', jsonb_build_object(
      'id', ai_device_quota_lookup.thiet_bi_id,
      'ma_thiet_bi', v_equip_ma,
      'ten_thiet_bi', v_equip_ten
    ),
    'status', 'inQuotaCatalog',
    'scope', jsonb_build_object('mode', 'facility', 'don_vi_id', v_equip_don_vi),
    'decision', jsonb_build_object(
      'id', v_decision_id,
      'so_quyet_dinh', v_decision_so,
      'trang_thai', v_decision_trang_thai,
      'ngay_hieu_luc', v_decision_ngay_hieu_luc
    ),
    'category', jsonb_build_object(
      'id', v_category_id,
      'ma_nhom', v_category_ma,
      'ten_nhom', v_category_ten
    ),
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

COMMIT;
