-- Migration: Fix transfer_request_update security guards
-- Date: 2026-02-20
-- Fixes:
--   1. v_user_id can silently become NULL when JWT claim is missing, setting updated_by=NULL
--   2. Non-global users with missing don_vi JWT claim bypass tenant isolation checks
--   3. Sending {"loai_hinh": ""} triggers CASE branches with empty string, wiping fields incorrectly

BEGIN;

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

  -- FIX 1: Guard missing role
  if v_role is null or v_role = '' then
    raise exception 'Missing role claim in JWT' using errcode = '42501';
  end if;

  -- FIX 2: Guard missing user_id — prevents NULL audit trail (updated_by=NULL defeats audit spoofing fix)
  if v_user_id is null then
    raise exception 'Missing user_id claim in JWT' using errcode = '42501';
  end if;

  -- FIX 3: Guard missing don_vi for non-global users — prevents tenant isolation bypass
  if not v_is_global and v_don_vi is null then
    raise exception 'Missing don_vi claim in JWT for non-global user' using errcode = '42501';
  end if;

  if v_role = 'regional_leader' then
    raise exception 'Regional leaders have read-only access to transfers' using errcode = '42501';
  end if;

  select t.*, tb.don_vi as tb_don_vi
  into v_req
  from public.yeu_cau_luan_chuyen t
  join public.thiet_bi tb on tb.id = t.thiet_bi_id
  where t.id = p_id
  for update of t;

  if not found then
    raise exception 'Yêu cầu không tồn tại';
  end if;

  v_tb_don_vi := v_req.tb_don_vi;

  if not v_is_global and v_tb_don_vi is distinct from v_don_vi then
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
      and tb.is_deleted = false
    for update;

    if not found then
      raise exception 'Thiết bị không tồn tại' using errcode = 'P0002';
    end if;

    if not v_is_global and v_target_tb.don_vi::text is distinct from v_don_vi then
      raise exception 'Không có quyền trên thiết bị thuộc đơn vị khác';
    end if;
  end if;

  -- FIX 4: loai_hinh="" now treated as "not supplied" — CASE branches only fire when loai_hinh
  -- is present AND non-empty, preventing empty string from wiping dependent field groups.
  update public.yeu_cau_luan_chuyen set
    thiet_bi_id = coalesce(v_new_thiet_bi_id, thiet_bi_id),
    loai_hinh = coalesce(nullif(p_data->>'loai_hinh', ''), loai_hinh),
    ly_do_luan_chuyen = coalesce(nullif(p_data->>'ly_do_luan_chuyen', ''), ly_do_luan_chuyen),
    khoa_phong_hien_tai = case
      when p_data ? 'loai_hinh' and nullif(p_data->>'loai_hinh', '') is not null then
        case
          when p_data->>'loai_hinh' = 'noi_bo' then nullif(p_data->>'khoa_phong_hien_tai', '')
          else null
        end
      else khoa_phong_hien_tai
    end,
    khoa_phong_nhan = case
      when p_data ? 'loai_hinh' and nullif(p_data->>'loai_hinh', '') is not null then
        case
          when p_data->>'loai_hinh' = 'noi_bo' then nullif(p_data->>'khoa_phong_nhan', '')
          else null
        end
      else khoa_phong_nhan
    end,
    muc_dich = case
      when p_data ? 'loai_hinh' and nullif(p_data->>'loai_hinh', '') is not null then
        case
          when p_data->>'loai_hinh' <> 'noi_bo' then nullif(p_data->>'muc_dich', '')
          else null
        end
      else muc_dich
    end,
    don_vi_nhan = case
      when p_data ? 'loai_hinh' and nullif(p_data->>'loai_hinh', '') is not null then
        case
          when p_data->>'loai_hinh' <> 'noi_bo' then nullif(p_data->>'don_vi_nhan', '')
          else null
        end
      else don_vi_nhan
    end,
    dia_chi_don_vi = case
      when p_data ? 'loai_hinh' and nullif(p_data->>'loai_hinh', '') is not null then
        case
          when p_data->>'loai_hinh' <> 'noi_bo' then nullif(p_data->>'dia_chi_don_vi', '')
          else null
        end
      else dia_chi_don_vi
    end,
    nguoi_lien_he = case
      when p_data ? 'loai_hinh' and nullif(p_data->>'loai_hinh', '') is not null then
        case
          when p_data->>'loai_hinh' <> 'noi_bo' then nullif(p_data->>'nguoi_lien_he', '')
          else null
        end
      else nguoi_lien_he
    end,
    so_dien_thoai = case
      when p_data ? 'loai_hinh' and nullif(p_data->>'loai_hinh', '') is not null then
        case
          when p_data->>'loai_hinh' <> 'noi_bo' then nullif(p_data->>'so_dien_thoai', '')
          else null
        end
      else so_dien_thoai
    end,
    ngay_du_kien_tra = case
      when p_data ? 'loai_hinh' and nullif(p_data->>'loai_hinh', '') is not null then
        case
          when p_data->>'loai_hinh' <> 'noi_bo'
            and coalesce(p_data->>'ngay_du_kien_tra', '') <> ''
            then (p_data->>'ngay_du_kien_tra')::date
          else null
        end
      else ngay_du_kien_tra
    end,
    updated_by = v_user_id,
    updated_at = now()
  where id = p_id;

  perform public.audit_log(
    'transfer_request_update',
    'transfer_request',
    p_id,
    v_req.ma_yeu_cau,
    p_data
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.transfer_request_update(integer, jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_request_update(integer, jsonb) FROM PUBLIC;

COMMIT;
