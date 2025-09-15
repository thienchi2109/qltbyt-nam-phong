-- Align maintenance RPCs with ke_hoach_bao_tri / cong_viec_bao_tri schema
-- Safe to re-run due to CREATE OR REPLACE

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

grant execute on function public.maintenance_tasks_list(bigint, bigint, text, text) to authenticated;
grant execute on function public.maintenance_tasks_bulk_insert(jsonb) to authenticated;
grant execute on function public.maintenance_task_update(bigint, jsonb) to authenticated;
grant execute on function public.maintenance_tasks_delete(bigint[]) to authenticated;
