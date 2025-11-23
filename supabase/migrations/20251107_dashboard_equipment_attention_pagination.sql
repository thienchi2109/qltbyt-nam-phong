-- Add paginated RPC for dashboard equipment attention list
-- Limits data to page-size chunks (default 10) and respects tenant/region filtering
CREATE OR REPLACE FUNCTION public.equipment_attention_list_paginated(
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_role TEXT := '';
  v_allowed_don_vi BIGINT[];
  v_jwt_claims JSONB;
  v_page INT := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size INT := LEAST(GREATEST(COALESCE(p_page_size, 10), 1), 50);
  v_offset INT := 0;
  v_result JSONB;
BEGIN
  v_offset := (v_page - 1) * v_page_size;

  -- Get JWT claims (safe for missing claims)
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'data', '[]'::jsonb,
      'total', 0,
      'page', v_page,
      'pageSize', v_page_size,
      'hasMore', false
    );
  END;
  
  -- Determine app role (fallback to role)
  v_role := lower(COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  ));
  
  -- Resolve allowed facilities (handles regional leaders)
  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();
  
  IF v_role = '' OR v_allowed_don_vi IS NULL OR array_length(v_allowed_don_vi, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'data', '[]'::jsonb,
      'total', 0,
      'page', v_page,
      'pageSize', v_page_size,
      'hasMore', false
    );
  END IF;

  WITH filtered AS (
    SELECT 
      tb.id,
      tb.ten_thiet_bi,
      tb.ma_thiet_bi,
      tb.model,
      tb.tinh_trang_hien_tai,
      tb.vi_tri_lap_dat,
      tb.ngay_bt_tiep_theo
    FROM public.thiet_bi tb
    WHERE (
      v_role = 'global'
      OR tb.don_vi = ANY(v_allowed_don_vi)
    )
    AND tb.tinh_trang_hien_tai IN ('Chờ sửa chữa', 'Chờ bảo trì', 'Chờ hiệu chuẩn/kiểm định')
  ),
  totals AS (
    SELECT COUNT(*)::BIGINT AS total FROM filtered
  ),
  paged AS (
    SELECT * FROM filtered
    ORDER BY ngay_bt_tiep_theo ASC NULLS LAST, id ASC
    LIMIT v_page_size OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'data', COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object(
          'id', p.id,
          'ten_thiet_bi', p.ten_thiet_bi,
          'ma_thiet_bi', p.ma_thiet_bi,
          'model', p.model,
          'tinh_trang_hien_tai', p.tinh_trang_hien_tai,
          'vi_tri_lap_dat', p.vi_tri_lap_dat,
          'ngay_bt_tiep_theo', p.ngay_bt_tiep_theo
        )) FROM paged p
      ),
      '[]'::jsonb
    ),
    'total', COALESCE((SELECT total FROM totals), 0),
    'page', v_page,
    'pageSize', v_page_size,
    'hasMore', COALESCE((SELECT total FROM totals), 0) > (v_offset + v_page_size)
  ) INTO v_result;

  RETURN COALESCE(v_result, jsonb_build_object(
    'data', '[]'::jsonb,
    'total', 0,
    'page', v_page,
    'pageSize', v_page_size,
    'hasMore', false
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_attention_list_paginated(INT, INT) TO authenticated;

COMMENT ON FUNCTION public.equipment_attention_list_paginated(INT, INT) IS
'Paginated equipment list for dashboard attention card; defaults to 10 items/page and respects tenant + regional leader scope.';
