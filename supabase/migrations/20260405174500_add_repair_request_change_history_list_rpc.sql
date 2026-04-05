-- Add tenant-safe repair request history RPC for Issue #205.
-- Purpose: expose audit-log-backed history to repair detail tabs without
-- widening the global-only audit_logs_list_v2 read path.

BEGIN;

CREATE OR REPLACE FUNCTION public.repair_request_change_history_list(p_repair_request_id INT)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jwt_claims JSONB := COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role TEXT;
  v_user_id TEXT;
  v_don_vi BIGINT;
  v_is_global BOOLEAN := FALSE;
  v_allowed BIGINT[] := NULL;
  v_request_don_vi BIGINT;
BEGIN
  IF p_repair_request_id IS NULL THEN
    RETURN;
  END IF;

  v_role := lower(COALESCE(
    NULLIF(v_jwt_claims->>'app_role', ''),
    NULLIF(v_jwt_claims->>'role', ''),
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

  SELECT tb.don_vi
  INTO v_request_don_vi
  FROM public.yeu_cau_sua_chua ycss
  JOIN public.thiet_bi tb ON tb.id = ycss.thiet_bi_id
  WHERE ycss.id = p_repair_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yêu cầu sửa chữa không tồn tại hoặc bạn không có quyền truy cập'
      USING ERRCODE = '42501';
  END IF;

  IF NOT v_is_global THEN
    v_allowed := public.allowed_don_vi_for_session();

    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Yêu cầu sửa chữa không tồn tại hoặc bạn không có quyền truy cập'
        USING ERRCODE = '42501';
    END IF;

    IF v_request_don_vi IS NULL OR NOT (v_request_don_vi = ANY(v_allowed)) THEN
      RAISE EXCEPTION 'Yêu cầu sửa chữa không tồn tại hoặc bạn không có quyền truy cập'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object(
    'id', al.id,
    'action_type', al.action_type,
    'admin_username', al.admin_username,
    'admin_full_name', COALESCE(admin_user.full_name, al.admin_username),
    'action_details', al.action_details,
    'created_at', al.created_at
  )
  FROM public.audit_logs al
  LEFT JOIN public.nhan_vien admin_user ON admin_user.id = al.admin_user_id
  WHERE al.entity_type = 'repair_request'
    AND al.entity_id = p_repair_request_id
  ORDER BY al.created_at DESC, al.id DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.repair_request_change_history_list(INT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.repair_request_change_history_list(INT) FROM PUBLIC;

COMMENT ON FUNCTION public.repair_request_change_history_list(INT) IS
'Lists repair-request audit history with the same tenant access semantics as repair_request_get.';

NOTIFY pgrst, 'reload schema';

COMMIT;
