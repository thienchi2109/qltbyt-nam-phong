-- Add RPC function to get facility list for regional leaders
-- This enables efficient dropdown population without requiring full equipment data
-- Migration Date: 2025-10-04 12:30 UTC

BEGIN;

-- ============================================================================
-- Create facility list function for regional leaders
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_facilities_with_equipment_count()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_role TEXT := '';
  v_allowed_don_vi BIGINT[];
  v_jwt_claims JSONB;
  v_result JSONB;
BEGIN
  -- Get JWT claims
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := NULL;
  END;
  
  -- Get role
  v_role := COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  );
  
  -- Get allowed facilities based on role
  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();
  
  -- For global users, return all facilities
  IF lower(v_role) = 'global' THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', dv.id,
        'name', dv.name,
        'code', dv.code,
        'equipment_count', COALESCE(tb_count.cnt, 0)
      )
      ORDER BY dv.name
    )
    INTO v_result
    FROM public.don_vi dv
    LEFT JOIN (
      SELECT don_vi, COUNT(*) as cnt
      FROM public.thiet_bi
      GROUP BY don_vi
    ) tb_count ON tb_count.don_vi = dv.id;
    
    RETURN COALESCE(v_result, '[]'::jsonb);
  END IF;
  
  -- For non-global users (regional leaders, etc.)
  IF v_allowed_don_vi IS NULL OR array_length(v_allowed_don_vi, 1) = 0 THEN
    -- No access
    RETURN '[]'::jsonb;
  END IF;
  
  -- Return only allowed facilities with equipment counts
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', dv.id,
      'name', dv.name,
      'code', dv.code,
      'equipment_count', COALESCE(tb_count.cnt, 0)
    )
    ORDER BY dv.name
  )
  INTO v_result
  FROM public.don_vi dv
  LEFT JOIN (
    SELECT don_vi, COUNT(*) as cnt
    FROM public.thiet_bi
    WHERE don_vi = ANY(v_allowed_don_vi)
    GROUP BY don_vi
  ) tb_count ON tb_count.don_vi = dv.id
  WHERE dv.id = ANY(v_allowed_don_vi);
  
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_facilities_with_equipment_count TO authenticated;

COMMENT ON FUNCTION public.get_facilities_with_equipment_count IS 'Returns list of facilities accessible to the current user with equipment counts. For regional leaders, returns only facilities in their region.';

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Test as regional leader
-- SET request.jwt.claims TO '{"app_role": "regional_leader", "don_vi": "15", "dia_ban": "1"}';
-- SELECT jsonb_pretty(get_facilities_with_equipment_count());

-- Expected output:
-- [
--   {"id": 8, "name": "Bệnh viện Đa khoa An Giang", "code": "BVDKAG", "equipment_count": 12},
--   {"id": 9, "name": "Trung tâm Kiểm soát bệnh tật An Giang", "code": "CDCAG", "equipment_count": 15},
--   ...
-- ]
