-- Equipment attachments and history RPCs to eliminate direct table access from frontend

-- List attachments for equipment
create or replace function public.equipment_attachments_list(p_thiet_bi_id int)
returns setof file_dinh_kem
language sql
security definer
as $$
  select *
  from file_dinh_kem
  where thiet_bi_id = p_thiet_bi_id
  order by ngay_tai_len desc nulls last;
$$;

grant execute on function public.equipment_attachments_list(int) to authenticated;

-- Create attachment for equipment; returns id as text for flexibility (uuid/int)
create or replace function public.equipment_attachment_create(
  p_thiet_bi_id int,
  p_ten_file text,
  p_duong_dan text
) returns text
language sql
security definer
as $$
  insert into file_dinh_kem(thiet_bi_id, ten_file, duong_dan_luu_tru)
  values (p_thiet_bi_id, p_ten_file, p_duong_dan)
  returning id::text;
$$;

grant execute on function public.equipment_attachment_create(int, text, text) to authenticated;

-- Delete attachment by id (id may be uuid or int)
create or replace function public.equipment_attachment_delete(p_id text)
returns void
language sql
security definer
as $$
  delete from file_dinh_kem where id::text = p_id;
$$;

grant execute on function public.equipment_attachment_delete(text) to authenticated;

-- List equipment history rows by equipment id
create or replace function public.equipment_history_list(p_thiet_bi_id int)
returns setof lich_su_thiet_bi
language sql
security definer
as $$
  select *
  from lich_su_thiet_bi
  where thiet_bi_id = p_thiet_bi_id
  order by ngay_thuc_hien desc nulls last;
$$;

grant execute on function public.equipment_history_list(int) to authenticated;