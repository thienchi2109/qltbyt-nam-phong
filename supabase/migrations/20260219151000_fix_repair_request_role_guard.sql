-- Migration: Fix repair_request_create security — role guard + REVOKE
-- Date: 2026-02-19
--
-- Fix 1: Add role validation after JWT claim extraction.
--         Without this, a null role causes v_is_global = false and v_don_vi = NULL,
--         which short-circuits the tenant isolation check (v_don_vi IS NOT NULL is false),
--         allowing any request against any equipment regardless of tenant.
--
-- Fix 2: REVOKE EXECUTE from PUBLIC so that anon callers cannot invoke
--         this SECURITY DEFINER function through PostgREST.

BEGIN;

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

  -- FIX 1: role guard — without this, null role + null don_vi bypasses tenant isolation
  if v_role is null or v_role = '' then
    raise exception 'Missing role claim in JWT' using errcode = '42501';
  end if;

  -- FIX 1b: non-global users MUST have a don_vi claim, otherwise
  -- the v_don_vi IS NOT NULL condition below silently skips tenant enforcement
  if not v_is_global and v_don_vi is null then
    raise exception 'Missing don_vi claim for non-global role %', v_role using errcode = '42501';
  end if;

  select id, don_vi, tinh_trang_hien_tai
  into v_tb
  from public.thiet_bi
  where id = p_thiet_bi_id
    and is_deleted = false;

  if not found then
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
-- FIX 2: REVOKE from PUBLIC — prevents anon callers via PostgREST
REVOKE EXECUTE ON FUNCTION public.repair_request_create(integer, text, text, date, text, text, text) FROM PUBLIC;

COMMIT;
