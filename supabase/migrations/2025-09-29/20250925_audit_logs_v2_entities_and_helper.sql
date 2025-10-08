-- 20250925_audit_logs_v2_entities_and_helper.sql
-- Purpose: Extend audit logs schema with entity fields, add unified helper, add v2 list API, and harden function search_path
-- Notes:
-- - Idempotent and transactional
-- - Does NOT drop or destructively modify existing data
-- - Sets created_at to NOT NULL with default now()

BEGIN;

-- 1) Schema extensions for entity coverage
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id bigint,
  ADD COLUMN IF NOT EXISTS entity_label text,
  ADD COLUMN IF NOT EXISTS tenant_don_vi text;

-- Ensure created_at has DEFAULT and is NOT NULL (backfill first)
ALTER TABLE public.audit_logs
  ALTER COLUMN created_at SET DEFAULT now();

UPDATE public.audit_logs
SET created_at = now()
WHERE created_at IS NULL;

ALTER TABLE public.audit_logs
  ALTER COLUMN created_at SET NOT NULL;

-- 2) Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON public.audit_logs (entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type_id ON public.audit_logs (entity_type, entity_id);

-- 3) Harden search_path on audit functions by re-creating with SET search_path

CREATE OR REPLACE FUNCTION public.audit_logs_list(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_user_id bigint DEFAULT NULL,
  p_target_user_id bigint DEFAULT NULL,
  p_action_type text DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_don_vi text DEFAULT NULL
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
    RAISE EXCEPTION 'Access denied: Only global administrators can view audit logs'
      USING ERRCODE = '42501';
  END IF;

  IF p_limit < 1 OR p_limit > 200 THEN p_limit := 50; END IF;
  IF p_offset < 0 THEN p_offset := 0; END IF;

  SELECT COUNT(*) INTO v_total_count
  FROM public.audit_logs al
  WHERE (p_user_id IS NULL OR al.admin_user_id = p_user_id)
    AND (p_target_user_id IS NULL OR al.target_user_id = p_target_user_id)
    AND (p_action_type IS NULL OR al.action_type ILIKE '%' || p_action_type || '%')
    AND (p_date_from IS NULL OR al.created_at >= p_date_from)
    AND (p_date_to IS NULL OR al.created_at <= p_date_to);

  SELECT json_agg(
    json_build_object(
      'id', al.id,
      'admin_user_id', al.admin_user_id,
      'admin_username', al.admin_username,
      'admin_full_name', COALESCE(admin_user.full_name, al.admin_username),
      'action_type', al.action_type,
      'target_user_id', al.target_user_id,
      'target_username', al.target_username,
      'target_full_name', COALESCE(target_user.full_name, al.target_username),
      'action_details', al.action_details,
      'ip_address', al.ip_address,
      'user_agent', al.user_agent,
      'created_at', al.created_at,
      'total_count', v_total_count
    )
  ) INTO v_result
  FROM (
    SELECT 
      al.id, al.admin_user_id, al.admin_username, al.action_type,
      al.target_user_id, al.target_username, al.action_details,
      al.ip_address, al.user_agent, al.created_at
    FROM public.audit_logs al
    WHERE (p_user_id IS NULL OR al.admin_user_id = p_user_id)
      AND (p_target_user_id IS NULL OR al.target_user_id = p_target_user_id)
      AND (p_action_type IS NULL OR al.action_type ILIKE '%' || p_action_type || '%')
      AND (p_date_from IS NULL OR al.created_at >= p_date_from)
      AND (p_date_to IS NULL OR al.created_at <= p_date_to)
    ORDER BY al.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ) al
  LEFT JOIN nhan_vien admin_user ON al.admin_user_id = admin_user.id
  LEFT JOIN nhan_vien target_user ON al.target_user_id = target_user.id;

  RETURN COALESCE(v_result, json_build_array());
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_logs_stats(
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_don_vi text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_role TEXT;
  v_result json;
BEGIN
  v_user_role := current_setting('request.jwt.claims', true)::json->>'app_role';
  IF v_user_role IS DISTINCT FROM 'global' THEN
    RAISE EXCEPTION 'Access denied: Only global administrators can view audit statistics'
      USING ERRCODE = '42501';
  END IF;

  SELECT json_agg(
    json_build_object(
      'action_type', action_type,
      'action_count', action_count,
      'unique_users', unique_users,
      'latest_activity', latest_activity
    )
  ) INTO v_result
  FROM (
    SELECT 
      al.action_type,
      COUNT(*) as action_count,
      COUNT(DISTINCT al.admin_user_id) as unique_users,
      MAX(al.created_at) as latest_activity
    FROM public.audit_logs al
    WHERE (p_date_from IS NULL OR al.created_at >= p_date_from)
      AND (p_date_to IS NULL OR al.created_at <= p_date_to)
    GROUP BY al.action_type
    ORDER BY COUNT(*) DESC, MAX(al.created_at) DESC
    LIMIT 20
  ) stats;

  RETURN COALESCE(v_result, json_build_array());
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_logs_recent_summary()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_role TEXT;
  v_total_activities BIGINT := 0;
  v_unique_users BIGINT := 0;
  v_top_action_type TEXT := 'N/A';
  v_top_action_count BIGINT := 0;
  v_latest_activity TIMESTAMPTZ;
BEGIN
  v_user_role := current_setting('request.jwt.claims', true)::json->>'app_role';
  IF v_user_role IS DISTINCT FROM 'global' THEN
    RAISE EXCEPTION 'Access denied: Only global administrators can view activity summary'
      USING ERRCODE = '42501';
  END IF;

  SELECT 
    COUNT(*),
    COUNT(DISTINCT admin_user_id),
    MAX(created_at)
  INTO v_total_activities, v_unique_users, v_latest_activity
  FROM public.audit_logs
  WHERE created_at >= NOW() - INTERVAL '24 hours';

  SELECT action_type, COUNT(*)
  INTO v_top_action_type, v_top_action_count
  FROM public.audit_logs
  WHERE created_at >= NOW() - INTERVAL '24 hours'
  GROUP BY action_type
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  RETURN json_build_array(json_build_object(
    'total_activities', v_total_activities,
    'unique_users', v_unique_users,
    'top_action_type', COALESCE(v_top_action_type, 'N/A'),
    'top_action_count', v_top_action_count,
    'latest_activity', v_latest_activity
  ));
END;
$$;

CREATE OR REPLACE FUNCTION public._audit_log_insert(
  p_admin_user_id BIGINT,
  p_admin_username TEXT,
  p_action_type TEXT,
  p_target_user_id BIGINT DEFAULT NULL,
  p_target_username TEXT DEFAULT NULL,
  p_action_details JSONB DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  BEGIN
    INSERT INTO public.audit_logs (
      admin_user_id, admin_username, action_type, target_user_id, target_username,
      action_details, ip_address, user_agent
    ) VALUES (
      p_admin_user_id, p_admin_username, p_action_type, p_target_user_id, p_target_username,
      p_action_details,
      COALESCE(p_ip_address, inet_client_addr()::TEXT, 'unknown'),
      COALESCE(p_user_agent, current_setting('request.headers', true), 'unknown')
    );
    RETURN TRUE;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'Failed to insert audit log: %', SQLERRM;
    RETURN FALSE;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public._get_current_user_context()
RETURNS TABLE (
  user_id BIGINT,
  username TEXT,
  role TEXT,
  don_vi TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id TEXT;
  v_username TEXT;
  v_role TEXT;
  v_don_vi TEXT;
  user_record nhan_vien%ROWTYPE;
BEGIN
  v_user_id := current_setting('request.jwt.claims', true)::json->>'user_id';
  v_role := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi := current_setting('request.jwt.claims', true)::json->>'don_vi';

  IF v_user_id IS NOT NULL AND v_user_id <> '' THEN
    SELECT * INTO user_record FROM nhan_vien WHERE id = v_user_id::BIGINT;
    v_username := user_record.username;
  END IF;

  RETURN QUERY SELECT 
    CASE WHEN v_user_id IS NOT NULL AND v_user_id <> '' THEN v_user_id::BIGINT ELSE NULL END,
    v_username,
    v_role,
    v_don_vi;
END;
$$;

-- 4) Unified audit logging helper for entities
CREATE OR REPLACE FUNCTION public.audit_log(
  p_action_type TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id BIGINT DEFAULT NULL,
  p_entity_label TEXT DEFAULT NULL,
  p_action_details JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id BIGINT;
  v_username TEXT;
  v_role TEXT;
  v_don_vi TEXT;
BEGIN
  SELECT user_id, username, role, don_vi
  INTO v_user_id, v_username, v_role, v_don_vi
  FROM public._get_current_user_context();

  BEGIN
    INSERT INTO public.audit_logs(
      admin_user_id, admin_username, action_type,
      action_details, ip_address, user_agent, created_at,
      entity_type, entity_id, entity_label, tenant_don_vi
    )
    VALUES (
      v_user_id, COALESCE(v_username, 'unknown'), p_action_type,
      p_action_details, inet_client_addr(), current_setting('request.headers', true), now(),
      p_entity_type, p_entity_id, p_entity_label, v_don_vi
    );
    RETURN TRUE;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'audit_log insert failed: %', SQLERRM;
    RETURN FALSE;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.audit_log(text, text, bigint, text, jsonb) TO authenticated;

-- 5) Query API v2 with entity filters
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

  SELECT COUNT(*)
  INTO v_total_count
  FROM public.audit_logs al
  WHERE (p_user_id IS NULL OR al.admin_user_id = p_user_id)
    AND (p_entity_type IS NULL OR al.entity_type = p_entity_type)
    AND (p_entity_id IS NULL OR al.entity_id = p_entity_id)
    AND (p_action_type IS NULL OR al.action_type ILIKE '%' || p_action_type || '%')
    AND (p_text_search IS NULL OR (al.entity_label ILIKE '%' || p_text_search || '%' OR al.action_details::text ILIKE '%' || p_text_search || '%'))
    AND (p_date_from IS NULL OR al.created_at >= p_date_from)
    AND (p_date_to IS NULL OR al.created_at <= p_date_to);

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
    FROM public.audit_logs
    WHERE (p_user_id IS NULL OR admin_user_id = p_user_id)
      AND (p_entity_type IS NULL OR entity_type = p_entity_type)
      AND (p_entity_id IS NULL OR entity_id = p_entity_id)
      AND (p_action_type IS NULL OR action_type ILIKE '%' || p_action_type || '%')
      AND (p_text_search IS NULL OR (entity_label ILIKE '%' || p_text_search || '%' OR action_details::text ILIKE '%' || p_text_search || '%'))
      AND (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to IS NULL OR created_at <= p_date_to)
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) al;

  RETURN COALESCE(v_result, json_build_array());
END;
$$;

GRANT EXECUTE ON FUNCTION public.audit_logs_list_v2(integer, integer, bigint, text, bigint, text, text, timestamptz, timestamptz) TO authenticated;

-- Comments for clarity
COMMENT ON FUNCTION public.audit_log(text, text, bigint, text, jsonb) IS 'Unified audit logging helper with JWT-derived context.';
COMMENT ON FUNCTION public.audit_logs_list_v2(integer, integer, bigint, text, bigint, text, text, timestamptz, timestamptz) IS 'List audit logs with entity filters. Global only.';

-- Reload PostgREST cache
NOTIFY pgrst, 'reload schema';

COMMIT;
