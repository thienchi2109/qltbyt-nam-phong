-- Migration: Fix workflow guard security issues and race condition
-- Date: 2026-02-19
-- Fixes:
--   P1  usage_session_start: add FOR UPDATE to equipment lookup to prevent TOCTOU race
--   P2  usage_session_start: replace body-level set_config with declarative SET search_path
--   P2  transfer_request_create: server-enforce audit fields (created_by, updated_by,
--       nguoi_yeu_cau_id) — ignore client-supplied values, always use v_user_id
--   P0002 consistency: repair_request_create, transfer_request_create,
--         transfer_request_update all now raise errcode='P0002' for equipment-not-found,
--         matching usage_session_start and allowing the smoke tests to assert SQLSTATE

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. repair_request_create  (P0002 errcode on equipment guard)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.repair_request_create(
  p_thiet_bi_id integer,
  p_mo_ta_su_co text,
  p_hang_muc_sua_chua text,
  p_ngay_mong_muon_hoan_thanh date,
  p_nguoi_yeu_cau text,
  p_don_vi_thuc_hien text,
  p_ten_don_vi_thue text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id int;
  v_claims jsonb;
  v_role text;
  v_is_global boolean := false;
  v_don_vi bigint;
  v_tb record;
BEGIN
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role := lower(coalesce(nullif(v_claims->>'app_role', ''), nullif(v_claims->>'role', '')));
  v_is_global := v_role in ('global', 'admin');
  v_don_vi := nullif(v_claims->>'don_vi', '')::bigint;

  select id, don_vi, tinh_trang_hien_tai
  into v_tb
  from public.thiet_bi
  where id = p_thiet_bi_id
    and is_deleted = false;

  if not found then
    -- FIX: was plain RAISE EXCEPTION (defaulted to P0001); now P0002 (no_data_found)
    raise exception 'Thiết bị không tồn tại' using errcode = 'P0002';
  end if;

  if not v_is_global and v_don_vi is not null and v_tb.don_vi is distinct from v_don_vi then
    raise exception 'Không có quyền trên thiết bị thuộc đơn vị khác';
  end if;

  insert into public.yeu_cau_sua_chua(
    thiet_bi_id,
    mo_ta_su_co,
    hang_muc_sua_chua,
    ngay_mong_muon_hoan_thanh,
    nguoi_yeu_cau,
    trang_thai,
    don_vi_thuc_hien,
    ten_don_vi_thue
  )
  values (
    p_thiet_bi_id,
    p_mo_ta_su_co,
    p_hang_muc_sua_chua,
    p_ngay_mong_muon_hoan_thanh,
    p_nguoi_yeu_cau,
    'Chờ xử lý',
    p_don_vi_thuc_hien,
    p_ten_don_vi_thue
  )
  returning id into v_id;

  update public.thiet_bi
  set tinh_trang_hien_tai = 'Chờ sửa chữa'
  where id = p_thiet_bi_id
    and coalesce(tinh_trang_hien_tai, '') <> 'Chờ sửa chữa';

  insert into public.lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet, yeu_cau_id)
  values (
    p_thiet_bi_id,
    'Sửa chữa',
    'Tạo yêu cầu sửa chữa',
    jsonb_build_object(
      'mo_ta_su_co', p_mo_ta_su_co,
      'hang_muc', p_hang_muc_sua_chua,
      'ngay_mong_muon_hoan_thanh', p_ngay_mong_muon_hoan_thanh,
      'don_vi_thuc_hien', p_don_vi_thuc_hien,
      'ten_don_vi_thue', p_ten_don_vi_thue
    ),
    v_id
  );

  perform public.audit_log(
    'repair_request_create',
    'repair_request',
    v_id,
    null,
    jsonb_build_object('thiet_bi_id', p_thiet_bi_id, 'mo_ta_su_co', p_mo_ta_su_co)
  );

  return v_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.repair_request_create(integer, text, text, date, text, text, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. transfer_request_create  (server-enforce audit fields + P0002)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.transfer_request_create(
  p_data jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id int;
  v_claims jsonb;
  v_role text;
  v_is_global boolean := false;
  v_don_vi text;
  v_user_id int;
  v_tb record;
BEGIN
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role := lower(coalesce(nullif(v_claims->>'app_role', ''), nullif(v_claims->>'role', '')));
  v_is_global := v_role in ('global', 'admin');
  v_don_vi := nullif(v_claims->>'don_vi', '');
  v_user_id := nullif(v_claims->>'user_id', '')::int;

  if v_role is null or v_role = '' then
    raise exception 'Missing role claim in JWT' using errcode = '42501';
  end if;

  if v_role = 'regional_leader' then
    raise exception 'Regional leaders have read-only access to transfers' using errcode = '42501';
  end if;

  select id, don_vi, khoa_phong_quan_ly
  into v_tb
  from public.thiet_bi
  where id = (p_data->>'thiet_bi_id')::int
    and is_deleted = false;

  if not found then
    -- FIX: was plain RAISE EXCEPTION (defaulted to P0001); now P0002 (no_data_found)
    raise exception 'Thiết bị không tồn tại' using errcode = 'P0002';
  end if;

  if not v_is_global and v_don_vi is not null and v_tb.don_vi::text is distinct from v_don_vi then
    raise exception 'Không có quyền trên thiết bị thuộc đơn vị khác';
  end if;

  insert into public.yeu_cau_luan_chuyen(
    thiet_bi_id,
    loai_hinh,
    ly_do_luan_chuyen,
    khoa_phong_hien_tai,
    khoa_phong_nhan,
    muc_dich,
    don_vi_nhan,
    dia_chi_don_vi,
    nguoi_lien_he,
    so_dien_thoai,
    ngay_du_kien_tra,
    nguoi_yeu_cau_id,
    trang_thai,
    created_by,
    updated_by
  )
  values (
    (p_data->>'thiet_bi_id')::int,
    p_data->>'loai_hinh',
    nullif(p_data->>'ly_do_luan_chuyen', ''),
    nullif(p_data->>'khoa_phong_hien_tai', ''),
    nullif(p_data->>'khoa_phong_nhan', ''),
    nullif(p_data->>'muc_dich', ''),
    nullif(p_data->>'don_vi_nhan', ''),
    nullif(p_data->>'dia_chi_don_vi', ''),
    nullif(p_data->>'nguoi_lien_he', ''),
    nullif(p_data->>'so_dien_thoai', ''),
    case
      when coalesce(p_data->>'ngay_du_kien_tra', '') <> '' then (p_data->>'ngay_du_kien_tra')::date
      else null
    end,
    -- FIX: audit fields are now always taken from the server-side JWT user id.
    -- Previously the client could supply nguoi_yeu_cau_id / created_by / updated_by
    -- from p_data and impersonate any user in audit records.
    v_user_id,   -- nguoi_yeu_cau_id
    'cho_duyet',
    v_user_id,   -- created_by
    v_user_id    -- updated_by
  )
  returning id into v_id;

  perform public.audit_log(
    'transfer_request_create',
    'transfer_request',
    v_id,
    null,
    p_data
  );

  return v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.transfer_request_create(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_request_create(jsonb) FROM PUBLIC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. transfer_request_update  (P0002 on target equipment guard)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.transfer_request_update(
  p_id integer,
  p_data jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_req record;
  v_claims jsonb;
  v_role text;
  v_is_global boolean := false;
  v_don_vi text;
  v_tb_don_vi text;
  v_user_id int;
  v_new_thiet_bi_id integer;
  v_target_tb record;
BEGIN
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role := lower(coalesce(nullif(v_claims->>'app_role', ''), nullif(v_claims->>'role', '')));
  v_is_global := v_role in ('global', 'admin');
  v_don_vi := nullif(v_claims->>'don_vi', '');
  v_user_id := nullif(v_claims->>'user_id', '')::int;

  if v_role is null or v_role = '' then
    raise exception 'Missing role claim in JWT' using errcode = '42501';
  end if;

  if v_role = 'regional_leader' then
    raise exception 'Regional leaders have read-only access to transfers' using errcode = '42501';
  end if;

  select t.*, tb.don_vi as tb_don_vi
  into v_req
  from public.yeu_cau_luan_chuyen t
  join public.thiet_bi tb on tb.id = t.thiet_bi_id
  where t.id = p_id;

  if not found then
    raise exception 'Yêu cầu không tồn tại';
  end if;

  v_tb_don_vi := v_req.tb_don_vi;

  if not v_is_global and v_don_vi is not null and v_tb_don_vi is distinct from v_don_vi then
    raise exception 'Không có quyền trên thiết bị thuộc đơn vị khác';
  end if;

  if v_req.trang_thai not in ('cho_duyet', 'da_duyet') then
    raise exception 'Chỉ có thể chỉnh sửa khi yêu cầu ở trạng thái Chờ duyệt hoặc Đã duyệt';
  end if;

  v_new_thiet_bi_id := nullif(p_data->>'thiet_bi_id', '')::int;

  if v_new_thiet_bi_id is not null and v_new_thiet_bi_id is distinct from v_req.thiet_bi_id then
    select tb.id, tb.don_vi
    into v_target_tb
    from public.thiet_bi tb
    where tb.id = v_new_thiet_bi_id
      and tb.is_deleted = false;

    if not found then
      -- FIX: was plain RAISE EXCEPTION (defaulted to P0001); now P0002 (no_data_found)
      raise exception 'Thiết bị không tồn tại' using errcode = 'P0002';
    end if;

    if not v_is_global and v_don_vi is not null and v_target_tb.don_vi::text is distinct from v_don_vi then
      raise exception 'Không có quyền trên thiết bị thuộc đơn vị khác';
    end if;
  end if;

  -- Keep existing partial-update semantics:
  -- - when loai_hinh is omitted: preserve internal/external fields
  -- - when loai_hinh changes: clear opposite field group
  update public.yeu_cau_luan_chuyen set
    thiet_bi_id = coalesce(v_new_thiet_bi_id, thiet_bi_id),
    loai_hinh = coalesce(nullif(p_data->>'loai_hinh', ''), loai_hinh),
    ly_do_luan_chuyen = coalesce(nullif(p_data->>'ly_do_luan_chuyen', ''), ly_do_luan_chuyen),
    khoa_phong_hien_tai = case
      when p_data ? 'loai_hinh' then
        case
          when coalesce(p_data->>'loai_hinh', '') = 'noi_bo' then nullif(p_data->>'khoa_phong_hien_tai', '')
          else null
        end
      else khoa_phong_hien_tai
    end,
    khoa_phong_nhan = case
      when p_data ? 'loai_hinh' then
        case
          when coalesce(p_data->>'loai_hinh', '') = 'noi_bo' then nullif(p_data->>'khoa_phong_nhan', '')
          else null
        end
      else khoa_phong_nhan
    end,
    muc_dich = case
      when p_data ? 'loai_hinh' then
        case
          when coalesce(p_data->>'loai_hinh', '') <> 'noi_bo' then nullif(p_data->>'muc_dich', '')
          else null
        end
      else muc_dich
    end,
    don_vi_nhan = case
      when p_data ? 'loai_hinh' then
        case
          when coalesce(p_data->>'loai_hinh', '') <> 'noi_bo' then nullif(p_data->>'don_vi_nhan', '')
          else null
        end
      else don_vi_nhan
    end,
    dia_chi_don_vi = case
      when p_data ? 'loai_hinh' then
        case
          when coalesce(p_data->>'loai_hinh', '') <> 'noi_bo' then nullif(p_data->>'dia_chi_don_vi', '')
          else null
        end
      else dia_chi_don_vi
    end,
    nguoi_lien_he = case
      when p_data ? 'loai_hinh' then
        case
          when coalesce(p_data->>'loai_hinh', '') <> 'noi_bo' then nullif(p_data->>'nguoi_lien_he', '')
          else null
        end
      else nguoi_lien_he
    end,
    so_dien_thoai = case
      when p_data ? 'loai_hinh' then
        case
          when coalesce(p_data->>'loai_hinh', '') <> 'noi_bo' then nullif(p_data->>'so_dien_thoai', '')
          else null
        end
      else so_dien_thoai
    end,
    ngay_du_kien_tra = case
      when p_data ? 'loai_hinh' then
        case
          when coalesce(p_data->>'loai_hinh', '') <> 'noi_bo'
            and coalesce(p_data->>'ngay_du_kien_tra', '') <> ''
            then (p_data->>'ngay_du_kien_tra')::date
          else null
        end
      else ngay_du_kien_tra
    end,
    updated_by = coalesce(nullif(p_data->>'updated_by', '')::int, v_user_id),
    updated_at = now()
  where id = p_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.transfer_request_update(integer, jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_request_update(integer, jsonb) FROM PUBLIC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. usage_session_start  (declarative SET search_path + FOR UPDATE)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.usage_session_start(
  p_thiet_bi_id bigint,
  p_nguoi_su_dung_id bigint DEFAULT NULL::bigint,
  p_tinh_trang_thiet_bi text DEFAULT NULL::text,
  p_ghi_chu text DEFAULT NULL::text,
  p_don_vi bigint DEFAULT NULL::bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
-- FIX: replaced body-level set_config with declarative search_path (defense-in-depth)
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

  if p_thiet_bi_id is null then
    raise exception 'Equipment ID is required' using errcode = '22023';
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

  -- FIX: FOR UPDATE serializes concurrent session-start calls for the same equipment,
  -- preventing the TOCTOU race where two concurrent transactions both see no active
  -- session and both proceed to INSERT.
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
    ghi_chu,
    trang_thai,
    created_at,
    updated_at
  )
  values (
    p_thiet_bi_id,
    v_target_user,
    timezone('utc', now()),
    p_tinh_trang_thiet_bi,
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

GRANT EXECUTE ON FUNCTION public.usage_session_start(bigint, bigint, text, text, bigint) TO authenticated;

COMMIT;
