DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_nhom_thiet_bi_don_vi_ma_nhom'
  ) THEN
    ALTER TABLE public.nhom_thiet_bi
      ADD CONSTRAINT uq_nhom_thiet_bi_don_vi_ma_nhom
      UNIQUE (don_vi_id, ma_nhom);
  END IF;
END $$;
