-- Repairs RPCs
create or replace function public.repair_request_list(p_q text default null, p_status text default null, p_page int default 1, p_page_size int default 100)
returns setof yeu_cau_sua_chua
language plpgsql
security definer
as $$
declare
  v_claims jsonb;
  v_role text;
  v_don_vi text;
  v_offset int;
begin
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role := coalesce(nullif(v_claims->>'app_role',''), nullif(v_claims->>'role',''));
  v_don_vi := nullif(v_claims->>'don_vi','');
  v_offset := greatest((coalesce(p_page,1)-1) * coalesce(p_page_size,100), 0);

  if v_role is distinct from 'global' then
    return query
    select r.*
    from yeu_cau_sua_chua r
    join thiet_bi tb on tb.id = r.thiet_bi_id
    where (v_don_vi is null or tb.don_vi = v_don_vi)
      and (p_status is null or r.trang_thai = p_status)
      and (p_q is null or (
        r.mo_ta_su_co ilike '%'||p_q||'%' or
        r.hang_muc_sua_chua ilike '%'||p_q||'%'
      ))
    order by r.ngay_yeu_cau desc
    offset v_offset limit coalesce(p_page_size,100);
  else
    return query
    select r.*
    from yeu_cau_sua_chua r
    where (p_status is null or r.trang_thai = p_status)
      and (p_q is null or (
        r.mo_ta_su_co ilike '%'||p_q||'%' or
        r.hang_muc_sua_chua ilike '%'||p_q||'%'
      ))
    order by r.ngay_yeu_cau desc
    offset v_offset limit coalesce(p_page_size,100);
  end if;
end;
$$;

create or replace function public.repair_request_get(p_id int)
returns jsonb
language sql
security definer
as $$
  select to_jsonb(r.*) from yeu_cau_sua_chua r where r.id = p_id;
$$;

create or replace function public.repair_request_create(
  p_thiet_bi_id int,
  p_mo_ta_su_co text,
  p_hang_muc_sua_chua text,
  p_ngay_mong_muon_hoan_thanh date,
  p_nguoi_yeu_cau text,
  p_don_vi_thuc_hien text,
  p_ten_don_vi_thue text
) returns int
language plpgsql
security definer
as $$
declare 
  v_id int; 
  v_claims jsonb;
  v_role text;
  v_don_vi text;
  v_tb record;
begin
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role := coalesce(nullif(v_claims->>'app_role',''), nullif(v_claims->>'role',''));
  v_don_vi := nullif(v_claims->>'don_vi','');

  select id, don_vi, tinh_trang_hien_tai into v_tb from thiet_bi where id = p_thiet_bi_id;
  if not found then
    raise exception 'Thiết bị không tồn tại';
  end if;
  if v_role is distinct from 'global' and v_don_vi is not null and v_tb.don_vi is distinct from v_don_vi then
    raise exception 'Không có quyền trên thiết bị thuộc đơn vị khác';
  end if;

  insert into yeu_cau_sua_chua(thiet_bi_id, mo_ta_su_co, hang_muc_sua_chua, ngay_mong_muon_hoan_thanh, nguoi_yeu_cau, trang_thai, don_vi_thuc_hien, ten_don_vi_thue)
  values (p_thiet_bi_id, p_mo_ta_su_co, p_hang_muc_sua_chua, p_ngay_mong_muon_hoan_thanh, p_nguoi_yeu_cau, 'Chờ xử lý', p_don_vi_thuc_hien, p_ten_don_vi_thue)
  returning id into v_id;

  -- Cập nhật trạng thái thiết bị sang "Chờ sửa chữa" nếu khác
  update thiet_bi set tinh_trang_hien_tai = 'Chờ sửa chữa'
  where id = p_thiet_bi_id and coalesce(tinh_trang_hien_tai, '') <> 'Chờ sửa chữa';

  -- Ghi lịch sử thiết bị
  insert into lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet, yeu_cau_id)
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

  return v_id;
end; $$;

create or replace function public.repair_request_update(
  p_id int,
  p_mo_ta_su_co text,
  p_hang_muc_sua_chua text,
  p_ngay_mong_muon_hoan_thanh date,
  p_don_vi_thuc_hien text,
  p_ten_don_vi_thue text
) returns void
language plpgsql
security definer
as $$
declare
  v_claims jsonb; v_role text; v_don_vi text; v_req yeu_cau_sua_chua; v_tb_don_vi text;
begin
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role := coalesce(nullif(v_claims->>'app_role',''), nullif(v_claims->>'role',''));
  v_don_vi := nullif(v_claims->>'don_vi','');

  select * into v_req from yeu_cau_sua_chua where id = p_id;
  if not found then raise exception 'Yêu cầu không tồn tại'; end if;
  select don_vi into v_tb_don_vi from thiet_bi where id = v_req.thiet_bi_id;
  if v_role is distinct from 'global' and v_don_vi is not null and v_tb_don_vi is distinct from v_don_vi then
    raise exception 'Không có quyền trên thiết bị thuộc đơn vị khác';
  end if;

  update yeu_cau_sua_chua
  set mo_ta_su_co = p_mo_ta_su_co,
      hang_muc_sua_chua = p_hang_muc_sua_chua,
      ngay_mong_muon_hoan_thanh = p_ngay_mong_muon_hoan_thanh,
      don_vi_thuc_hien = p_don_vi_thuc_hien,
      ten_don_vi_thue = p_ten_don_vi_thue
  where id = p_id;

  -- Ghi lịch sử chỉnh sửa nội dung yêu cầu
  insert into lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet, yeu_cau_id)
  values (
    v_req.thiet_bi_id,
    'Sửa chữa',
    'Cập nhật nội dung yêu cầu sửa chữa',
    jsonb_build_object(
      'mo_ta_su_co', p_mo_ta_su_co,
      'hang_muc', p_hang_muc_sua_chua,
      'ngay_mong_muon_hoan_thanh', p_ngay_mong_muon_hoan_thanh,
      'don_vi_thuc_hien', p_don_vi_thuc_hien,
      'ten_don_vi_thue', p_ten_don_vi_thue
    ),
    p_id
  );
end; $$;

create or replace function public.repair_request_approve(
  p_id int,
  p_nguoi_duyet text,
  p_don_vi_thuc_hien text,
  p_ten_don_vi_thue text
) returns void
language plpgsql
security definer
as $$
declare v_req yeu_cau_sua_chua; v_claims jsonb; v_role text; v_don_vi text; v_tb record;
begin
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role := coalesce(nullif(v_claims->>'app_role',''), nullif(v_claims->>'role',''));
  v_don_vi := nullif(v_claims->>'don_vi','');

  select * into v_req from yeu_cau_sua_chua where id = p_id;
  if not found then raise exception 'Yêu cầu không tồn tại'; end if;
  select id, don_vi into v_tb from thiet_bi where id = v_req.thiet_bi_id;
  if v_role is distinct from 'global' and v_don_vi is not null and v_tb.don_vi is distinct from v_don_vi then
    raise exception 'Không có quyền trên thiết bị thuộc đơn vị khác';
  end if;

  update yeu_cau_sua_chua
  set trang_thai = 'Đã duyệt',
      ngay_duyet = now(),
      nguoi_duyet = p_nguoi_duyet,
      don_vi_thuc_hien = p_don_vi_thuc_hien,
      ten_don_vi_thue = case when p_don_vi_thuc_hien = 'thue_ngoai' then p_ten_don_vi_thue else null end
  where id = p_id;

  -- Đảm bảo trạng thái thiết bị đang ở "Chờ sửa chữa"
  update thiet_bi set tinh_trang_hien_tai = 'Chờ sửa chữa' where id = v_req.thiet_bi_id and coalesce(tinh_trang_hien_tai,'') <> 'Chờ sửa chữa';

  -- Ghi lịch sử duyệt yêu cầu
  insert into lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet, yeu_cau_id)
  values (
    v_req.thiet_bi_id,
    'Sửa chữa',
    'Duyệt yêu cầu sửa chữa',
    jsonb_build_object('nguoi_duyet', p_nguoi_duyet, 'don_vi_thuc_hien', p_don_vi_thuc_hien, 'ten_don_vi_thue', p_ten_don_vi_thue),
    p_id
  );
end; $$;

create or replace function public.repair_request_complete(
  p_id int,
  p_completion text,
  p_reason text
) returns void
language plpgsql
security definer
as $$
declare 
  v_req yeu_cau_sua_chua; 
  v_status text; 
  v_claims jsonb; v_role text; v_don_vi text; v_tb record;
begin
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role := coalesce(nullif(v_claims->>'app_role',''), nullif(v_claims->>'role',''));
  v_don_vi := nullif(v_claims->>'don_vi','');

  select * into v_req from yeu_cau_sua_chua where id = p_id;
  if not found then raise exception 'Yêu cầu không tồn tại'; end if;
  select id, don_vi into v_tb from thiet_bi where id = v_req.thiet_bi_id;
  if v_role is distinct from 'global' and v_don_vi is not null and v_tb.don_vi is distinct from v_don_vi then
    raise exception 'Không có quyền trên thiết bị thuộc đơn vị khác';
  end if;

  if p_completion is not null then
    v_status := 'Hoàn thành';
  else
    v_status := 'Không HT';
  end if;

  update yeu_cau_sua_chua
  set trang_thai = v_status,
      ngay_hoan_thanh = now(),
      ket_qua_sua_chua = case when v_status = 'Hoàn thành' then p_completion else null end,
      ly_do_khong_hoan_thanh = case when v_status <> 'Hoàn thành' then p_reason else null end
  where id = p_id;

  -- Cập nhật trạng thái thiết bị theo kết quả
  if v_status = 'Hoàn thành' then
    update thiet_bi set tinh_trang_hien_tai = 'Hoạt động' where id = v_req.thiet_bi_id;
  else
    -- Không hoàn thành: giữ nguyên trạng thái hiện tại (thường vẫn là Chờ sửa chữa)
    null;
  end if;

  -- Ghi lịch sử thiết bị
  insert into lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet, yeu_cau_id)
  values (
    v_req.thiet_bi_id, 
    'Sửa chữa', 
    'Yêu cầu sửa chữa cập nhật trạng thái', 
    jsonb_build_object('ket_qua', coalesce(p_completion,p_reason), 'trang_thai', v_status), 
    p_id
  );
end; $$;

create or replace function public.repair_request_delete(p_id int)
returns void
language plpgsql
security definer
as $$
declare v_req yeu_cau_sua_chua; v_claims jsonb; v_role text; v_don_vi text; v_tb_don_vi text;
begin
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role := coalesce(nullif(v_claims->>'app_role',''), nullif(v_claims->>'role',''));
  v_don_vi := nullif(v_claims->>'don_vi','');

  select * into v_req from yeu_cau_sua_chua where id = p_id;
  if not found then return; end if;
  select don_vi into v_tb_don_vi from thiet_bi where id = v_req.thiet_bi_id;
  if v_role is distinct from 'global' and v_don_vi is not null and v_tb_don_vi is distinct from v_don_vi then
    raise exception 'Không có quyền trên thiết bị thuộc đơn vị khác';
  end if;

  delete from yeu_cau_sua_chua where id = p_id;

  -- Ghi lịch sử xóa yêu cầu (không đổi trạng thái thiết bị)
  insert into lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet)
  values (
    v_req.thiet_bi_id, 'Sửa chữa', 'Xóa yêu cầu sửa chữa', jsonb_build_object('yeu_cau_id', p_id)
  );
end; $$;

-- Transfers RPCs
create or replace function public.transfer_request_list(p_q text default null, p_status text default null, p_page int default 1, p_page_size int default 100)
returns setof yeu_cau_luan_chuyen
language sql
security definer
as $$
  select * from yeu_cau_luan_chuyen
  where (p_status is null or trang_thai = p_status)
    and (p_q is null or (ly_do ilike '%'||p_q||'%' or ghi_chu ilike '%'||p_q||'%'))
  order by created_at desc
  offset greatest((coalesce(p_page,1)-1) * coalesce(p_page_size,100),0) limit coalesce(p_page_size,100);
$$;

create or replace function public.transfer_request_update_status(
  p_id int,
  p_status text,
  p_payload jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
as $$
begin
  update yeu_cau_luan_chuyen
  set trang_thai = p_status,
      updated_at = now()
  where id = p_id;

  if p_status = 'da_duyet' then
    update yeu_cau_luan_chuyen set nguoi_duyet_id = (p_payload->>'nguoi_duyet_id')::int, ngay_duyet = now() where id = p_id;
  elsif p_status = 'hoan_thanh' then
    update yeu_cau_luan_chuyen set ngay_hoan_thanh = now() where id = p_id;
  end if;
end; $$;

create or replace function public.transfer_request_delete(p_id int)
returns void
language sql
security definer
as $$
  delete from yeu_cau_luan_chuyen where id = p_id;
$$;

-- Maintenance RPCs (aligned to current schema)
create or replace function public.maintenance_tasks_list(
  p_ke_hoach_id bigint default null,
  p_thiet_bi_id bigint default null,
  p_loai_cong_viec text default null,
  p_don_vi_thuc_hien text default null
)
returns setof cong_viec_bao_tri
language sql
security definer
as $$
  select * from cong_viec_bao_tri
  where (p_ke_hoach_id is null or ke_hoach_id = p_ke_hoach_id)
    and (p_thiet_bi_id is null or thiet_bi_id = p_thiet_bi_id)
    and (p_loai_cong_viec is null or loai_cong_viec = p_loai_cong_viec)
    and (p_don_vi_thuc_hien is null or don_vi_thuc_hien = p_don_vi_thuc_hien)
  order by created_at desc;
$$;

create or replace function public.maintenance_tasks_bulk_insert(p_tasks jsonb)
returns void
language sql
security definer
as $$
  insert into cong_viec_bao_tri (
    ke_hoach_id,
    thiet_bi_id,
    loai_cong_viec,
    diem_hieu_chuan,
    don_vi_thuc_hien,
    thang_1, thang_2, thang_3, thang_4, thang_5, thang_6, thang_7, thang_8, thang_9, thang_10, thang_11, thang_12,
    ghi_chu
  )
  select 
    (t->>'ke_hoach_id')::bigint,
    nullif(t->>'thiet_bi_id','')::bigint,
    t->>'loai_cong_viec',
    t->>'diem_hieu_chuan',
    t->>'don_vi_thuc_hien',
    coalesce((t->>'thang_1')::boolean, false),
    coalesce((t->>'thang_2')::boolean, false),
    coalesce((t->>'thang_3')::boolean, false),
    coalesce((t->>'thang_4')::boolean, false),
    coalesce((t->>'thang_5')::boolean, false),
    coalesce((t->>'thang_6')::boolean, false),
    coalesce((t->>'thang_7')::boolean, false),
    coalesce((t->>'thang_8')::boolean, false),
    coalesce((t->>'thang_9')::boolean, false),
    coalesce((t->>'thang_10')::boolean, false),
    coalesce((t->>'thang_11')::boolean, false),
    coalesce((t->>'thang_12')::boolean, false),
    t->>'ghi_chu'
  from jsonb_array_elements(p_tasks) as t;
$$;

create or replace function public.maintenance_task_update(p_id bigint, p_task jsonb)
returns void
language sql
security definer
as $$
  update cong_viec_bao_tri
  set 
      ke_hoach_id = coalesce(nullif(p_task->>'ke_hoach_id','')::bigint, ke_hoach_id),
      thiet_bi_id = coalesce(nullif(p_task->>'thiet_bi_id','')::bigint, thiet_bi_id),
      loai_cong_viec = coalesce(p_task->>'loai_cong_viec', loai_cong_viec),
      diem_hieu_chuan = coalesce(p_task->>'diem_hieu_chuan', diem_hieu_chuan),
      don_vi_thuc_hien = coalesce(p_task->>'don_vi_thuc_hien', don_vi_thuc_hien),
      thang_1 = coalesce((p_task->>'thang_1')::boolean, thang_1),
      thang_2 = coalesce((p_task->>'thang_2')::boolean, thang_2),
      thang_3 = coalesce((p_task->>'thang_3')::boolean, thang_3),
      thang_4 = coalesce((p_task->>'thang_4')::boolean, thang_4),
      thang_5 = coalesce((p_task->>'thang_5')::boolean, thang_5),
      thang_6 = coalesce((p_task->>'thang_6')::boolean, thang_6),
      thang_7 = coalesce((p_task->>'thang_7')::boolean, thang_7),
      thang_8 = coalesce((p_task->>'thang_8')::boolean, thang_8),
      thang_9 = coalesce((p_task->>'thang_9')::boolean, thang_9),
      thang_10 = coalesce((p_task->>'thang_10')::boolean, thang_10),
      thang_11 = coalesce((p_task->>'thang_11')::boolean, thang_11),
      thang_12 = coalesce((p_task->>'thang_12')::boolean, thang_12),
      thang_1_hoan_thanh = coalesce((p_task->>'thang_1_hoan_thanh')::boolean, thang_1_hoan_thanh),
      thang_2_hoan_thanh = coalesce((p_task->>'thang_2_hoan_thanh')::boolean, thang_2_hoan_thanh),
      thang_3_hoan_thanh = coalesce((p_task->>'thang_3_hoan_thanh')::boolean, thang_3_hoan_thanh),
      thang_4_hoan_thanh = coalesce((p_task->>'thang_4_hoan_thanh')::boolean, thang_4_hoan_thanh),
      thang_5_hoan_thanh = coalesce((p_task->>'thang_5_hoan_thanh')::boolean, thang_5_hoan_thanh),
      thang_6_hoan_thanh = coalesce((p_task->>'thang_6_hoan_thanh')::boolean, thang_6_hoan_thanh),
      thang_7_hoan_thanh = coalesce((p_task->>'thang_7_hoan_thanh')::boolean, thang_7_hoan_thanh),
      thang_8_hoan_thanh = coalesce((p_task->>'thang_8_hoan_thanh')::boolean, thang_8_hoan_thanh),
      thang_9_hoan_thanh = coalesce((p_task->>'thang_9_hoan_thanh')::boolean, thang_9_hoan_thanh),
      thang_10_hoan_thanh = coalesce((p_task->>'thang_10_hoan_thanh')::boolean, thang_10_hoan_thanh),
      thang_11_hoan_thanh = coalesce((p_task->>'thang_11_hoan_thanh')::boolean, thang_11_hoan_thanh),
      thang_12_hoan_thanh = coalesce((p_task->>'thang_12_hoan_thanh')::boolean, thang_12_hoan_thanh),
      ngay_hoan_thanh_1 = coalesce((p_task->>'ngay_hoan_thanh_1')::timestamptz, ngay_hoan_thanh_1),
      ngay_hoan_thanh_2 = coalesce((p_task->>'ngay_hoan_thanh_2')::timestamptz, ngay_hoan_thanh_2),
      ngay_hoan_thanh_3 = coalesce((p_task->>'ngay_hoan_thanh_3')::timestamptz, ngay_hoan_thanh_3),
      ngay_hoan_thanh_4 = coalesce((p_task->>'ngay_hoan_thanh_4')::timestamptz, ngay_hoan_thanh_4),
      ngay_hoan_thanh_5 = coalesce((p_task->>'ngay_hoan_thanh_5')::timestamptz, ngay_hoan_thanh_5),
      ngay_hoan_thanh_6 = coalesce((p_task->>'ngay_hoan_thanh_6')::timestamptz, ngay_hoan_thanh_6),
      ngay_hoan_thanh_7 = coalesce((p_task->>'ngay_hoan_thanh_7')::timestamptz, ngay_hoan_thanh_7),
      ngay_hoan_thanh_8 = coalesce((p_task->>'ngay_hoan_thanh_8')::timestamptz, ngay_hoan_thanh_8),
      ngay_hoan_thanh_9 = coalesce((p_task->>'ngay_hoan_thanh_9')::timestamptz, ngay_hoan_thanh_9),
      ngay_hoan_thanh_10 = coalesce((p_task->>'ngay_hoan_thanh_10')::timestamptz, ngay_hoan_thanh_10),
      ngay_hoan_thanh_11 = coalesce((p_task->>'ngay_hoan_thanh_11')::timestamptz, ngay_hoan_thanh_11),
      ngay_hoan_thanh_12 = coalesce((p_task->>'ngay_hoan_thanh_12')::timestamptz, ngay_hoan_thanh_12),
      ghi_chu = coalesce(p_task->>'ghi_chu', ghi_chu)
  where id = p_id;
$$;

create or replace function public.maintenance_tasks_delete(p_ids bigint[])
returns void
language sql
security definer
as $$
  delete from cong_viec_bao_tri where id = any(p_ids);
$$;

grant execute on function public.repair_request_list(text, text, int, int) to authenticated;
grant execute on function public.repair_request_get(int) to authenticated;
grant execute on function public.repair_request_create(int, text, text, date, text, text, text) to authenticated;
grant execute on function public.repair_request_update(int, text, text, date, text, text) to authenticated;
grant execute on function public.repair_request_approve(int, text, text, text) to authenticated;
grant execute on function public.repair_request_complete(int, text, text) to authenticated;
grant execute on function public.repair_request_delete(int) to authenticated;

grant execute on function public.transfer_request_list(text, text, int, int) to authenticated;
grant execute on function public.transfer_request_update_status(int, text, jsonb) to authenticated;
grant execute on function public.transfer_request_delete(int) to authenticated;

grant execute on function public.maintenance_tasks_list(bigint, bigint, text, text) to authenticated;
grant execute on function public.maintenance_tasks_bulk_insert(jsonb) to authenticated;
grant execute on function public.maintenance_task_update(bigint, jsonb) to authenticated;
grant execute on function public.maintenance_tasks_delete(bigint[]) to authenticated;
