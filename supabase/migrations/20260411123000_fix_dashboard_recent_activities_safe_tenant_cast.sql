-- Fix dashboard_recent_activities after initial deploy.
-- - Fail closed on non-numeric audit_logs.tenant_don_vi values
-- - Remove unsupported maintenance_plan_approve activity taxonomy
-- - Reload PostgREST schema after replacing the RPC

BEGIN;

CREATE OR REPLACE FUNCTION public.dashboard_recent_activities(
  p_limit INT DEFAULT 15
)
RETURNS TABLE (
  activity_id   BIGINT,
  action_type   TEXT,
  action_label  TEXT,
  entity_type   TEXT,
  entity_label  TEXT,
  actor_name    TEXT,
  facility_name TEXT,
  occurred_at   TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role       TEXT := lower(COALESCE(
                        public._get_jwt_claim('app_role'),
                        public._get_jwt_claim('role'),
                        ''));
  v_user_id    TEXT := NULLIF(COALESCE(
                        public._get_jwt_claim('user_id'),
                        public._get_jwt_claim('sub')),
                        '');
  v_don_vi     BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_is_global  BOOLEAN;
  v_allowed    BIGINT[];
  v_safe_limit INT;
BEGIN
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  v_is_global := v_role IN ('global', 'admin');

  IF NOT v_is_global THEN
    IF v_role <> 'regional_leader' AND v_don_vi IS NULL THEN
      RAISE EXCEPTION 'Missing don_vi claim' USING ERRCODE = '42501';
    END IF;

    v_allowed := public.allowed_don_vi_for_session_safe();

    IF array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;
  END IF;

  v_safe_limit := LEAST(GREATEST(COALESCE(p_limit, 15), 1), 50);

  RETURN QUERY
  SELECT
    al.id AS activity_id,
    al.action_type AS action_type,
    CASE al.action_type
      WHEN 'repair_request_create' THEN 'Tạo yêu cầu sửa chữa'
      WHEN 'repair_request_update' THEN 'Cập nhật yêu cầu sửa chữa'
      WHEN 'repair_request_approve' THEN 'Phê duyệt sửa chữa'
      WHEN 'repair_request_complete' THEN 'Hoàn thành sửa chữa'
      WHEN 'transfer_request_create' THEN 'Tạo yêu cầu luân chuyển'
      WHEN 'transfer_request_update' THEN 'Cập nhật yêu cầu luân chuyển'
      WHEN 'transfer_request_update_status' THEN 'Cập nhật trạng thái luân chuyển'
      WHEN 'transfer_request_complete' THEN 'Hoàn thành luân chuyển'
      WHEN 'maintenance_plan_create' THEN 'Tạo kế hoạch bảo trì'
      WHEN 'equipment_create' THEN 'Thêm thiết bị mới'
      ELSE al.action_type
    END AS action_label,
    al.entity_type AS entity_type,
    al.entity_label AS entity_label,
    COALESCE(nv.full_name, al.admin_username) AS actor_name,
    dv.name AS facility_name,
    al.created_at AS occurred_at
  FROM public.audit_logs al
  LEFT JOIN public.nhan_vien nv
    ON nv.id = al.admin_user_id
  LEFT JOIN public.don_vi dv
    ON dv.id = CASE
      WHEN NULLIF(al.tenant_don_vi, '') ~ '^[0-9]+$'
        THEN NULLIF(al.tenant_don_vi, '')::BIGINT
      ELSE NULL
    END
  WHERE al.action_type IN (
    'repair_request_create',
    'repair_request_update',
    'repair_request_approve',
    'repair_request_complete',
    'transfer_request_create',
    'transfer_request_update',
    'transfer_request_update_status',
    'transfer_request_complete',
    'maintenance_plan_create',
    'equipment_create'
  )
    AND al.created_at >= NOW() - INTERVAL '30 days'
    AND (
      v_is_global
      OR (
        NULLIF(al.tenant_don_vi, '') ~ '^[0-9]+$'
        AND NULLIF(al.tenant_don_vi, '')::BIGINT = ANY(v_allowed)
      )
    )
  ORDER BY al.created_at DESC
  LIMIT v_safe_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_recent_activities(INT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.dashboard_recent_activities(INT) FROM PUBLIC;

COMMENT ON FUNCTION public.dashboard_recent_activities(INT) IS
'Returns recent notable activities from audit_logs for the dashboard feed widget. '
'Tenant-isolated via JWT claims and allowed_don_vi_for_session_safe(). '
'Invalid or non-numeric tenant_don_vi audit rows stay visible only to global users. '
'Supports global, single-tenant, and regional_leader (multi-tenant via dia_ban) roles.';

NOTIFY pgrst, 'reload schema';

COMMIT;
