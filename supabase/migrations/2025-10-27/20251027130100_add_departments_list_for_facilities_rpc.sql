-- Add Departments List for Facilities RPC for Reports "All Facilities" Feature
-- This function lists all departments across multiple facilities
-- Migration Date: 2025-10-27 13:01 UTC

BEGIN;

-- ============================================================================
-- CREATE: departments_list_for_facilities
-- ============================================================================

CREATE OR REPLACE FUNCTION public.departments_list_for_facilities(
  p_don_vi_array BIGINT[] DEFAULT NULL
)
RETURNS TABLE(name TEXT, count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_allowed BIGINT[];
  v_facilities_to_query BIGINT[];
BEGIN
  -- 1. Get role and allowed facilities
  v_role := lower(COALESCE(
    public._get_jwt_claim('app_role'), 
    public._get_jwt_claim('role'), 
    ''
  ));
  v_allowed := public.allowed_don_vi_for_session_safe();
  
  -- 2. Determine facilities to query based on role
  IF v_role = 'global' OR v_role = 'admin' THEN
    IF p_don_vi_array IS NULL OR array_length(p_don_vi_array, 1) IS NULL THEN
      v_facilities_to_query := NULL;  -- All facilities
    ELSE
      v_facilities_to_query := p_don_vi_array;
    END IF;
    
  ELSIF v_role = 'regional_leader' THEN
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      -- No access - return empty
      RETURN;
    END IF;
    
    IF p_don_vi_array IS NULL OR array_length(p_don_vi_array, 1) IS NULL THEN
      v_facilities_to_query := v_allowed;  -- All allowed facilities
    ELSE
      -- Validate requested facilities
      SELECT ARRAY_AGG(fid)
      INTO v_facilities_to_query
      FROM UNNEST(p_don_vi_array) AS fid
      WHERE fid = ANY(v_allowed);
      
      IF v_facilities_to_query IS NULL OR 
         array_length(v_facilities_to_query, 1) IS NULL THEN
        RAISE EXCEPTION 'Access denied to requested facilities'
          USING ERRCODE = '42501';
      END IF;
    END IF;
    
  ELSE
    -- Other roles: single facility
    v_facilities_to_query := ARRAY[
      NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT
    ];
  END IF;
  
  -- 3. Return departments list with equipment count
  RETURN QUERY
  SELECT 
    tb.khoa_phong_quan_ly AS name,
    COUNT(*) AS count
  FROM public.thiet_bi tb
  WHERE (v_facilities_to_query IS NULL OR tb.don_vi = ANY(v_facilities_to_query))
    AND tb.khoa_phong_quan_ly IS NOT NULL
    AND tb.khoa_phong_quan_ly != ''
  GROUP BY tb.khoa_phong_quan_ly
  ORDER BY tb.khoa_phong_quan_ly;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.departments_list_for_facilities(BIGINT[]) 
TO authenticated;

-- Add function comment
COMMENT ON FUNCTION public.departments_list_for_facilities(BIGINT[]) IS
'Returns list of departments across multiple facilities with equipment counts.
Authorization follows same pattern as equipment_aggregates_for_reports.

Parameters:
- p_don_vi_array: Array of facility IDs (NULL = all allowed)

Returns TABLE:
- name: Department name
- count: Number of equipment in that department

Security:
- SECURITY DEFINER with search_path = public, pg_temp
- Validates access via allowed_don_vi_for_session_safe()';

COMMIT;
