-- Verify and update usage_log_list RPC to ensure all optimization parameters are supported
-- This ensures the performance optimizations work correctly
-- Date: 2025-09-27

BEGIN;

-- Check if usage_log_list already has the required parameters by attempting to call it
-- The function should support: p_started_from, p_offset parameters for date windowing and pagination

-- Drop and recreate with all required parameters if needed (idempotent)
CREATE OR REPLACE FUNCTION public.usage_log_list(
  p_thiet_bi_id BIGINT DEFAULT NULL,
  p_trang_thai TEXT DEFAULT NULL,
  p_active_only BOOLEAN DEFAULT FALSE,
  p_started_from TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_started_to TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_limit INT DEFAULT 200,
  p_offset INT DEFAULT 0,
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_effective BIGINT[] := NULL;
  v_limit INT := GREATEST(p_limit, 1);
  v_offset INT := GREATEST(p_offset, 0);
BEGIN
  PERFORM set_config('search_path', 'public', true);

  -- Validate status parameter
  IF p_trang_thai IS NOT NULL AND p_trang_thai NOT IN ('dang_su_dung', 'hoan_thanh') THEN
    RAISE EXCEPTION 'Invalid status filter' USING ERRCODE = '22023';
  END IF;

  -- Tenant isolation logic
  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    END IF;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF NOT p_don_vi = ANY(v_allowed) THEN
        RAISE EXCEPTION 'Access denied for tenant %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := v_allowed;
    END IF;
  END IF;

  -- Return filtered usage logs with support for date windowing and pagination
  RETURN QUERY
  SELECT jsonb_build_object(
    'id', nk.id,
    'thiet_bi_id', nk.thiet_bi_id,
    'nguoi_su_dung_id', nk.nguoi_su_dung_id,
    'thoi_gian_bat_dau', nk.thoi_gian_bat_dau,
    'thoi_gian_ket_thuc', nk.thoi_gian_ket_thuc,
    'tinh_trang_thiet_bi', nk.tinh_trang_thiet_bi,
    'ghi_chu', nk.ghi_chu,
    'trang_thai', nk.trang_thai,
    'created_at', nk.created_at,
    'updated_at', nk.updated_at,
    'thiet_bi', jsonb_build_object(
      'id', tb.id,
      'ma_thiet_bi', tb.ma_thiet_bi,
      'ten_thiet_bi', tb.ten_thiet_bi,
      'khoa_phong_quan_ly', tb.khoa_phong_quan_ly,
      'don_vi', tb.don_vi
    ),
    'nguoi_su_dung', CASE
      WHEN nv.id IS NOT NULL THEN jsonb_build_object(
        'id', nv.id,
        'full_name', nv.full_name,
        'khoa_phong', nv.khoa_phong
      )
      ELSE NULL
    END
  )
  FROM public.nhat_ky_su_dung nk
  JOIN public.thiet_bi tb ON tb.id = nk.thiet_bi_id
  LEFT JOIN public.nhan_vien nv ON nv.id = nk.nguoi_su_dung_id
  WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
    AND (p_thiet_bi_id IS NULL OR nk.thiet_bi_id = p_thiet_bi_id)
    AND (NOT p_active_only OR nk.trang_thai = 'dang_su_dung')
    AND (p_trang_thai IS NULL OR nk.trang_thai = p_trang_thai)
    AND (p_started_from IS NULL OR nk.thoi_gian_bat_dau >= p_started_from)
    AND (p_started_to IS NULL OR nk.thoi_gian_bat_dau <= p_started_to)
  ORDER BY nk.thoi_gian_bat_dau DESC
  OFFSET v_offset LIMIT v_limit;
END;
$$;

-- Ensure proper permissions
GRANT EXECUTE ON FUNCTION public.usage_log_list(BIGINT, TEXT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, INT, INT, BIGINT) TO authenticated;

COMMIT;