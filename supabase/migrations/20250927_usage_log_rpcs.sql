-- Usage log RPC suite for tenant-aware access control
-- Provides read/write helpers for usage history and active sessions
-- Migration Date: 2025-09-27 17:45 UTC

BEGIN;

-- ============================================================================
-- usage_log_list : secure reader for usage history / active sessions
-- ============================================================================
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

  IF p_trang_thai IS NOT NULL AND p_trang_thai NOT IN ('dang_su_dung', 'hoan_thanh') THEN
    RAISE EXCEPTION 'Invalid status filter' USING ERRCODE = '22023';
  END IF;

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
  OFFSET v_offset
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.usage_log_list(BIGINT, TEXT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, INT, INT, BIGINT) TO authenticated;

-- ============================================================================
-- usage_session_start : begin a usage session with tenant + role checks
-- ============================================================================
CREATE OR REPLACE FUNCTION public.usage_session_start(
  p_thiet_bi_id BIGINT,
  p_nguoi_su_dung_id BIGINT DEFAULT NULL,
  p_tinh_trang_thiet_bi TEXT DEFAULT NULL,
  p_ghi_chu TEXT DEFAULT NULL,
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_user_id BIGINT := NULLIF(public._get_jwt_claim('user_id'), '')::BIGINT;
  v_target_user BIGINT;
  v_equipment_don_vi BIGINT;
  v_new_id BIGINT;
  result JSONB;
BEGIN
  PERFORM set_config('search_path', 'public', true);

  IF p_thiet_bi_id IS NULL THEN
    RAISE EXCEPTION 'Equipment ID is required' USING ERRCODE = '22023';
  END IF;

  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated user required' USING ERRCODE = '42501';
  END IF;

  v_target_user := COALESCE(p_nguoi_su_dung_id, v_user_id);

  IF v_role NOT IN ('global', 'to_qltb', 'technician', 'qltb_khoa') AND v_target_user <> v_user_id THEN
    RAISE EXCEPTION 'Cannot start session for another user' USING ERRCODE = '42501';
  END IF;

  SELECT tb.don_vi INTO v_equipment_don_vi
  FROM public.thiet_bi tb
  WHERE tb.id = p_thiet_bi_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipment not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_role <> 'global' THEN
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL OR NOT v_equipment_don_vi = ANY(v_allowed) THEN
      RAISE EXCEPTION 'Access denied for equipment tenant' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF p_don_vi IS NOT NULL THEN
      v_equipment_don_vi := p_don_vi;
    END IF;
  END IF;

  PERFORM 1
  FROM public.nhat_ky_su_dung nk
  WHERE nk.thiet_bi_id = p_thiet_bi_id
    AND nk.trang_thai = 'dang_su_dung';

  IF FOUND THEN
    RAISE EXCEPTION 'Thiết bị đang được sử dụng bởi người khác' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.nhat_ky_su_dung (
    thiet_bi_id,
    nguoi_su_dung_id,
    thoi_gian_bat_dau,
    tinh_trang_thiet_bi,
    ghi_chu,
    trang_thai,
    created_at,
    updated_at
  )
  VALUES (
    p_thiet_bi_id,
    v_target_user,
    timezone('utc', now()),
    p_tinh_trang_thiet_bi,
    p_ghi_chu,
    'dang_su_dung',
    timezone('utc', now()),
    timezone('utc', now())
  )
  RETURNING id INTO v_new_id;

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
  INTO result
  FROM public.nhat_ky_su_dung nk
  JOIN public.thiet_bi tb ON tb.id = nk.thiet_bi_id
  LEFT JOIN public.nhan_vien nv ON nv.id = nk.nguoi_su_dung_id
  WHERE nk.id = v_new_id;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.usage_session_start(BIGINT, BIGINT, TEXT, TEXT, BIGINT) TO authenticated;

-- ============================================================================
-- usage_session_end : close an active usage session securely
-- ============================================================================
CREATE OR REPLACE FUNCTION public.usage_session_end(
  p_usage_log_id BIGINT,
  p_tinh_trang_thiet_bi TEXT DEFAULT NULL,
  p_ghi_chu TEXT DEFAULT NULL,
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_user_id BIGINT := NULLIF(public._get_jwt_claim('user_id'), '')::BIGINT;
  rec RECORD;
  result JSONB;
BEGIN
  PERFORM set_config('search_path', 'public', true);

  IF p_usage_log_id IS NULL THEN
    RAISE EXCEPTION 'Usage log ID is required' USING ERRCODE = '22023';
  END IF;

  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  SELECT nk.*, tb.don_vi AS equipment_don_vi
  INTO rec
  FROM public.nhat_ky_su_dung nk
  JOIN public.thiet_bi tb ON tb.id = nk.thiet_bi_id
  WHERE nk.id = p_usage_log_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usage session not found' USING ERRCODE = 'P0002';
  END IF;

  IF rec.trang_thai != 'dang_su_dung' THEN
    RAISE EXCEPTION 'Usage session already closed' USING ERRCODE = 'P0001';
  END IF;

  IF v_role <> 'global' THEN
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL OR NOT rec.equipment_don_vi = ANY(v_allowed) THEN
      RAISE EXCEPTION 'Access denied for equipment tenant' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF p_don_vi IS NOT NULL THEN
      rec.equipment_don_vi := p_don_vi;
    END IF;
  END IF;

  IF v_role IN ('user', 'qltb_khoa') AND rec.nguoi_su_dung_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Cannot close session for another user' USING ERRCODE = '42501';
  END IF;

  UPDATE public.nhat_ky_su_dung
  SET thoi_gian_ket_thuc = timezone('utc', now()),
      tinh_trang_thiet_bi = COALESCE(p_tinh_trang_thiet_bi, rec.tinh_trang_thiet_bi),
      ghi_chu = COALESCE(p_ghi_chu, rec.ghi_chu),
      trang_thai = 'hoan_thanh',
      updated_at = timezone('utc', now())
  WHERE id = p_usage_log_id;

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
  INTO result
  FROM public.nhat_ky_su_dung nk
  JOIN public.thiet_bi tb ON tb.id = nk.thiet_bi_id
  LEFT JOIN public.nhan_vien nv ON nv.id = nk.nguoi_su_dung_id
  WHERE nk.id = p_usage_log_id;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.usage_session_end(BIGINT, TEXT, TEXT, BIGINT) TO authenticated;

-- ============================================================================
-- usage_log_delete : admin-only deletion of completed sessions
-- ============================================================================
CREATE OR REPLACE FUNCTION public.usage_log_delete(
  p_usage_log_id BIGINT,
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  rec RECORD;
BEGIN
  PERFORM set_config('search_path', 'public', true);

  IF p_usage_log_id IS NULL THEN
    RAISE EXCEPTION 'Usage log ID is required' USING ERRCODE = '22023';
  END IF;

  IF v_role <> 'global' THEN
    RAISE EXCEPTION 'Only global administrators may delete usage logs' USING ERRCODE = '42501';
  END IF;

  SELECT nk.*, tb.don_vi AS equipment_don_vi
  INTO rec
  FROM public.nhat_ky_su_dung nk
  JOIN public.thiet_bi tb ON tb.id = nk.thiet_bi_id
  WHERE nk.id = p_usage_log_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usage log not found' USING ERRCODE = 'P0002';
  END IF;

  IF rec.trang_thai <> 'hoan_thanh' THEN
    RAISE EXCEPTION 'Only completed sessions may be deleted' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.nhat_ky_su_dung WHERE id = p_usage_log_id;

  RETURN jsonb_build_object('success', TRUE, 'id', p_usage_log_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.usage_log_delete(BIGINT, BIGINT) TO authenticated;

COMMIT;
