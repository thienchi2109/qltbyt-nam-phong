-- Fix maintenance_plan_create function to properly handle RETURNING clause
-- This resolves PostgreSQL error 42601: "query has no destination for result data"

CREATE OR REPLACE FUNCTION public.maintenance_plan_create(
  p_ten_ke_hoach text,
  p_nam int,
  p_loai_cong_viec text,
  p_khoa_phong text,
  p_nguoi_lap_ke_hoach text
) 
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_new_id int;
BEGIN
  INSERT INTO ke_hoach_bao_tri(
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
    NULLIF(p_khoa_phong,''), 
    p_nguoi_lap_ke_hoach, 
    'Bản nháp',
    v_claim_donvi -- Set don_vi from JWT claims
  )
  RETURNING id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_plan_create(text,int,text,text,text) TO authenticated;