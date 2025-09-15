-- Repairs hardening: atomic equipment status + history updates with tenant checks
-- Safe to re-run due to CREATE OR REPLACE

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

  update thiet_bi set tinh_trang_hien_tai = 'Chờ sửa chữa'
  where id = p_thiet_bi_id and coalesce(tinh_trang_hien_tai, '') <> 'Chờ sửa chữa';

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

  update thiet_bi set tinh_trang_hien_tai = 'Chờ sửa chữa' where id = v_req.thiet_bi_id and coalesce(tinh_trang_hien_tai,'') <> 'Chờ sửa chữa';

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

  if v_status = 'Hoàn thành' then
    update thiet_bi set tinh_trang_hien_tai = 'Hoạt động' where id = v_req.thiet_bi_id;
  end if;

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

  insert into lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet)
  values (
    v_req.thiet_bi_id, 'Sửa chữa', 'Xóa yêu cầu sửa chữa', jsonb_build_object('yeu_cau_id', p_id)
  );
end; $$;

grant execute on function public.repair_request_create(int, text, text, date, text, text, text) to authenticated;
grant execute on function public.repair_request_update(int, text, text, date, text, text) to authenticated;
grant execute on function public.repair_request_approve(int, text, text, text) to authenticated;
grant execute on function public.repair_request_complete(int, text, text) to authenticated;
grant execute on function public.repair_request_delete(int) to authenticated;
