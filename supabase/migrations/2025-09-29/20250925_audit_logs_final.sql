-- Activity Logs (Audit Logs) Feature Implementation
-- Production-ready migration for QLTBYT Nam Phong Medical Equipment Management System
-- Created: 2025-09-25
-- 
-- This migration implements a comprehensive user activity tracking system
-- exclusively for global administrators with modern professional UI

-- =============================================================================
-- SCHEMA SETUP
-- =============================================================================

-- Ensure audit_logs table exists with proper structure
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id bigserial NOT NULL,
  admin_user_id bigint NOT NULL,
  admin_username text NOT NULL,
  action_type text NOT NULL,
  target_user_id bigint NULL,
  target_username text NULL,
  action_details jsonb NULL,
  ip_address inet NULL,
  user_agent text NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT fk_admin_user FOREIGN KEY (admin_user_id) REFERENCES nhan_vien (id),
  CONSTRAINT fk_target_user FOREIGN KEY (target_user_id) REFERENCES nhan_vien (id)
);

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_user_id ON public.audit_logs USING btree (admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user_id ON public.audit_logs USING btree (target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON public.audit_logs USING btree (action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);

-- =============================================================================
-- RPC FUNCTIONS FOR FRONTEND API
-- =============================================================================

-- Function: List audit logs with advanced filtering and pagination
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
AS $$
DECLARE
  v_user_role TEXT;
  v_result json;
  v_total_count BIGINT := 0;
BEGIN
  -- Get user context from JWT claims
  v_user_role := current_setting('request.jwt.claims', true)::json->>'app_role';
  
  -- SECURITY: Only global users can access audit logs
  IF v_user_role IS DISTINCT FROM 'global' THEN
    RAISE EXCEPTION 'Access denied: Only global administrators can view audit logs'
      USING ERRCODE = '42501';
  END IF;

  -- Validate and sanitize parameters
  IF p_limit < 1 OR p_limit > 200 THEN
    p_limit := 50;
  END IF;
  
  IF p_offset < 0 THEN
    p_offset := 0;
  END IF;

  -- Get total count for pagination
  SELECT COUNT(*) INTO v_total_count
  FROM public.audit_logs al
  WHERE (p_user_id IS NULL OR al.admin_user_id = p_user_id)
    AND (p_target_user_id IS NULL OR al.target_user_id = p_target_user_id)
    AND (p_action_type IS NULL OR al.action_type ILIKE '%' || p_action_type || '%')
    AND (p_date_from IS NULL OR al.created_at >= p_date_from)
    AND (p_date_to IS NULL OR al.created_at <= p_date_to);

  -- Get paginated results with user details
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

-- Function: Get activity statistics by action type
CREATE OR REPLACE FUNCTION public.audit_logs_stats(
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_don_vi text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role TEXT;
  v_result json;
BEGIN
  -- Get user context from JWT claims
  v_user_role := current_setting('request.jwt.claims', true)::json->>'app_role';
  
  -- SECURITY: Only global users can access audit statistics
  IF v_user_role IS DISTINCT FROM 'global' THEN
    RAISE EXCEPTION 'Access denied: Only global administrators can view audit statistics'
      USING ERRCODE = '42501';
  END IF;

  -- Return activity statistics
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

-- Function: Get recent activity summary (24 hours)
CREATE OR REPLACE FUNCTION public.audit_logs_recent_summary()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role TEXT;
  v_total_activities BIGINT := 0;
  v_unique_users BIGINT := 0;
  v_top_action_type TEXT := 'N/A';
  v_top_action_count BIGINT := 0;
  v_latest_activity TIMESTAMPTZ;
BEGIN
  -- Get user context from JWT claims
  v_user_role := current_setting('request.jwt.claims', true)::json->>'app_role';
  
  -- SECURITY: Only global users can access recent summary
  IF v_user_role IS DISTINCT FROM 'global' THEN
    RAISE EXCEPTION 'Access denied: Only global administrators can view activity summary'
      USING ERRCODE = '42501';
  END IF;
  
  -- Get basic stats for last 24 hours
  SELECT 
    COUNT(*),
    COUNT(DISTINCT admin_user_id),
    MAX(created_at)
  INTO v_total_activities, v_unique_users, v_latest_activity
  FROM public.audit_logs
  WHERE created_at >= NOW() - INTERVAL '24 hours';
  
  -- Get most frequent action type
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

-- =============================================================================
-- AUDIT LOGGING HELPER FUNCTIONS
-- =============================================================================

-- Helper function: Consistent audit log insertion with error handling
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
AS $$
BEGIN
  -- Insert audit log entry with graceful error handling
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
    -- Log error but don't fail the main operation
    RAISE WARNING 'Failed to insert audit log: %', SQLERRM;
    RETURN FALSE;
  END;
END;
$$;

-- Helper function: Extract current user context from JWT claims
CREATE OR REPLACE FUNCTION public._get_current_user_context()
RETURNS TABLE (
  user_id BIGINT,
  username TEXT,
  role TEXT,
  don_vi TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT;
  v_username TEXT;
  v_role TEXT;
  v_don_vi TEXT;
  user_record nhan_vien%ROWTYPE;
BEGIN
  -- Extract JWT claims
  v_user_id := current_setting('request.jwt.claims', true)::json->>'user_id';
  v_role := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi := current_setting('request.jwt.claims', true)::json->>'don_vi';
  
  -- Get username from database if user_id is available
  IF v_user_id IS NOT NULL AND v_user_id != '' THEN
    SELECT * INTO user_record FROM nhan_vien WHERE id = v_user_id::BIGINT;
    v_username := user_record.username;
  END IF;
  
  RETURN QUERY SELECT 
    CASE WHEN v_user_id IS NOT NULL AND v_user_id != '' THEN v_user_id::BIGINT ELSE NULL END,
    v_username,
    v_role,
    v_don_vi;
END;
$$;

-- =============================================================================
-- PERMISSIONS & SECURITY
-- =============================================================================

-- Grant execute permissions to authenticated users (security enforced in functions)
GRANT EXECUTE ON FUNCTION public.audit_logs_list(integer, integer, bigint, bigint, text, timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_logs_stats(timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_logs_recent_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public._audit_log_insert(bigint, text, text, bigint, text, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public._get_current_user_context() TO authenticated;

-- =============================================================================
-- DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE public.audit_logs IS 
'Activity logs for tracking all user actions in the medical equipment management system. Global admin access only.';

COMMENT ON FUNCTION public.audit_logs_list(integer, integer, bigint, bigint, text, timestamptz, timestamptz, text) IS 
'List audit logs with filtering and pagination. Global users only. Returns detailed activity records with user information.';

COMMENT ON FUNCTION public.audit_logs_stats(timestamptz, timestamptz, text) IS 
'Get audit log statistics by action type. Global users only. Useful for activity analysis and reporting.';

COMMENT ON FUNCTION public.audit_logs_recent_summary() IS 
'Get recent activity summary for the last 24 hours. Global users only. Dashboard overview information.';

COMMENT ON FUNCTION public._audit_log_insert(bigint, text, text, bigint, text, jsonb, text, text) IS 
'Helper function to consistently insert audit log entries with error handling. Used by other RPC functions.';

COMMENT ON FUNCTION public._get_current_user_context() IS 
'Helper function to extract current user context from JWT claims. Used for audit logging.';

-- =============================================================================
-- POSTREST SCHEMA CACHE RELOAD
-- =============================================================================

-- Notify PostgREST to reload schema cache to recognize new functions
NOTIFY pgrst, 'reload schema';