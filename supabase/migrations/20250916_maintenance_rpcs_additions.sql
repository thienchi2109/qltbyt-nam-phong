-- Maintenance RPCs for plans and task operations to replace direct table access

-- List plans (optionally filter by search). Tenant scoping omitted as plans table stores loai_cong_viec/khoa_phong; enforcement remains via UI and task-level constraints.
create or replace function public.maintenance_plan_list(p_q text default null)
returns setof ke_hoach_bao_tri
language sql
security definer
as $$
  select *
  from ke_hoach_bao_tri
  where (
    p_q is null or p_q = ''
    or ten_ke_hoach ilike '%'||p_q||'%'
    or coalesce(khoa_phong,'') ilike '%'||p_q||'%'
    or coalesce(nguoi_lap_ke_hoach,'') ilike '%'||p_q||'%'
  )
  order by nam desc, created_at desc;
$$;

grant execute on function public.maintenance_plan_list(text) to authenticated;

-- Create plan
create or replace function public.maintenance_plan_create(
  p_ten_ke_hoach text,
  p_nam int,
  p_loai_cong_viec text,
  p_khoa_phong text,
  p_nguoi_lap_ke_hoach text
) returns int
language sql
security definer
as $$
  insert into ke_hoach_bao_tri(ten_ke_hoach, nam, loai_cong_viec, khoa_phong, nguoi_lap_ke_hoach, trang_thai)
  values (p_ten_ke_hoach, p_nam, p_loai_cong_viec, nullif(p_khoa_phong,''), p_nguoi_lap_ke_hoach, 'Bản nháp')
  returning id;
$$;

grant execute on function public.maintenance_plan_create(text,int,text,text,text) to authenticated;

-- Update plan basic fields (not status)
create or replace function public.maintenance_plan_update(
  p_id bigint,
  p_ten_ke_hoach text,
  p_nam int,
  p_loai_cong_viec text,
  p_khoa_phong text
) returns void
language sql
security definer
as $$
  update ke_hoach_bao_tri
  set ten_ke_hoach = coalesce(p_ten_ke_hoach, ten_ke_hoach),
      nam = coalesce(p_nam, nam),
      loai_cong_viec = coalesce(p_loai_cong_viec, loai_cong_viec),
      khoa_phong = nullif(p_khoa_phong,'')
  where id = p_id;
$$;

grant execute on function public.maintenance_plan_update(bigint,text,int,text,text) to authenticated;

-- Delete plan
create or replace function public.maintenance_plan_delete(p_id bigint)
returns void
language sql
security definer
as $$
  delete from ke_hoach_bao_tri where id = p_id;
$$;

grant execute on function public.maintenance_plan_delete(bigint) to authenticated;

-- Approve plan
create or replace function public.maintenance_plan_approve(p_id bigint, p_nguoi_duyet text)
returns void
language sql
security definer
as $$
  update ke_hoach_bao_tri
  set trang_thai = 'Đã duyệt',
      ngay_phe_duyet = now(),
      nguoi_duyet = p_nguoi_duyet
  where id = p_id;
$$;

grant execute on function public.maintenance_plan_approve(bigint,text) to authenticated;

-- Reject plan
create or replace function public.maintenance_plan_reject(p_id bigint, p_nguoi_duyet text, p_ly_do text)
returns void
language sql
security definer
as $$
  update ke_hoach_bao_tri
  set trang_thai = 'Không duyệt',
      ngay_phe_duyet = now(),
      nguoi_duyet = p_nguoi_duyet,
      ly_do_khong_duyet = p_ly_do
  where id = p_id;
$$;

grant execute on function public.maintenance_plan_reject(bigint,text,text) to authenticated;

-- Task completion: mark specific month complete and log history
create or replace function public.maintenance_task_complete(p_task_id bigint, p_month int)
returns void
language plpgsql
security definer
as $$
declare
  v_task record;
  v_date timestamptz := now();
  v_month_col text;
  v_month_date_col text;
  v_plan record;
begin
  select * into v_task from cong_viec_bao_tri where id = p_task_id;
  if not found then return; end if;
  select id, ten_ke_hoach, nam, khoa_phong into v_plan from ke_hoach_bao_tri where id = v_task.ke_hoach_id;

  v_month_col := format('thang_%s_hoan_thanh', p_month);
  v_month_date_col := format('ngay_hoan_thanh_%s', p_month);

  execute format('update cong_viec_bao_tri set %I = true, %I = $1, updated_at = $1 where id = $2', v_month_col, v_month_date_col)
    using v_date, p_task_id;

  insert into lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet, ngay_thuc_hien)
  values (
    v_task.thiet_bi_id,
    v_task.loai_cong_viec,
    format('Hoàn thành %s tháng %s/%s theo kế hoạch "%s"', v_task.loai_cong_viec, p_month, v_plan.nam, v_plan.ten_ke_hoach),
    jsonb_build_object('cong_viec_id', p_task_id, 'thang', p_month, 'ten_ke_hoach', v_plan.ten_ke_hoach, 'khoa_phong', v_plan.khoa_phong, 'nam', v_plan.nam),
    v_date
  );
end; $$;

grant execute on function public.maintenance_task_complete(bigint,int) to authenticated;
