-- Create lightweight RPC to fetch facilities that have repair requests
-- This replaces the inefficient pattern of calling repair_request_list with p_page_size=5000
-- just to extract unique facilities from the results.
--
-- Benefits:
-- - Payload reduction: ~500KB → ~1-2KB (250x smaller)
-- - Faster query: Simple JOIN vs complex nested query
-- - Security: Uses allowed_don_vi_for_session_safe() for tenant isolation
-- - Regional leader support: Respects dia_ban claim for multi-facility access
--
-- Migration Date: 2025-10-11 15:08 UTC

BEGIN;

-- ============================================================================
-- Create get_repair_request_facilities function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_repair_request_facilities()
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
  
  -- Get role from JWT (prefer app_role, fallback to role)
  v_role := lower(COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  ));
  
  -- Get allowed facilities based on role and region (handles global, regional_leader, regular users)
  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();
  
  -- CASE 1: Global users - return all facilities that have repair requests
  IF v_role = 'global' THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', dv.id,
        'name', dv.name
      )
      ORDER BY dv.name
    )
    INTO v_result
    FROM (
      SELECT DISTINCT dv.id, dv.name
      FROM public.yeu_cau_sua_chua r
      INNER JOIN public.thiet_bi tb ON tb.id = r.thiet_bi_id
      INNER JOIN public.don_vi dv ON dv.id = tb.don_vi
      WHERE tb.don_vi IS NOT NULL
    ) dv;
    
    RETURN COALESCE(v_result, '[]'::jsonb);
  END IF;
  
  -- CASE 2: Non-global users (regional leaders, regular users)
  IF v_allowed_don_vi IS NULL OR array_length(v_allowed_don_vi, 1) = 0 THEN
    -- No access to any facilities
    RETURN '[]'::jsonb;
  END IF;
  
  -- Return only allowed facilities that have repair requests
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', dv.id,
      'name', dv.name
    )
    ORDER BY dv.name
  )
  INTO v_result
  FROM (
    SELECT DISTINCT dv.id, dv.name
    FROM public.yeu_cau_sua_chua r
    INNER JOIN public.thiet_bi tb ON tb.id = r.thiet_bi_id
    INNER JOIN public.don_vi dv ON dv.id = tb.don_vi
    WHERE tb.don_vi = ANY(v_allowed_don_vi)  -- Tenant isolation
      AND tb.don_vi IS NOT NULL
  ) dv;
  
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_repair_request_facilities TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.get_repair_request_facilities IS 
'Returns list of facilities (id, name) that have repair requests, respecting tenant isolation. 
For global users: all facilities with repair requests.
For regional leaders: only facilities in their region (via dia_ban claim) that have repair requests.
For regular users: only their current facility if it has repair requests.
Lightweight alternative to calling repair_request_list just to extract facility names.';

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Test as global user (should see all facilities)
-- SET request.jwt.claims TO '{"app_role": "global", "don_vi": "1"}';
-- SELECT jsonb_pretty(get_repair_request_facilities());

-- Test as regional leader (should see only facilities in region)
-- SET request.jwt.claims TO '{"app_role": "regional_leader", "don_vi": "15", "dia_ban": "1"}';
-- SELECT jsonb_pretty(get_repair_request_facilities());

-- Test as regular user (should see only their facility)
-- SET request.jwt.claims TO '{"app_role": "user", "don_vi": "15"}';
-- SELECT jsonb_pretty(get_repair_request_facilities());

-- Expected output format:
-- [
--   {"id": 8, "name": "Bệnh viện Đa khoa An Giang"},
--   {"id": 9, "name": "Trung tâm Kiểm soát bệnh tật An Giang"},
--   ...
-- ]

-- ============================================================================
-- PERFORMANCE NOTES
-- ============================================================================
-- This query uses existing indexes:
-- - idx_yeu_cau_sua_chua_thiet_bi_id (for JOIN on thiet_bi_id)
-- - idx_thiet_bi_don_vi (for filtering by don_vi)
--
-- Query plan should show:
-- - Index scan on yeu_cau_sua_chua
-- - Nested loop join to thiet_bi using thiet_bi_id index
-- - Filter on don_vi using don_vi index
-- - HashAggregate for DISTINCT
--
-- Expected execution time: <10ms for typical datasets (thousands of repair requests)
