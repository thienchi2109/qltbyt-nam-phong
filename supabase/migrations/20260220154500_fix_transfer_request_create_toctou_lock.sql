-- Migration: Fix TOCTOU race in transfer_request_create equipment guard
-- Date: 2026-02-20
-- Issue: equipment existence check read was not row-locked, allowing a concurrent
-- soft-delete between validation and insert.
-- Fix: lock the equipment row with FOR UPDATE during validation.

BEGIN;

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
    and is_deleted = false
  for update;

  if not found then
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
    v_user_id,
    'cho_duyet',
    v_user_id,
    v_user_id
  )
  returning id into v_id;

  perform public.audit_log(
    'transfer_request_create',
    'transfer_request',
    v_id,
    null,
    p_data - 'created_by' - 'updated_by' - 'nguoi_yeu_cau_id'
  );

  return v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.transfer_request_create(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_request_create(jsonb) FROM PUBLIC;

COMMIT;
