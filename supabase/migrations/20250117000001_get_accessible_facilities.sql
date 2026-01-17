-- Migration: get_accessible_facilities
-- Returns facilities accessible to the current user based on role

CREATE OR REPLACE FUNCTION public.get_accessible_facilities()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_role TEXT;
  v_allowed_don_vi BIGINT[];
  v_jwt_claims JSONB;
  v_result JSONB;
BEGIN
  -- Get JWT claims safely
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := NULL;
  END;
  
  v_role := lower(COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  ));
  
  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();
  
  -- Global users: Return ALL active facilities
  IF v_role = 'global' THEN
    SELECT jsonb_agg(
      jsonb_build_object('id', dv.id, 'name', dv.name)
      ORDER BY dv.name
    )
    INTO v_result
    FROM public.don_vi dv
    WHERE dv.active IS NOT FALSE;
    
    RETURN COALESCE(v_result, '[]'::jsonb);
  END IF;
  
  -- Regional leaders: Return facilities in their region
  IF v_role = 'regional_leader' THEN
    IF v_allowed_don_vi IS NULL OR array_length(v_allowed_don_vi, 1) = 0 THEN
      RETURN '[]'::jsonb;
    END IF;
    
    SELECT jsonb_agg(
      jsonb_build_object('id', dv.id, 'name', dv.name)
      ORDER BY dv.name
    )
    INTO v_result
    FROM public.don_vi dv
    WHERE dv.id = ANY(v_allowed_don_vi)
      AND dv.active IS NOT FALSE;
    
    RETURN COALESCE(v_result, '[]'::jsonb);
  END IF;
  
  -- Other roles: Return empty (they don't need facility selection)
  RETURN '[]'::jsonb;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_accessible_facilities TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_accessible_facilities IS 
  'Returns facilities accessible to the current user. Global users get all active facilities, regional_leader users get facilities in their region.';
