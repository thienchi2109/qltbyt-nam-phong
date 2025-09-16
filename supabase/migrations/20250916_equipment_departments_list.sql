-- Returns distinct, trimmed department names from equipment, scoped by tenant for non-global users
create or replace function public.equipment_departments_list()
returns setof text
language plpgsql
security definer
as $$
declare
  v_claims jsonb;
  v_role text;
  v_don_vi text;
begin
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role := coalesce(nullif(v_claims->>'app_role',''), nullif(v_claims->>'role',''));
  v_don_vi := nullif(v_claims->>'don_vi','');

  if v_role is distinct from 'global' then
    return query
    select distinct trim(both from tb.khoa_phong_quan_ly)
    from thiet_bi tb
    where (v_don_vi is null or tb.don_vi = v_don_vi)
      and tb.khoa_phong_quan_ly is not null
      and length(trim(tb.khoa_phong_quan_ly)) > 0
    order by 1;
  else
    return query
    select distinct trim(both from tb.khoa_phong_quan_ly)
    from thiet_bi tb
    where tb.khoa_phong_quan_ly is not null
      and length(trim(tb.khoa_phong_quan_ly)) > 0
    order by 1;
  end if;
end; $$;

grant execute on function public.equipment_departments_list() to authenticated;