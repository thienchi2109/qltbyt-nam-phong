-- Fix header notification counts to respect explicit facility scope.
-- The UI passes p_don_vi when a privileged user selects a facility.

BEGIN;

CREATE OR REPLACE FUNCTION public.header_notifications_summary(
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jwt_claims JSONB;
  v_role TEXT;
  v_user_id TEXT;
  v_is_global BOOLEAN := FALSE;
  v_allowed_don_vi BIGINT[];
  v_filter_don_vi BIGINT := NULL;
  v_repairs BIGINT := 0;
  v_transfers BIGINT := 0;
BEGIN
  v_jwt_claims := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  v_role := lower(COALESCE(v_jwt_claims->>'app_role', v_jwt_claims->>'role', ''));
  v_user_id := NULLIF(COALESCE(v_jwt_claims->>'user_id', v_jwt_claims->>'sub'), '');

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;
  v_is_global := v_role = 'global';

  IF NOT v_is_global THEN
    v_allowed_don_vi := public.allowed_don_vi_for_session_safe();

    IF v_allowed_don_vi IS NULL OR array_length(v_allowed_don_vi, 1) IS NULL THEN
      RETURN jsonb_build_object('pending_repairs', 0, 'pending_transfers', 0);
    END IF;

    IF p_don_vi IS NOT NULL AND NOT (p_don_vi = ANY(v_allowed_don_vi)) THEN
      RETURN jsonb_build_object('pending_repairs', 0, 'pending_transfers', 0);
    END IF;
  END IF;

  IF p_don_vi IS NOT NULL THEN
    v_filter_don_vi := p_don_vi;
  END IF;

  SELECT COUNT(*) INTO v_repairs
  FROM public.yeu_cau_sua_chua r
  LEFT JOIN public.thiet_bi tb ON tb.id = r.thiet_bi_id
  WHERE r.trang_thai IN ('Chờ xử lý', 'Đã duyệt')
    AND (
      (v_filter_don_vi IS NOT NULL AND tb.don_vi = v_filter_don_vi)
      OR (v_filter_don_vi IS NULL AND v_is_global)
      OR (v_filter_don_vi IS NULL AND NOT v_is_global AND tb.don_vi = ANY(v_allowed_don_vi))
    );

  SELECT COUNT(*) INTO v_transfers
  FROM public.yeu_cau_luan_chuyen t
  LEFT JOIN public.thiet_bi tb ON tb.id = t.thiet_bi_id
  WHERE t.trang_thai IN ('cho_duyet', 'da_duyet')
    AND (
      (v_filter_don_vi IS NOT NULL AND tb.don_vi = v_filter_don_vi)
      OR (v_filter_don_vi IS NULL AND v_is_global)
      OR (v_filter_don_vi IS NULL AND NOT v_is_global AND tb.don_vi = ANY(v_allowed_don_vi))
    );

  RETURN jsonb_build_object(
    'pending_repairs', COALESCE(v_repairs, 0),
    'pending_transfers', COALESCE(v_transfers, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.header_notifications_summary(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.header_notifications_summary(BIGINT) FROM PUBLIC;

COMMENT ON FUNCTION public.header_notifications_summary(BIGINT) IS
  'Returns pending repair/transfer notification counts for the current JWT scope; p_don_vi narrows counts to an authorized selected facility.';

COMMIT;
