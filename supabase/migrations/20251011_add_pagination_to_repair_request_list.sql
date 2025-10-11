-- Add pagination support to repair_request_list RPC
-- Matches equipment_list_enhanced pattern with total count and proper pagination
-- Includes server-side facility filtering with p_don_vi parameter

-- Drop existing function (if exists) to avoid conflicts
DROP FUNCTION IF EXISTS public.repair_request_list(TEXT, TEXT, INT, INT);

-- Create new function with pagination support
CREATE OR REPLACE FUNCTION public.repair_request_list(
  p_q TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 50,
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_effective_donvi BIGINT := NULL;
  v_allowed BIGINT[] := NULL;
  v_limit INT := GREATEST(COALESCE(p_page_size, 50), 1);
  v_offset INT := GREATEST((COALESCE(p_page, 1) - 1) * v_limit, 0);
  v_total BIGINT := 0;
  v_data JSONB := '[]'::jsonb;
BEGIN
  -- Obtain JWT claims at runtime (unused v_claim_donvi removed, using helper function directly)
  
  -- Tenant isolation: determine effective facility filter
  IF v_role = 'global' THEN
    -- Global users can filter by any facility or see all
    v_effective_donvi := p_don_vi; -- may be NULL => all facilities
  ELSE
    -- Non-global users: get allowed facilities
    v_allowed := public.allowed_don_vi_for_session();
    
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      -- No access to any facilities
      RETURN jsonb_build_object(
        'data', '[]'::jsonb,
        'total', 0,
        'page', p_page,
        'pageSize', p_page_size
      );
    END IF;
    
    -- If p_don_vi provided, validate it's in allowed list
    IF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        -- Requested facility not allowed, return empty
        RETURN jsonb_build_object(
          'data', '[]'::jsonb,
          'total', 0,
          'page', p_page,
          'pageSize', p_page_size
        );
      END IF;
    END IF;
    -- If p_don_vi is NULL, v_allowed will be used in WHERE clause
  END IF;

  -- Build WHERE conditions
  -- Calculate total count first
  SELECT count(*) INTO v_total
  FROM public.yeu_cau_sua_chua r
  JOIN public.thiet_bi tb ON tb.id = r.thiet_bi_id
  LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
  WHERE (
      -- Global role: check effective_donvi (null = all, value = specific facility)
      (v_role = 'global' AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi))
      OR
      -- Non-global role: check both effective_donvi and allowed list
      (v_role <> 'global' AND (
        (v_effective_donvi IS NOT NULL AND tb.don_vi = v_effective_donvi) OR
        (v_effective_donvi IS NULL AND tb.don_vi = ANY(v_allowed))
      ))
    )
    AND (p_status IS NULL OR p_status = '' OR r.trang_thai = p_status)
    AND (
      p_q IS NULL OR p_q = '' OR
      r.mo_ta_su_co ILIKE '%' || p_q || '%' OR
      r.hang_muc_sua_chua ILIKE '%' || p_q || '%' OR
      tb.ten_thiet_bi ILIKE '%' || p_q || '%' OR
      tb.ma_thiet_bi ILIKE '%' || p_q || '%'
    );

  -- Get paginated data
  SELECT COALESCE(jsonb_agg(row_data ORDER BY ngay_yeu_cau DESC), '[]'::jsonb) INTO v_data
  FROM (
    SELECT 
      jsonb_build_object(
        'id', r.id,
        'thiet_bi_id', r.thiet_bi_id,
        'ngay_yeu_cau', r.ngay_yeu_cau,
        'trang_thai', r.trang_thai,
        'mo_ta_su_co', r.mo_ta_su_co,
        'hang_muc_sua_chua', r.hang_muc_sua_chua,
        'ngay_mong_muon_hoan_thanh', r.ngay_mong_muon_hoan_thanh,
        'nguoi_yeu_cau', r.nguoi_yeu_cau,
        'ngay_duyet', r.ngay_duyet,
        'ngay_hoan_thanh', r.ngay_hoan_thanh,
        'nguoi_duyet', r.nguoi_duyet,
        'nguoi_xac_nhan', r.nguoi_xac_nhan,
        'don_vi_thuc_hien', r.don_vi_thuc_hien,
        'ten_don_vi_thue', r.ten_don_vi_thue,
        'ket_qua_sua_chua', r.ket_qua_sua_chua,
        'ly_do_khong_hoan_thanh', r.ly_do_khong_hoan_thanh,
        'thiet_bi', jsonb_build_object(
          'ten_thiet_bi', tb.ten_thiet_bi,
          'ma_thiet_bi', tb.ma_thiet_bi,
          'model', tb.model,
          'serial', tb.serial,
          'khoa_phong_quan_ly', tb.khoa_phong_quan_ly,
          'facility_name', dv.name,
          'facility_id', tb.don_vi
        )
      ) as row_data,
      r.ngay_yeu_cau
    FROM public.yeu_cau_sua_chua r
    JOIN public.thiet_bi tb ON tb.id = r.thiet_bi_id
    LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
    WHERE (
        -- Global role: check effective_donvi
        (v_role = 'global' AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi))
        OR
        -- Non-global role: check both effective_donvi and allowed list
        (v_role <> 'global' AND (
          (v_effective_donvi IS NOT NULL AND tb.don_vi = v_effective_donvi) OR
          (v_effective_donvi IS NULL AND tb.don_vi = ANY(v_allowed))
        ))
      )
      AND (p_status IS NULL OR p_status = '' OR r.trang_thai = p_status)
      AND (
        p_q IS NULL OR p_q = '' OR
        r.mo_ta_su_co ILIKE '%' || p_q || '%' OR
        r.hang_muc_sua_chua ILIKE '%' || p_q || '%' OR
        tb.ten_thiet_bi ILIKE '%' || p_q || '%' OR
        tb.ma_thiet_bi ILIKE '%' || p_q || '%'
      )
    ORDER BY r.ngay_yeu_cau DESC
    OFFSET v_offset
    LIMIT v_limit
  ) subquery;

  -- Return paginated response matching equipment_list_enhanced format
  RETURN jsonb_build_object(
    'data', v_data,
    'total', v_total,
    'page', p_page,
    'pageSize', p_page_size
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.repair_request_list(TEXT, TEXT, INT, INT, BIGINT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.repair_request_list IS 
'Lists repair requests with equipment and facility information. 
Supports server-side pagination and facility filtering (p_don_vi parameter).
Returns paginated response with total count matching equipment_list_enhanced pattern.
Regional leaders can filter by specific facility using p_don_vi parameter.';

-- ==============================================================================
-- PERFORMANCE INDEXES (Create if not exists)
-- ==============================================================================

-- Index for tenant filtering on thiet_bi.don_vi (critical for WHERE clause performance)
CREATE INDEX IF NOT EXISTS idx_thiet_bi_don_vi 
  ON public.thiet_bi(don_vi) 
  WHERE don_vi IS NOT NULL;

-- Index for repair request foreign key join (already exists via FK, but verify)
CREATE INDEX IF NOT EXISTS idx_yeu_cau_sua_chua_thiet_bi_id 
  ON public.yeu_cau_sua_chua(thiet_bi_id);

-- Composite index for status filtering + sorting (covers common query patterns)
CREATE INDEX IF NOT EXISTS idx_yeu_cau_sua_chua_status_date 
  ON public.yeu_cau_sua_chua(trang_thai, ngay_yeu_cau DESC);

-- Index for text search on repair request fields
CREATE INDEX IF NOT EXISTS idx_yeu_cau_sua_chua_text_search 
  ON public.yeu_cau_sua_chua USING gin(
    to_tsvector('simple', COALESCE(mo_ta_su_co, '') || ' ' || COALESCE(hang_muc_sua_chua, ''))
  );

-- Index for equipment text search
CREATE INDEX IF NOT EXISTS idx_thiet_bi_text_search 
  ON public.thiet_bi USING gin(
    to_tsvector('simple', COALESCE(ten_thiet_bi, '') || ' ' || COALESCE(ma_thiet_bi, ''))
  );

-- ==============================================================================
-- HELPER FUNCTION VALIDATION
-- ==============================================================================

-- Verify _get_jwt_claim exists and is SECURITY INVOKER (safe)
DO $$
DECLARE
  v_prosecdef BOOLEAN;
  v_provolatile CHAR;
BEGIN
  SELECT prosecdef, provolatile INTO v_prosecdef, v_provolatile
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = '_get_jwt_claim';
  
  IF NOT FOUND THEN
    RAISE WARNING 'Helper function public._get_jwt_claim not found. Ensure it exists and is SECURITY INVOKER.';
  ELSIF v_prosecdef THEN
    RAISE WARNING 'Helper function public._get_jwt_claim is SECURITY DEFINER. Consider changing to SECURITY INVOKER for safety.';
  END IF;
  
  -- Verify it's STABLE or IMMUTABLE for performance (optional but recommended)
  IF v_provolatile = 'v' THEN
    RAISE NOTICE 'Helper function public._get_jwt_claim is VOLATILE. Consider STABLE if it only reads session state.';
  END IF;
END $$;

-- Verify allowed_don_vi_for_session exists and is safe
DO $$
DECLARE
  v_prosecdef BOOLEAN;
  v_provolatile CHAR;
  v_return_type TEXT;
BEGIN
  SELECT prosecdef, provolatile, pg_get_function_result(p.oid) 
  INTO v_prosecdef, v_provolatile, v_return_type
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'allowed_don_vi_for_session';
  
  IF NOT FOUND THEN
    RAISE WARNING 'Helper function public.allowed_don_vi_for_session not found. Ensure it exists and is SECURITY INVOKER.';
  ELSIF v_prosecdef THEN
    RAISE WARNING 'Helper function public.allowed_don_vi_for_session is SECURITY DEFINER. Verify tenant isolation logic.';
  END IF;
  
  -- Verify return type is bigint[] for safe array comparison
  IF v_return_type IS NULL OR NOT v_return_type LIKE '%bigint%' THEN
    RAISE WARNING 'Helper function public.allowed_don_vi_for_session may not return bigint[]. Verify type matches tb.don_vi.';
  END IF;
  
  IF v_provolatile = 'v' THEN
    RAISE NOTICE 'Helper function public.allowed_don_vi_for_session is VOLATILE. This is acceptable if it reads session/user state.';
  END IF;
END $$;

-- ==============================================================================
-- SECURITY NOTES
-- ==============================================================================
-- 1. This function uses SECURITY DEFINER to bypass RLS (no RLS on tables)
-- 2. Tenant isolation enforced via WHERE clause checking tb.don_vi
-- 3. Helper functions MUST be SECURITY INVOKER to prevent privilege escalation
-- 4. Function relies on JWT claims (app_role, don_vi) set by middleware
-- 5. Global users can see all facilities; non-global users restricted by allowed_don_vi_for_session()
-- 6. Array comparison tb.don_vi = ANY(v_allowed) is type-safe (both bigint)
-- ==============================================================================
