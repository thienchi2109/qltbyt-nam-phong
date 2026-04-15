-- Fix usage_session_end admin/global bypass to avoid eager tenant-scope resolution
-- The split-status migration left v_allowed initialized from allowed_don_vi_for_session()
-- in the DECLARE block. Raw admin JWTs without don_vi can fail there before the
-- function body reaches the v_is_global bypass branch.

BEGIN;

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
  v_allowed bigint[] := null;
  v_user_id bigint := nullif(public._get_jwt_claim('user_id'), '')::bigint;
  rec record;
  result jsonb;
BEGIN
  v_is_global := v_role in ('global', 'admin');

  if p_usage_log_id is null then
    raise exception 'Usage log ID is required' using errcode = '22023';
  end if;

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

  if not v_is_global then
    v_allowed := public.allowed_don_vi_for_session();
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

GRANT EXECUTE ON FUNCTION public.usage_session_end(bigint, text, text, bigint, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.usage_session_end(bigint, text, text, bigint, text) FROM PUBLIC;

COMMIT;
