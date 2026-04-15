-- Migration: usage_log_split_status_columns
-- Purpose: Split tinh_trang_thiet_bi into tinh_trang_ban_dau + tinh_trang_ket_thuc
-- Security fixes: usage_session_end DDL search_path + admin role guard
-- Rollback note (forward-only): restore prior RPC bodies from
--   - 20260219032645_fix_workflow_guard_security_and_race.sql (usage_session_start)
--   - 20250927_usage_log_rpcs.sql (usage_session_end)
--   - 20260213100500_equipment_soft_delete_historical_read_policy.sql
--     plus 20260216141000_fix_report_and_historical_rpc_security_and_types.sql
--     (usage_log_list hardening)
-- Reverse the function definitions before touching the split-status columns.
-- Dropping tinh_trang_ban_dau / tinh_trang_ket_thuc, or removing legacy
-- tinh_trang_thiet_bi, is only safe before production data is written into the
-- new columns.

BEGIN;

-- =============================================================================
-- 1. Schema: add new columns
-- =============================================================================

ALTER TABLE public.nhat_ky_su_dung
  ADD COLUMN IF NOT EXISTS tinh_trang_ban_dau text,
  ADD COLUMN IF NOT EXISTS tinh_trang_ket_thuc text;

-- =============================================================================
-- 2. Backfill from legacy tinh_trang_thiet_bi (approximation for historical data)
-- =============================================================================

UPDATE public.nhat_ky_su_dung
SET tinh_trang_ban_dau = tinh_trang_thiet_bi
WHERE tinh_trang_ban_dau IS NULL
  AND tinh_trang_thiet_bi IS NOT NULL;

UPDATE public.nhat_ky_su_dung
SET tinh_trang_ket_thuc = tinh_trang_thiet_bi
WHERE tinh_trang_ket_thuc IS NULL
  AND tinh_trang_thiet_bi IS NOT NULL
  AND trang_thai = 'hoan_thanh';

-- =============================================================================
-- 3. usage_session_start: add p_tinh_trang_ban_dau param
--    DROP old signature first to avoid overload ambiguity
-- =============================================================================

DROP FUNCTION IF EXISTS public.usage_session_start(bigint, bigint, text, text, bigint);

CREATE OR REPLACE FUNCTION public.usage_session_start(
  p_thiet_bi_id bigint,
  p_nguoi_su_dung_id bigint DEFAULT NULL::bigint,
  p_tinh_trang_thiet_bi text DEFAULT NULL::text,
  p_ghi_chu text DEFAULT NULL::text,
  p_don_vi bigint DEFAULT NULL::bigint,
  p_tinh_trang_ban_dau text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text := lower(coalesce(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_is_global boolean := false;
  v_allowed bigint[] := null;
  v_user_id bigint := nullif(public._get_jwt_claim('user_id'), '')::bigint;
  v_target_user bigint;
  v_equipment_don_vi bigint;
  v_new_id bigint;
  result jsonb;
BEGIN
  v_is_global := v_role in ('global', 'admin');

  if v_role is null or v_role = '' then
    raise exception 'Missing role claim' using errcode = '42501';
  end if;

  if p_thiet_bi_id is null then
    raise exception 'Equipment ID is required' using errcode = '22023';
  end if;

  -- Validate new param: NULL = skip (backward compat), empty = reject
  if p_tinh_trang_ban_dau is not null and trim(p_tinh_trang_ban_dau) = '' then
    raise exception 'Initial equipment status cannot be empty' using errcode = '22023';
  end if;

  if v_role = 'regional_leader' then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  if v_user_id is null then
    raise exception 'Authenticated user required' using errcode = '42501';
  end if;

  v_target_user := coalesce(p_nguoi_su_dung_id, v_user_id);

  if not (v_is_global or v_role in ('to_qltb', 'technician', 'qltb_khoa'))
     and v_target_user <> v_user_id then
    raise exception 'Cannot start session for another user' using errcode = '42501';
  end if;

  select tb.don_vi into v_equipment_don_vi
  from public.thiet_bi tb
  where tb.id = p_thiet_bi_id
    and tb.is_deleted = false
  for update;

  if not found then
    raise exception 'Equipment not found' using errcode = 'P0002';
  end if;

  if not v_is_global then
    v_allowed := public.allowed_don_vi_for_session();
    if v_allowed is null or array_length(v_allowed, 1) is null or not v_equipment_don_vi = any(v_allowed) then
      raise exception 'Access denied for equipment tenant' using errcode = '42501';
    end if;
  else
    if p_don_vi is not null then
      v_equipment_don_vi := p_don_vi;
    end if;
  end if;

  perform 1
  from public.nhat_ky_su_dung nk
  where nk.thiet_bi_id = p_thiet_bi_id
    and nk.trang_thai = 'dang_su_dung';

  if found then
    raise exception 'Thiết bị đang được sử dụng bởi người khác' using errcode = 'P0001';
  end if;

  insert into public.nhat_ky_su_dung (
    thiet_bi_id,
    nguoi_su_dung_id,
    thoi_gian_bat_dau,
    tinh_trang_thiet_bi,
    tinh_trang_ban_dau,
    ghi_chu,
    trang_thai,
    created_at,
    updated_at
  )
  values (
    p_thiet_bi_id,
    v_target_user,
    timezone('utc', now()),
    coalesce(p_tinh_trang_ban_dau, p_tinh_trang_thiet_bi),
    p_tinh_trang_ban_dau,
    p_ghi_chu,
    'dang_su_dung',
    timezone('utc', now()),
    timezone('utc', now())
  )
  returning id into v_new_id;

  select jsonb_build_object(
    'id', nk.id,
    'thiet_bi_id', nk.thiet_bi_id,
    'nguoi_su_dung_id', nk.nguoi_su_dung_id,
    'thoi_gian_bat_dau', nk.thoi_gian_bat_dau,
    'thoi_gian_ket_thuc', nk.thoi_gian_ket_thuc,
    'tinh_trang_thiet_bi', nk.tinh_trang_thiet_bi,
    'tinh_trang_ban_dau', nk.tinh_trang_ban_dau,
    'tinh_trang_ket_thuc', nk.tinh_trang_ket_thuc,
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
    'nguoi_su_dung', case
      when nv.id is not null then jsonb_build_object(
        'id', nv.id,
        'full_name', nv.full_name,
        'khoa_phong', nv.khoa_phong
      )
      else null
    end
  )
  into result
  from public.nhat_ky_su_dung nk
  join public.thiet_bi tb on tb.id = nk.thiet_bi_id
  left join public.nhan_vien nv on nv.id = nk.nguoi_su_dung_id
  where nk.id = v_new_id;

  return result;
END;
$function$;

-- =============================================================================
-- 4. usage_session_end: add p_tinh_trang_ket_thuc + fix search_path + admin guard
--    DROP old signature first to avoid overload ambiguity
-- =============================================================================

DROP FUNCTION IF EXISTS public.usage_session_end(bigint, text, text, bigint);

CREATE OR REPLACE FUNCTION public.usage_session_end(
  p_usage_log_id bigint,
  p_tinh_trang_thiet_bi text DEFAULT NULL::text,
  p_ghi_chu text DEFAULT NULL::text,
  p_don_vi bigint DEFAULT NULL::bigint,
  p_tinh_trang_ket_thuc text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text := lower(coalesce(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_is_global boolean := false;
  v_allowed bigint[] := public.allowed_don_vi_for_session();
  v_user_id bigint := nullif(public._get_jwt_claim('user_id'), '')::bigint;
  rec record;
  result jsonb;
BEGIN
  v_is_global := v_role in ('global', 'admin');

  if p_usage_log_id is null then
    raise exception 'Usage log ID is required' using errcode = '22023';
  end if;

  -- Validate new param: NULL = skip (backward compat), empty = reject
  if p_tinh_trang_ket_thuc is not null and trim(p_tinh_trang_ket_thuc) = '' then
    raise exception 'Final equipment status cannot be empty' using errcode = '22023';
  end if;

  if v_role = 'regional_leader' then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  if v_role is null or v_role = '' then
    raise exception 'Missing role claim' using errcode = '42501';
  end if;

  if v_user_id is null then
    raise exception 'Missing user_id claim' using errcode = '42501';
  end if;

  select nk.*, tb.don_vi as equipment_don_vi
  into rec
  from public.nhat_ky_su_dung nk
  join public.thiet_bi tb on tb.id = nk.thiet_bi_id
  where nk.id = p_usage_log_id
  for update;

  if not found then
    raise exception 'Usage session not found' using errcode = 'P0002';
  end if;

  if rec.trang_thai != 'dang_su_dung' then
    raise exception 'Usage session already closed' using errcode = 'P0001';
  end if;

  -- FIX: use v_is_global instead of v_role <> 'global' (includes admin)
  if not v_is_global then
    if v_allowed is null or array_length(v_allowed, 1) is null or not rec.equipment_don_vi = any(v_allowed) then
      raise exception 'Access denied for equipment tenant' using errcode = '42501';
    end if;
  else
    if p_don_vi is not null then
      rec.equipment_don_vi := p_don_vi;
    end if;
  end if;

  if v_role in ('user', 'qltb_khoa') and rec.nguoi_su_dung_id is distinct from v_user_id then
    raise exception 'Cannot close session for another user' using errcode = '42501';
  end if;

  update public.nhat_ky_su_dung
  set thoi_gian_ket_thuc = timezone('utc', now()),
      tinh_trang_thiet_bi = coalesce(p_tinh_trang_ket_thuc, p_tinh_trang_thiet_bi, rec.tinh_trang_thiet_bi),
      tinh_trang_ket_thuc = p_tinh_trang_ket_thuc,
      ghi_chu = coalesce(p_ghi_chu, rec.ghi_chu),
      trang_thai = 'hoan_thanh',
      updated_at = timezone('utc', now())
  where id = p_usage_log_id;

  select jsonb_build_object(
    'id', nk.id,
    'thiet_bi_id', nk.thiet_bi_id,
    'nguoi_su_dung_id', nk.nguoi_su_dung_id,
    'thoi_gian_bat_dau', nk.thoi_gian_bat_dau,
    'thoi_gian_ket_thuc', nk.thoi_gian_ket_thuc,
    'tinh_trang_thiet_bi', nk.tinh_trang_thiet_bi,
    'tinh_trang_ban_dau', nk.tinh_trang_ban_dau,
    'tinh_trang_ket_thuc', nk.tinh_trang_ket_thuc,
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
    'nguoi_su_dung', case
      when nv.id is not null then jsonb_build_object(
        'id', nv.id,
        'full_name', nv.full_name,
        'khoa_phong', nv.khoa_phong
      )
      else null
    end
  )
  into result
  from public.nhat_ky_su_dung nk
  join public.thiet_bi tb on tb.id = nk.thiet_bi_id
  left join public.nhan_vien nv on nv.id = nk.nguoi_su_dung_id
  where nk.id = p_usage_log_id;

  return result;
END;
$function$;

-- =============================================================================
-- 5. usage_log_list (8-param): add new fields to JSON projection
--    Signature unchanged - CREATE OR REPLACE is safe
-- =============================================================================

CREATE OR REPLACE FUNCTION public.usage_log_list(
  p_thiet_bi_id bigint DEFAULT NULL::bigint,
  p_trang_thai text DEFAULT NULL::text,
  p_active_only boolean DEFAULT false,
  p_started_from timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_started_to timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_limit integer DEFAULT 200,
  p_offset integer DEFAULT 0,
  p_don_vi bigint DEFAULT NULL::bigint
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_is_global BOOLEAN := false;
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_effective BIGINT[] := NULL;
  v_limit INT := GREATEST(p_limit, 1);
  v_offset INT := GREATEST(p_offset, 0);
BEGIN
  v_is_global := v_role IN ('global', 'admin');

  IF p_trang_thai IS NOT NULL AND p_trang_thai NOT IN ('dang_su_dung', 'hoan_thanh') THEN
    RAISE EXCEPTION 'Invalid status filter' USING ERRCODE = '22023';
  END IF;

  IF v_is_global THEN
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
    'tinh_trang_ban_dau', nk.tinh_trang_ban_dau,
    'tinh_trang_ket_thuc', nk.tinh_trang_ket_thuc,
    'ghi_chu', nk.ghi_chu,
    'trang_thai', nk.trang_thai,
    'created_at', nk.created_at,
    'updated_at', nk.updated_at,
    'equipment_is_deleted', tb.is_deleted,
    'thiet_bi', jsonb_build_object(
      'id', tb.id,
      'ma_thiet_bi', tb.ma_thiet_bi,
      'ten_thiet_bi', tb.ten_thiet_bi,
      'khoa_phong_quan_ly', tb.khoa_phong_quan_ly,
      'don_vi', tb.don_vi,
      'is_deleted', tb.is_deleted
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
  LEFT JOIN public.thiet_bi tb ON tb.id = nk.thiet_bi_id
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
$function$;

-- NOTE: The 7-param usage_log_list overload uses to_jsonb(nk)
-- which auto-includes all columns. No code change needed for it.

-- =============================================================================
-- 6. Grant execute on updated functions
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.usage_session_start(bigint, bigint, text, text, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.usage_session_end(bigint, text, text, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.usage_log_list(bigint, text, boolean, timestamptz, timestamptz, integer, integer, bigint) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.usage_session_start(bigint, bigint, text, text, bigint, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.usage_session_end(bigint, text, text, bigint, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.usage_log_list(bigint, text, boolean, timestamptz, timestamptz, integer, integer, bigint) FROM PUBLIC;

COMMIT;
