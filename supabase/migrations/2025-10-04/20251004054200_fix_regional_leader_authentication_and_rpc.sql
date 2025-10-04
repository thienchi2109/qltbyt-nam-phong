-- Fix Regional Leader Authentication and RPC Claims Mismatch
-- Issue 1: authenticate_user_dual_mode doesn't properly resolve dia_ban_id for regional_leader
-- Issue 2: RPC proxy sends 'dia_ban' claim but allowed_don_vi_for_session expects 'dia_ban' claim
-- Migration Date: 2025-10-04 05:42 UTC

BEGIN;

-- ============================================================================
-- FIX 1: Update authenticate_user_dual_mode to properly resolve dia_ban_id
-- ============================================================================

CREATE OR REPLACE FUNCTION public.authenticate_user_dual_mode(
  p_username TEXT,
  p_password TEXT
)
RETURNS TABLE (
  user_id BIGINT,
  username TEXT,
  full_name TEXT,
  role TEXT,
  khoa_phong TEXT,
  don_vi BIGINT,
  dia_ban_id BIGINT,
  dia_ban_ma TEXT,
  is_authenticated BOOLEAN,
  authentication_mode TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $func$
DECLARE
  v_username TEXT;
  user_record RECORD;
  password_valid BOOLEAN := FALSE;
  auth_mode TEXT := 'unknown';
  v_resolved_don_vi BIGINT;
  v_resolved_dia_ban BIGINT;
  v_resolved_dia_ban_ma TEXT;
  v_tenant_active BOOLEAN := TRUE;
  v_dia_ban_active BOOLEAN := TRUE;
BEGIN
  v_username := lower(trim(p_username));

  SELECT
    nv.id,
    nv.username,
    nv.full_name,
    nv.role,
    nv.khoa_phong,
    nv.password,
    nv.hashed_password,
    nv.current_don_vi,
    nv.don_vi,
    nv.dia_ban_id,
    COALESCE(dv_current.dia_ban_id, dv_home.dia_ban_id) AS joined_dia_ban_id,
    COALESCE(dv_current.active, TRUE) AS current_don_vi_active,
    COALESCE(dv_home.active, TRUE) AS home_don_vi_active
  INTO user_record
  FROM public.nhan_vien nv
  LEFT JOIN public.don_vi dv_current ON dv_current.id = nv.current_don_vi
  LEFT JOIN public.don_vi dv_home ON dv_home.id = nv.don_vi
  WHERE lower(nv.username) = v_username
  LIMIT 1;

  IF user_record.id IS NULL THEN
    RETURN QUERY SELECT
      NULL::BIGINT,
      v_username,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      NULL::BIGINT,
      NULL::BIGINT,
      NULL::TEXT,
      FALSE,
      'user_not_found'::TEXT;
    RETURN;
  END IF;

  -- Guard against obvious hashed passwords submitted as input
  IF p_password = 'hashed password'
     OR p_password ILIKE '%hash%'
     OR p_password ILIKE '%crypt%'
     OR length(p_password) > 200 THEN
    RETURN QUERY SELECT
      user_record.id,
      user_record.username,
      user_record.full_name,
      user_record.role,
      user_record.khoa_phong,
      NULL::BIGINT,
      NULL::BIGINT,
      NULL::TEXT,
      FALSE,
      'blocked_suspicious'::TEXT;
    RETURN;
  END IF;

  -- Verify password using hashed column first, then legacy plaintext fallback
  IF user_record.hashed_password IS NOT NULL AND user_record.hashed_password <> '' THEN
    password_valid := (extensions.crypt(p_password, user_record.hashed_password) = user_record.hashed_password);
    IF password_valid THEN
      auth_mode := 'hashed';
    END IF;
  END IF;

  IF NOT password_valid
     AND user_record.password IS NOT NULL
     AND user_record.password <> 'hashed password' THEN
    password_valid := (user_record.password = p_password);
    IF password_valid THEN
      auth_mode := 'plain';
    END IF;
  END IF;

  IF NOT password_valid THEN
    RETURN QUERY SELECT
      user_record.id,
      user_record.username,
      user_record.full_name,
      user_record.role,
      user_record.khoa_phong,
      NULL::BIGINT,
      NULL::BIGINT,
      NULL::TEXT,
      FALSE,
      auth_mode;
    RETURN;
  END IF;

  v_resolved_don_vi := COALESCE(user_record.current_don_vi, user_record.don_vi);
  IF v_resolved_don_vi IS NOT NULL THEN
    SELECT active, dia_ban_id
    INTO v_tenant_active, v_resolved_dia_ban
    FROM public.don_vi
    WHERE id = v_resolved_don_vi
    LIMIT 1;

    IF NOT FOUND THEN
      v_tenant_active := TRUE;
      v_resolved_dia_ban := COALESCE(user_record.dia_ban_id, user_record.joined_dia_ban_id);
    ELSE
      v_tenant_active := COALESCE(v_tenant_active, TRUE);
      IF v_resolved_dia_ban IS NULL THEN
        v_resolved_dia_ban := COALESCE(user_record.dia_ban_id, user_record.joined_dia_ban_id);
      END IF;
    END IF;
  ELSE
    v_tenant_active := TRUE;
    v_resolved_dia_ban := COALESCE(user_record.dia_ban_id, user_record.joined_dia_ban_id);
  END IF;

  IF v_resolved_dia_ban IS NOT NULL THEN
    SELECT ma_dia_ban, active
    INTO v_resolved_dia_ban_ma, v_dia_ban_active
    FROM public.dia_ban
    WHERE id = v_resolved_dia_ban
    LIMIT 1;

    IF NOT FOUND THEN
      v_resolved_dia_ban_ma := NULL;
      v_dia_ban_active := TRUE;
    ELSE
      v_dia_ban_active := COALESCE(v_dia_ban_active, TRUE);
    END IF;
  ELSE
    v_resolved_dia_ban_ma := NULL;
    v_dia_ban_active := TRUE;
  END IF;

  -- Reject access if tenant/dia_ban is inactive for scoped roles
  IF LOWER(COALESCE(user_record.role, '')) NOT IN ('global', 'admin') THEN
    IF v_resolved_don_vi IS NOT NULL AND v_tenant_active IS DISTINCT FROM TRUE THEN
      RETURN QUERY SELECT
        user_record.id,
        user_record.username,
        user_record.full_name,
        user_record.role,
        user_record.khoa_phong,
        v_resolved_don_vi,
        v_resolved_dia_ban,
        v_resolved_dia_ban_ma,
        FALSE,
        'tenant_inactive'::TEXT;
      RETURN;
    END IF;
  END IF;

  IF LOWER(COALESCE(user_record.role, '')) = 'regional_leader' THEN
    IF v_resolved_dia_ban IS NULL THEN
      RETURN QUERY SELECT
        user_record.id,
        user_record.username,
        user_record.full_name,
        user_record.role,
        user_record.khoa_phong,
        v_resolved_don_vi,
        NULL::BIGINT,
        NULL::TEXT,
        FALSE,
        'missing_dia_ban'::TEXT;
      RETURN;
    END IF;

    IF v_dia_ban_active IS DISTINCT FROM TRUE THEN
      RETURN QUERY SELECT
        user_record.id,
        user_record.username,
        user_record.full_name,
        user_record.role,
        user_record.khoa_phong,
        v_resolved_don_vi,
        v_resolved_dia_ban,
        v_resolved_dia_ban_ma,
        FALSE,
        'dia_ban_inactive'::TEXT;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT
    user_record.id,
    user_record.username,
    user_record.full_name,
    user_record.role,
    user_record.khoa_phong,
    v_resolved_don_vi,
    v_resolved_dia_ban,
    v_resolved_dia_ban_ma,
    TRUE,
    auth_mode;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.authenticate_user_dual_mode(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.authenticate_user_dual_mode(TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.authenticate_user_dual_mode(TEXT, TEXT)
IS 'Authenticates a user supporting hashed/plain passwords and returns role, don_vi, dia_ban claims. FIXED: Properly resolves dia_ban_id for regional_leader role.';

-- ============================================================================
-- FIX 2: Update allowed_don_vi_for_session to use 'dia_ban' claim from JWT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.allowed_don_vi_for_session()
RETURNS BIGINT[] 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_role TEXT;
    v_user_don_vi BIGINT;
    v_user_dia_ban BIGINT;
    v_allowed_don_vi BIGINT[];
BEGIN
    -- Get user context from JWT claims
    -- Note: RPC proxy sends 'dia_ban' claim (not 'dia_ban_id')
    v_user_role := current_setting('request.jwt.claims', true)::json->>'role';
    v_user_don_vi := (current_setting('request.jwt.claims', true)::json->>'don_vi')::BIGINT;
    v_user_dia_ban := (current_setting('request.jwt.claims', true)::json->>'dia_ban')::BIGINT;
    
    -- Handle different role access patterns
    CASE v_user_role
        WHEN 'global' THEN
            -- Global users can access all don_vi
            SELECT array_agg(id) INTO v_allowed_don_vi 
            FROM public.don_vi 
            WHERE active = true;
             
        WHEN 'regional_leader' THEN
            -- Regional leaders can access all don_vi in their dia_ban
            IF v_user_dia_ban IS NULL THEN
                RAISE EXCEPTION 'Regional leader must have dia_ban assigned';
            END IF;
            
            SELECT array_agg(id) INTO v_allowed_don_vi 
            FROM public.don_vi 
            WHERE dia_ban_id = v_user_dia_ban 
            AND active = true;
            
        WHEN 'admin', 'to_qltb', 'qltb_khoa', 'technician', 'user' THEN
            -- Other roles are limited to their specific don_vi
            IF v_user_don_vi IS NULL THEN
                RAISE EXCEPTION 'User must have don_vi assigned for role %', v_user_role;
            END IF;
            
            v_allowed_don_vi := ARRAY[v_user_don_vi];
            
        ELSE
            -- Unknown role - no access
            RAISE EXCEPTION 'Unknown role: %', v_user_role;
    END CASE;
    
    -- Return empty array if no access (safety fallback)
    RETURN COALESCE(v_allowed_don_vi, ARRAY[]::BIGINT[]);
END;
$$;

GRANT EXECUTE ON FUNCTION public.allowed_don_vi_for_session() TO authenticated;

COMMENT ON FUNCTION public.allowed_don_vi_for_session() IS 
'Returns array of don_vi IDs that current session user can access based on role and dia_ban. FIXED: Now reads "dia_ban" claim from JWT to match RPC proxy.';

-- ============================================================================
-- FIX 3: Reset password for regional_leader user for testing
-- ============================================================================

UPDATE public.nhan_vien
SET hashed_password = extensions.crypt('userqltb', extensions.gen_salt('bf', 12)),
    password = 'hashed password',
    password_changed_at = NOW()
WHERE username = 'sytag-khtc';

-- ============================================================================
-- COMMIT AND ANALYZE
-- ============================================================================

COMMIT;

-- Update statistics
ANALYZE public.nhan_vien;
ANALYZE public.don_vi;
ANALYZE public.dia_ban;

-- ============================================================================
-- VERIFICATION QUERIES (execute manually after migration)
-- ============================================================================

/*
-- Test 1: Verify regional leader can authenticate
SELECT * FROM public.authenticate_user_dual_mode('sytag-khtc', 'userqltb');

-- Test 2: Verify regional leader user has correct dia_ban assignment
SELECT id, username, full_name, role, dia_ban_id, don_vi, current_don_vi 
FROM public.nhan_vien 
WHERE username = 'sytag-khtc';

-- Test 3: Verify all don_vi in An Giang region
SELECT id, code, name, dia_ban_id 
FROM public.don_vi 
WHERE dia_ban_id = 1 
ORDER BY id;

-- Test 4: Verify equipment data in An Giang region
SELECT COUNT(*) as equipment_count
FROM public.thiet_bi tb
JOIN public.don_vi dv ON tb.don_vi = dv.id
WHERE dv.dia_ban_id = 1;

-- Test 5: Verify schema integrity
SELECT * FROM public.verify_regional_leader_schema();
*/