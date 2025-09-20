-- Transfers RPCs: create/update + list with relations + history/overdue helpers
-- Idempotent via CREATE OR REPLACE

-- Ensure previous signature is dropped when changing return type
drop function if exists public.transfer_request_list(text, text, int, int);

-- List transfer requests with embedded relations (equipment, requester, approver)
create or replace function public.transfer_request_list(
  p_q text default null,
  p_status text default null,
  p_page int default 1,
  p_page_size int default 100
) returns setof jsonb
language plpgsql
security definer
as $$
declare
  v_claims jsonb;
  v_role text;
  v_don_vi bigint;
  v_offset int;
begin
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role := coalesce(nullif(v_claims->>'app_role',''), nullif(v_claims->>'role',''));
  -- Cast don_vi claim to BIGINT to match thiet_bi.don_vi column type
  v_don_vi := nullif(v_claims->>'don_vi','')::bigint;
  v_offset := greatest((coalesce(p_page,1)-1) * coalesce(p_page_size,100), 0);

  if v_role is distinct from 'global' then
    return query
    select to_jsonb(t) 
           || jsonb_build_object('thiet_bi', to_jsonb(tb))
           || jsonb_build_object('nguoi_yeu_cau', to_jsonb(nyq))
           || jsonb_build_object('nguoi_duyet', to_jsonb(nd))
    from yeu_cau_luan_chuyen t
    join thiet_bi tb on tb.id = t.thiet_bi_id
    left join nhan_vien nyq on nyq.id = t.nguoi_yeu_cau_id
    left join nhan_vien nd on nd.id = t.nguoi_duyet_id
    where (v_don_vi is null or tb.don_vi = v_don_vi)
      and (p_status is null or t.trang_thai = p_status)
      and (p_q is null or (
        t.ly_do_luan_chuyen ilike '%'||p_q||'%'
      ))
    order by t.created_at desc
    offset v_offset limit coalesce(p_page_size,100);
  else
    return query
    select to_jsonb(t) 
           || jsonb_build_object('thiet_bi', to_jsonb(tb))
           || jsonb_build_object('nguoi_yeu_cau', to_jsonb(nyq))
           || jsonb_build_object('nguoi_duyet', to_jsonb(nd))
    from yeu_cau_luan_chuyen t
    left join thiet_bi tb on tb.id = t.thiet_bi_id
    left join nhan_vien nyq on nyq.id = t.nguoi_yeu_cau_id
    left join nhan_vien nd on nd.id = t.nguoi_duyet_id
    where (p_status is null or t.trang_thai = p_status)
      and (p_q is null or (
        t.ly_do_luan_chuyen ilike '%'||p_q||'%'
      ))
    order by t.created_at desc
    offset v_offset limit coalesce(p_page_size,100);
  end if;
end; $$;

grant execute on function public.transfer_request_list(text, text, int, int) to authenticated;

-- Create transfer request with tenant checks via equipment.don_vi
create or replace function public.transfer_request_create(
  p_data jsonb
) returns int
language plpgsql
security definer
as $$
declare
  v_id int;
  v_claims jsonb; v_role text; v_don_vi text; v_tb_don_vi text; v_user_id int;
  v_tb record;
begin
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role := coalesce(nullif(v_claims->>'app_role',''), nullif(v_claims->>'role',''));
  v_don_vi := nullif(v_claims->>'don_vi','');
  v_user_id := nullif(v_claims->>'user_id','')::int;

  select id, don_vi, khoa_phong_quan_ly into v_tb from thiet_bi where id = (p_data->>'thiet_bi_id')::int;
  if not found then raise exception 'Thiết bị không tồn tại'; end if;
  v_tb_don_vi := v_tb.don_vi;
  if v_role is distinct from 'global' and v_don_vi is not null and v_tb_don_vi is distinct from v_don_vi then
    raise exception 'Không có quyền trên thiết bị thuộc đơn vị khác';
  end if;

  insert into yeu_cau_luan_chuyen(
    thiet_bi_id,
    loai_hinh,
    ly_do_luan_chuyen,
    -- internal
    khoa_phong_hien_tai,
    khoa_phong_nhan,
    -- external
    muc_dich,
    don_vi_nhan,
    dia_chi_don_vi,
    nguoi_lien_he,
    so_dien_thoai,
    ngay_du_kien_tra,
    -- meta
    nguoi_yeu_cau_id,
    trang_thai,
    created_by,
    updated_by
  ) values (
    (p_data->>'thiet_bi_id')::int,
    p_data->>'loai_hinh',
    nullif(p_data->>'ly_do_luan_chuyen',''),
    nullif(p_data->>'khoa_phong_hien_tai',''),
    nullif(p_data->>'khoa_phong_nhan',''),
    nullif(p_data->>'muc_dich',''),
    nullif(p_data->>'don_vi_nhan',''),
    nullif(p_data->>'dia_chi_don_vi',''),
    nullif(p_data->>'nguoi_lien_he',''),
    nullif(p_data->>'so_dien_thoai',''),
    (case when coalesce(p_data->>'ngay_du_kien_tra','') <> '' then (p_data->>'ngay_du_kien_tra')::date else null end),
    coalesce(nullif(p_data->>'nguoi_yeu_cau_id','')::int, v_user_id),
    'cho_duyet',
    coalesce(nullif(p_data->>'created_by','')::int, v_user_id),
    coalesce(nullif(p_data->>'updated_by','')::int, v_user_id)
  ) returning id into v_id;

  return v_id;
end; $$;

grant execute on function public.transfer_request_create(jsonb) to authenticated;

-- Update transfer request (only allowed in specific statuses)
create or replace function public.transfer_request_update(
  p_id int,
  p_data jsonb
) returns void
language plpgsql
security definer
as $$
declare
  v_req record; v_claims jsonb; v_role text; v_don_vi text; v_tb_don_vi text; v_user_id int;
begin
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role := coalesce(nullif(v_claims->>'app_role',''), nullif(v_claims->>'role',''));
  v_don_vi := nullif(v_claims->>'don_vi','');
  v_user_id := nullif(v_claims->>'user_id','')::int;

  select t.*, tb.don_vi as tb_don_vi into v_req
  from yeu_cau_luan_chuyen t
  join thiet_bi tb on tb.id = t.thiet_bi_id
  where t.id = p_id;
  if not found then raise exception 'Yêu cầu không tồn tại'; end if;
  v_tb_don_vi := v_req.tb_don_vi;
  if v_role is distinct from 'global' and v_don_vi is not null and v_tb_don_vi is distinct from v_don_vi then
    raise exception 'Không có quyền trên thiết bị thuộc đơn vị khác';
  end if;

  if v_req.trang_thai not in ('cho_duyet','da_duyet') then
    raise exception 'Chỉ có thể chỉnh sửa khi yêu cầu ở trạng thái Chờ duyệt hoặc Đã duyệt';
  end if;

  update yeu_cau_luan_chuyen set
    thiet_bi_id = coalesce(nullif(p_data->>'thiet_bi_id','')::int, thiet_bi_id),
    loai_hinh = coalesce(nullif(p_data->>'loai_hinh',''), loai_hinh),
    ly_do_luan_chuyen = coalesce(nullif(p_data->>'ly_do_luan_chuyen',''), ly_do_luan_chuyen),
    -- internal
    khoa_phong_hien_tai = case when coalesce(p_data->>'loai_hinh','') = 'noi_bo' then nullif(p_data->>'khoa_phong_hien_tai','') else null end,
    khoa_phong_nhan = case when coalesce(p_data->>'loai_hinh','') = 'noi_bo' then nullif(p_data->>'khoa_phong_nhan','') else null end,
    -- external
    muc_dich = case when coalesce(p_data->>'loai_hinh','') <> 'noi_bo' then nullif(p_data->>'muc_dich','') else null end,
    don_vi_nhan = case when coalesce(p_data->>'loai_hinh','') <> 'noi_bo' then nullif(p_data->>'don_vi_nhan','') else null end,
    dia_chi_don_vi = case when coalesce(p_data->>'loai_hinh','') <> 'noi_bo' then nullif(p_data->>'dia_chi_don_vi','') else null end,
    nguoi_lien_he = case when coalesce(p_data->>'loai_hinh','') <> 'noi_bo' then nullif(p_data->>'nguoi_lien_he','') else null end,
    so_dien_thoai = case when coalesce(p_data->>'loai_hinh','') <> 'noi_bo' then nullif(p_data->>'so_dien_thoai','') else null end,
    ngay_du_kien_tra = case when coalesce(p_data->>'loai_hinh','') <> 'noi_bo' and coalesce(p_data->>'ngay_du_kien_tra','') <> '' then (p_data->>'ngay_du_kien_tra')::date else null end,
    updated_by = coalesce(nullif(p_data->>'updated_by','')::int, v_user_id),
    updated_at = now()
  where id = p_id;
end; $$;

grant execute on function public.transfer_request_update(int, jsonb) to authenticated;

-- List transfer history with user details
create or replace function public.transfer_history_list(p_yeu_cau_id int)
returns setof jsonb
language plpgsql
security definer
as $$
begin
  -- If history table is absent in this environment, return empty set gracefully
  if to_regclass('public.lich_su_luan_chuyen') is null then
    return;
  end if;

  return query
  execute $q$
    select to_jsonb(h) || jsonb_build_object('nguoi_thuc_hien', to_jsonb(u))
    from public.lich_su_luan_chuyen h
    left join public.nhan_vien u on u.id = h.nguoi_thuc_hien_id
    where h.yeu_cau_id = $1
    order by h.thoi_gian desc
  $q$ using p_yeu_cau_id;
end;
$$;

grant execute on function public.transfer_history_list(int) to authenticated;

-- External transfers pending return (overdue/upcoming); embed equipment
create or replace function public.transfer_request_external_pending_returns()
returns setof jsonb
language sql
security definer
as $$
  select to_jsonb(t) || jsonb_build_object('thiet_bi', to_jsonb(tb))
  from yeu_cau_luan_chuyen t
  join thiet_bi tb on tb.id = t.thiet_bi_id
  where t.loai_hinh = 'ben_ngoai'
    and t.trang_thai in ('da_ban_giao','dang_luan_chuyen')
    and t.ngay_du_kien_tra is not null;
$$;

grant execute on function public.transfer_request_external_pending_returns() to authenticated;
