-- Append-only catalog policy; original signature, authorization and ACL retained.
BEGIN;

CREATE OR REPLACE FUNCTION public.usage_session_start(p_thiet_bi_id bigint, p_nguoi_su_dung_id bigint DEFAULT NULL::bigint, p_tinh_trang_thiet_bi text DEFAULT NULL::text, p_ghi_chu text DEFAULT NULL::text, p_don_vi bigint DEFAULT NULL::bigint, p_tinh_trang_ban_dau text DEFAULT NULL::text)
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
  v_equipment_status text;
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

  select tb.don_vi, tb.tinh_trang_hien_tai into v_equipment_don_vi, v_equipment_status
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

  IF EXISTS (SELECT 1 FROM public.equipment_status_catalog sc
    WHERE sc.status_value = v_equipment_status AND sc.blocks_operational_actions) THEN
    RAISE EXCEPTION 'equipment_status_blocks_operational_actions' USING ERRCODE = '55000';
  END IF;

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

COMMIT;
