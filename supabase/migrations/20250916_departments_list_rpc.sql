-- Departments list RPC to support UI suggestions without table access
-- Returns distinct khoa_phong_quan_ly values, optionally filtered by tenant if needed later.
create or replace function public.departments_list()
returns table(name text)
language sql
security definer
as $$
  select distinct coalesce(khoa_phong_quan_ly, '') as name
  from thiet_bi
  where coalesce(khoa_phong_quan_ly, '') <> ''
  order by 1;
$$;

grant execute on function public.departments_list() to authenticated;
