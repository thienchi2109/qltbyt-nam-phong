-- Fix Variable-Column Name Conflict in authenticate_user_dual_mode
-- Issue: PL/pgSQL variable 'dia_ban_id' conflicts with table column 'dia_ban_id'
-- Solution: Rename all variables to avoid conflicts
-- Migration Date: 2025-10-04 06:30 UTC

BEGIN;

-- ============================================================================
-- FIX: Rename all variables to avoid column name conflicts
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
  v_resolved_region_id BIGINT;
  v_resolved_region_ma TEXT;
  v_tenant_active BOOLEAN := TRUE;
  v_region_active BOOLEAN := TRUE;
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
    nv.dia_ban_id as nhan_vien_region_id,
    COALESCE(dv_current.dia_ban_id, dv_home.dia_ban_id) AS don_vi_joined_region_id,
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
  
  -- Get tenant and region information
  IF v_resolved_don_vi IS NOT NULL THEN
    SELECT dv.active, dv.dia_ban_id
    INTO v_tenant_active, v_resolved_region_id
    FROM public.don_vi dv
    WHERE dv.id = v_resolved_don_vi
    LIMIT 1;

    IF NOT FOUND THEN
      v_tenant_active := TRUE;
      v_resolved_region_id := COALESCE(user_record.nhan_vien_region_id, user_record.don_vi_joined_region_id);
    ELSE
      v_tenant_active := COALESCE(v_tenant_active, TRUE);
      IF v_resolved_region_id IS NULL THEN
        v_resolved_region_id := COALESCE(user_record.nhan_vien_region_id, user_record.don_vi_joined_region_id);
      END IF;
    END IF;
  ELSE
    v_tenant_active := TRUE;
    v_resolved_region_id := COALESCE(user_record.nhan_vien_region_id, user_record.don_vi_joined_region_id);
  END IF;

  -- Get region metadata
  IF v_resolved_region_id IS NOT NULL THEN
    SELECT db.ma_dia_ban, db.active
    INTO v_resolved_region_ma, v_region_active
    FROM public.dia_ban db
    WHERE db.id = v_resolved_region_id
    LIMIT 1;

    IF NOT FOUND THEN
      v_resolved_region_ma := NULL;
      v_region_active := TRUE;
    ELSE
      v_region_active := COALESCE(v_region_active, TRUE);
    END IF;
  ELSE
    v_resolved_region_ma := NULL;
    v_region_active := TRUE;
  END IF;

  -- Reject access if tenant/region is inactive for scoped roles
  IF LOWER(COALESCE(user_record.role, '')) NOT IN ('global', 'admin') THEN
    IF v_resolved_don_vi IS NOT NULL AND v_tenant_active IS DISTINCT FROM TRUE THEN
      RETURN QUERY SELECT
        user_record.id,
        user_record.username,
        user_record.full_name,
        user_record.role,
        user_record.khoa_phong,
        v_resolved_don_vi,
        v_resolved_region_id,
        v_resolved_region_ma,
        FALSE,
        'tenant_inactive'::TEXT;
      RETURN;
    END IF;
  END IF;

  IF LOWER(COALESCE(user_record.role, '')) = 'regional_leader' THEN
    IF v_resolved_region_id IS NULL THEN
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

    IF v_region_active IS DISTINCT FROM TRUE THEN
      RETURN QUERY SELECT
        user_record.id,
        user_record.username,
        user_record.full_name,
        user_record.role,
        user_record.khoa_phong,
        v_resolved_don_vi,
        v_resolved_region_id,
        v_resolved_region_ma,
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
    v_resolved_region_id,
    v_resolved_region_ma,
    TRUE,
    auth_mode;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.authenticate_user_dual_mode(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.authenticate_user_dual_mode(TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.authenticate_user_dual_mode(TEXT, TEXT)
IS 'Authenticates a user supporting hashed/plain passwords and returns role, don_vi, dia_ban claims. FIXED: Resolved variable-column name conflicts by renaming all variables.';

-- ============================================================================
-- UPDATE allowed_don_vi_for_session to use 'dia_ban' claim from JWT
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
    v_user_region_id BIGINT;
    v_allowed_don_vi BIGINT[];
BEGIN
    -- Get user context from JWT claims
    -- Note: RPC proxy sends 'dia_ban' claim (not 'dia_ban_id')
    v_user_role := current_setting('request.jwt.claims', true)::json->>'role';
    v_user_don_vi := (current_setting('request.jwt.claims', true)::json->>'don_vi')::BIGINT;
    v_user_region_id := (current_setting('request.jwt.claims', true)::json->>'dia_ban')::BIGINT;
    
    -- Handle different role access patterns
    CASE v_user_role
        WHEN 'global' THEN
            -- Global users can access all don_vi
            SELECT array_agg(id) INTO v_allowed_don_vi 
            FROM public.don_vi 
            WHERE active = true;
             
        WHEN 'regional_leader' THEN
            -- Regional leaders can access all don_vi in their region
            IF v_user_region_id IS NULL THEN
                RAISE EXCEPTION 'Regional leader must have dia_ban assigned';
            END IF;
            
            SELECT array_agg(id) INTO v_allowed_don_vi 
            FROM public.don_vi 
            WHERE dia_ban_id = v_user_region_id 
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
-- RESET PASSWORDS FOR TESTING (if needed)
-- ============================================================================

-- Reset password for regional_leader user to known value for testing
UPDATE public.nhan_vien
SET hashed_password = extensions.crypt('1234', extensions.gen_salt('bf', 12)),
    password = 'hashed password',
    password_changed_at = NOW()
WHERE username = 'sytag-khtc';

-- Reset password for to_qltb users to known value for testing
UPDATE public.nhan_vien
SET hashed_password = extensions.crypt('1234', extensions.gen_salt('bf', 12)),
    password = 'hashed password',
    password_changed_at = NOW()
WHERE role = 'to_qltb' AND username IN ('cdc-ag', 'bvdk-ag');

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
SELECT * FROM public.authenticate_user_dual_mode('sytag-khtc', '1234');

-- Test 2: Verify to_qltb user can authenticate
SELECT * FROM public.authenticate_user_dual_mode('cdc-ag', '1234');

-- Test 3: Verify regular user can authenticate
SELECT * FROM public.authenticate_user_dual_mode('bvdk-ag-pkhtc', '1234');

-- Test 4: Verify all users have correct assignments
SELECT id, username, full_name, role, dia_ban_id, don_vi, current_don_vi 
FROM public.nhan_vien 
WHERE role IN ('regional_leader', 'to_qltb', 'user')
ORDER BY id;
*/