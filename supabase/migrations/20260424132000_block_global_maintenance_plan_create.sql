-- 20260424132000_block_global_maintenance_plan_create.sql
-- Purpose: Block global/admin users from creating tenantless maintenance plans.

BEGIN;

CREATE OR REPLACE FUNCTION public.maintenance_plan_create(
  p_ten_ke_hoach text,
  p_nam integer,
  p_loai_cong_viec text,
  p_khoa_phong text,
  p_nguoi_lap_ke_hoach text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_guard record;
  v_new_id integer;
BEGIN
  SELECT * INTO v_guard FROM public._assert_maintenance_write_allowed();

  IF v_guard.is_global THEN
    RAISE EXCEPTION 'global/admin cannot create tenant maintenance plans' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.ke_hoach_bao_tri(
    ten_ke_hoach,
    nam,
    loai_cong_viec,
    khoa_phong,
    nguoi_lap_ke_hoach,
    trang_thai,
    don_vi
  )
  VALUES (
    p_ten_ke_hoach,
    p_nam,
    p_loai_cong_viec,
    NULLIF(p_khoa_phong, ''),
    p_nguoi_lap_ke_hoach,
    'Bản nháp',
    v_guard.default_don_vi
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.maintenance_plan_create(text, integer, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.maintenance_plan_create(text, integer, text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
