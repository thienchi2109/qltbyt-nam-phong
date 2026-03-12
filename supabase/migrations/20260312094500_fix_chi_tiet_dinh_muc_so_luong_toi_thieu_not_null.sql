BEGIN;

UPDATE public.chi_tiet_dinh_muc
SET so_luong_toi_thieu = 0
WHERE so_luong_toi_thieu IS NULL;

ALTER TABLE public.chi_tiet_dinh_muc
  ALTER COLUMN so_luong_toi_thieu SET DEFAULT 0;

ALTER TABLE public.chi_tiet_dinh_muc
  ALTER COLUMN so_luong_toi_thieu SET NOT NULL;

COMMIT;
