-- Enrich repair_request_list to embed equipment details for UI rendering
-- Returns setof jsonb: row data + thiet_bi object

create or replace function public.repair_request_list(
  p_q text default null,
  p_status text default null,
  p_page int default 1,
  p_page_size int default 100
)
returns setof jsonb
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
  v_don_vi := nullif(v_claims->>'don_vi','')::bigint;
  v_offset := greatest((coalesce(p_page,1)-1) * coalesce(p_page_size,100), 0);

  if v_role is distinct from 'global' then
    return query
    select to_jsonb(r.*) || jsonb_build_object(
             'thiet_bi', jsonb_build_object(
               'ten_thiet_bi', tb.ten_thiet_bi,
               'ma_thiet_bi', tb.ma_thiet_bi,
               'model', tb.model,
               'serial', tb.serial,
               'khoa_phong_quan_ly', tb.khoa_phong_quan_ly
             )
           )
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
    select to_jsonb(r.*) || jsonb_build_object(
             'thiet_bi', jsonb_build_object(
               'ten_thiet_bi', tb.ten_thiet_bi,
               'ma_thiet_bi', tb.ma_thiet_bi,
               'model', tb.model,
               'serial', tb.serial,
               'khoa_phong_quan_ly', tb.khoa_phong_quan_ly
             )
           )
    from yeu_cau_sua_chua r
    join thiet_bi tb on tb.id = r.thiet_bi_id
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

grant execute on function public.repair_request_list(text, text, int, int) to authenticated;
