-- Backfill don_vi and link existing records based on legacy khoa_phong fields
BEGIN;

WITH src AS (
  SELECT DISTINCT kp AS name
  FROM (
    SELECT NULLIF(TRIM(khoa_phong), '') AS kp FROM public.nhan_vien
    UNION
    SELECT NULLIF(TRIM(khoa_phong_quan_ly), '') AS kp FROM public.thiet_bi
  ) s
  WHERE kp IS NOT NULL
), to_insert AS (
  SELECT
    LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '_', 'g')) AS code,
    name
  FROM src
)
-- Insert only when neither the name nor the code already exists
INSERT INTO public.don_vi(code, name)
SELECT ti.code, ti.name
FROM to_insert ti
WHERE NOT EXISTS (
  SELECT 1 FROM public.don_vi dv WHERE dv.name = ti.name OR dv.code = ti.code
)
ON CONFLICT (code) DO NOTHING;

-- 2) Ensure a fallback tenant for unmapped/null departments
INSERT INTO public.don_vi(code, name)
VALUES ('unassigned', 'UNASSIGNED')
ON CONFLICT (code) DO NOTHING;

-- 3) Backfill nhan_vien.don_vi and current_don_vi
UPDATE public.nhan_vien nv
SET don_vi = dv.id
FROM public.don_vi dv
WHERE nv.don_vi IS NULL AND nv.khoa_phong IS NOT NULL AND dv.name = TRIM(nv.khoa_phong);

UPDATE public.nhan_vien nv
SET don_vi = dv.id
FROM public.don_vi dv
WHERE nv.don_vi IS NULL AND dv.code = 'unassigned';

UPDATE public.nhan_vien nv
SET current_don_vi = nv.don_vi
WHERE nv.current_don_vi IS NULL AND nv.don_vi IS NOT NULL;

-- 4) Backfill thiet_bi.don_vi
UPDATE public.thiet_bi tb
SET don_vi = dv.id
FROM public.don_vi dv
WHERE tb.don_vi IS NULL AND tb.khoa_phong_quan_ly IS NOT NULL AND dv.name = TRIM(tb.khoa_phong_quan_ly);

UPDATE public.thiet_bi tb
SET don_vi = dv.id
FROM public.don_vi dv
WHERE tb.don_vi IS NULL AND dv.code = 'unassigned';

-- 5) Seed memberships for users to their current tenant (idempotent)
INSERT INTO public.user_don_vi_memberships(user_id, don_vi)
SELECT nv.id, nv.current_don_vi
FROM public.nhan_vien nv
WHERE nv.current_don_vi IS NOT NULL
ON CONFLICT (user_id, don_vi) DO NOTHING;

COMMIT;
