-- 20250925_audit_logs_v2_backfill_user_entity.sql
-- Purpose: Backfill legacy user-related logs with entity_type='user' and update list API for compatibility
-- Notes:
-- - Idempotent and transactional
-- - Does not remove or overwrite newer entity_type values

BEGIN;

-- 1) Backfill where target_user_id is present (most user ops)
UPDATE public.audit_logs AS al
SET 
  entity_type = 'user',
  entity_id   = COALESCE(al.entity_id, al.target_user_id),
  entity_label = COALESCE(al.entity_label, nv.full_name, al.target_username)
FROM public.nhan_vien nv
WHERE al.entity_type IS NULL
  AND al.target_user_id IS NOT NULL
  AND nv.id = al.target_user_id;

-- 2) Backfill where target_user_id is NULL but action_type indicates a user event (login/logout/password/admin ops)
-- Keep the action list aligned with UI labels and current taxonomy
UPDATE public.audit_logs AS al
SET 
  entity_type = 'user',
  entity_id   = COALESCE(al.entity_id, al.admin_user_id),
  entity_label = COALESCE(al.entity_label, nv.full_name, al.admin_username)
FROM public.nhan_vien nv
WHERE al.entity_type IS NULL
  AND al.target_user_id IS NULL
  AND al.action_type IN (
    'password_change',
    'password_reset_admin',
    'USER_UPDATE',
    'user_create',
    'user_delete',
    'user_role_change',
    'login_success',
    'login_failed',
    'logout'
  )
  AND nv.id = al.admin_user_id;

-- 3) Update audit_logs_list_v2 to include compatibility fallback for legacy rows
--    When p_entity_type = 'user', also include rows where entity_type IS NULL and they look like user events
CREATE OR REPLACE FUNCTION public.audit_logs_list_v2(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_user_id bigint DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_entity_id bigint DEFAULT NULL,
  p_action_type text DEFAULT NULL,
  p_text_search text DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_role TEXT;
  v_result json;
  v_total_count BIGINT := 0;
BEGIN
  v_user_role := current_setting('request.jwt.claims', true)::json->>'app_role';
  IF v_user_role IS DISTINCT FROM 'global' THEN
    RAISE EXCEPTION 'Access denied: Only global administrators can view audit logs' USING ERRCODE = '42501';
  END IF;

  IF p_limit < 1 OR p_limit > 200 THEN p_limit := 50; END IF;
  IF p_offset < 0 THEN p_offset := 0; END IF;

  -- Derived predicate for legacy user rows
  WITH params AS (
    SELECT p_entity_type = 'user' AS want_user
  )
  SELECT COUNT(*)
  INTO v_total_count
  FROM public.audit_logs al, params
  WHERE (p_user_id IS NULL OR al.admin_user_id = p_user_id)
    AND (
      p_entity_type IS NULL
      OR al.entity_type = p_entity_type
      OR (
        params.want_user
        AND al.entity_type IS NULL
        AND (
          al.target_user_id IS NOT NULL
          OR al.action_type IN (
            'password_change','password_reset_admin','USER_UPDATE','user_create','user_delete','user_role_change','login_success','login_failed','logout'
          )
        )
      )
    )
    AND (p_entity_id IS NULL OR al.entity_id = p_entity_id)
    AND (p_action_type IS NULL OR al.action_type ILIKE '%' || p_action_type || '%')
    AND (p_text_search IS NULL OR (al.entity_label ILIKE '%' || p_text_search || '%' OR al.action_details::text ILIKE '%' || p_text_search || '%'))
    AND (p_date_from IS NULL OR al.created_at >= p_date_from)
    AND (p_date_to IS NULL OR al.created_at <= p_date_to);

  WITH params AS (
    SELECT p_entity_type = 'user' AS want_user
  )
  SELECT json_agg(json_build_object(
    'id', al.id,
    'admin_user_id', al.admin_user_id,
    'admin_username', al.admin_username,
    'action_type', al.action_type,
    'entity_type', al.entity_type,
    'entity_id', al.entity_id,
    'entity_label', al.entity_label,
    'action_details', al.action_details,
    'ip_address', al.ip_address,
    'user_agent', al.user_agent,
    'created_at', al.created_at,
    'total_count', v_total_count
  ))
  INTO v_result
  FROM (
    SELECT *
    FROM public.audit_logs al, params
    WHERE (p_user_id IS NULL OR al.admin_user_id = p_user_id)
      AND (
        p_entity_type IS NULL
        OR al.entity_type = p_entity_type
        OR (
          params.want_user
          AND al.entity_type IS NULL
          AND (
            al.target_user_id IS NOT NULL
            OR al.action_type IN (
              'password_change','password_reset_admin','USER_UPDATE','user_create','user_delete','user_role_change','login_success','login_failed','logout'
            )
          )
        )
      )
      AND (p_entity_id IS NULL OR al.entity_id = p_entity_id)
      AND (p_action_type IS NULL OR al.action_type ILIKE '%' || p_action_type || '%')
      AND (p_text_search IS NULL OR (al.entity_label ILIKE '%' || p_text_search || '%' OR al.action_details::text ILIKE '%' || p_text_search || '%'))
      AND (p_date_from IS NULL OR al.created_at >= p_date_from)
      AND (p_date_to IS NULL OR al.created_at <= p_date_to)
    ORDER BY al.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) al;

  RETURN COALESCE(v_result, json_build_array());
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
