-- Maintenance tasks listing with embedded equipment JSON to simplify client mapping
create or replace function public.maintenance_tasks_list_with_equipment(
  p_ke_hoach_id bigint default null,
  p_thiet_bi_id bigint default null,
  p_loai_cong_viec text default null,
  p_don_vi_thuc_hien text default null
)
returns setof jsonb
language sql
security definer
as $$
  select to_jsonb(t)
         || jsonb_build_object('thiet_bi', to_jsonb(tb))
  from cong_viec_bao_tri t
  left join thiet_bi tb on tb.id = t.thiet_bi_id
  where (p_ke_hoach_id is null or t.ke_hoach_id = p_ke_hoach_id)
    and (p_thiet_bi_id is null or t.thiet_bi_id = p_thiet_bi_id)
    and (p_loai_cong_viec is null or t.loai_cong_viec = p_loai_cong_viec)
    and (p_don_vi_thuc_hien is null or t.don_vi_thuc_hien = p_don_vi_thuc_hien)
  order by t.created_at desc;
$$;

grant execute on function public.maintenance_tasks_list_with_equipment(bigint, bigint, text, text) to authenticated;