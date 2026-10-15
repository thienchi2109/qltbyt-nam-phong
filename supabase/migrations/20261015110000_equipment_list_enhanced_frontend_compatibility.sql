-- Preserve the canonical 19-parameter implementation while accepting the
-- 13-parameter named payload currently emitted by useEquipmentData.
-- The six scalar filter arguments are intentionally NULL in this adapter;
-- array filters remain the source of truth for the frontend contract.
CREATE OR REPLACE FUNCTION public.equipment_list_enhanced(
  p_q text,
  p_don_vi bigint,
  p_khoa_phong_array text[],
  p_nguoi_su_dung_array text[],
  p_vi_tri_lap_dat_array text[],
  p_tinh_trang_array text[],
  p_phan_loai_array text[],
  p_nguon_kinh_phi_array text[],
  p_equipment_dataset text,
  p_sort text,
  p_page integer,
  p_page_size integer,
  p_liquidation_last boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN public.equipment_list_enhanced(
    p_q => p_q,
    p_sort => p_sort,
    p_page => p_page,
    p_page_size => p_page_size,
    p_don_vi => p_don_vi,
    p_khoa_phong => NULL,
    p_khoa_phong_array => p_khoa_phong_array,
    p_nguoi_su_dung => NULL,
    p_nguoi_su_dung_array => p_nguoi_su_dung_array,
    p_vi_tri_lap_dat => NULL,
    p_vi_tri_lap_dat_array => p_vi_tri_lap_dat_array,
    p_tinh_trang => NULL,
    p_tinh_trang_array => p_tinh_trang_array,
    p_phan_loai => NULL,
    p_phan_loai_array => p_phan_loai_array,
    p_nguon_kinh_phi => NULL,
    p_nguon_kinh_phi_array => p_nguon_kinh_phi_array,
    p_liquidation_last => p_liquidation_last,
    p_equipment_dataset => p_equipment_dataset
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.equipment_list_enhanced(
  text, bigint, text[], text[], text[], text[], text[], text[], text,
  text, integer, integer, boolean
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.equipment_list_enhanced(
  text, bigint, text[], text[], text[], text[], text[], text[], text,
  text, integer, integer, boolean
) FROM anon;
GRANT EXECUTE ON FUNCTION public.equipment_list_enhanced(
  text, bigint, text[], text[], text[], text[], text[], text[], text,
  text, integer, integer, boolean
) TO authenticated, service_role;
