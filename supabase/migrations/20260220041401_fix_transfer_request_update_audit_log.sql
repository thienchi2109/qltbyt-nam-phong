-- Migration: Audit transfer_request_update mutations in unified audit_log
-- Date: 2026-02-20
-- Issue: transfer updates were not recorded in audit_log while creates were.

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
  where t.id = p_id
  for update of t;

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
      and tb.is_deleted = false
    for update;

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
    -- FIX: always use server-side v_user_id; client-supplied updated_by enabled audit spoofing
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
